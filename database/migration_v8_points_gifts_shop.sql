-- ==============================================================================
-- LUCKY UC - Migration V8: Points, Gifts, Shop & Inventory System
-- 1. Add points_balance column to public.users table (default 1000 for players).
-- 2. Create public.purchases_history table for auditing and tracking all shop buys.
-- 3. Create atomic RPC function public.purchase_item_atomic:
--    - Server-side role check: admins (is_admin = TRUE) have UNLIMITED POINTS (cost = 0, balance unchanged).
--    - Client data untrusted: server verifies item price, item validity and user role.
--    - Strict exclusion: "UC VIP" and category 'uc' items are completely excluded from point purchases.
--    - Race condition and double-deduction protection via SELECT ... FOR UPDATE.
--    - Non-negative balance constraint enforcement.
--    - Automatic inventory upsert and purchase log recording.
-- 4. Set up Row Level Security (RLS) policies for purchases_history.
-- ==============================================================================

-- 1. ADD points_balance COLUMN TO USERS TABLE
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS points_balance INTEGER NOT NULL DEFAULT 1000 CHECK (points_balance >= 0);

-- Ensure all existing users have at least 1000 Points
UPDATE public.users 
SET points_balance = 1000 
WHERE points_balance IS NULL OR points_balance < 1000;

-- 2. CREATE PURCHASES HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.purchases_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES public.rewards_catalog(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL DEFAULT 'gift', -- 'gift' | 'title'
    item_name TEXT NOT NULL,
    item_slug TEXT NOT NULL,
    cost_points INTEGER NOT NULL DEFAULT 0 CHECK (cost_points >= 0),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    is_admin_purchase BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_history_user ON public.purchases_history(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_history_created ON public.purchases_history(created_at DESC);

-- 3. ATOMIC PURCHASE RPC FUNCTION
CREATE OR REPLACE FUNCTION public.purchase_item_atomic(
    p_user_id UUID,
    p_item_slug TEXT,
    p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user RECORD;
    v_reward RECORD;
    v_unit_cost INTEGER;
    v_total_cost INTEGER;
    v_is_admin BOOLEAN;
    v_item_type TEXT;
    v_new_points INTEGER;
    v_inv_record RECORD;
BEGIN
    -- 1. Basic validation
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Недопустимое количество предметов для покупки');
    END IF;

    IF p_item_slug IS NULL OR TRIM(p_item_slug) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Укажите идентификатор товара');
    END IF;

    -- 2. Lock user record to prevent race conditions and concurrent double-spend
    SELECT * INTO v_user 
    FROM public.users 
    WHERE id = p_user_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Пользователь не найден');
    END IF;

    IF v_user.is_blocked THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ваш аккаунт заблокирован');
    END IF;

    -- Check admin status strictly on the server
    v_is_admin := (v_user.is_admin = TRUE);

    -- 3. STRICT EXCLUSION CHECK: UC VIP and direct UC rewards cannot be bought for Points
    IF LOWER(p_item_slug) = 'reward-uc-30' 
       OR LOWER(p_item_slug) = 'reward-uc-60' 
       OR LOWER(p_item_slug) = 'title-vip'
       OR LOWER(p_item_slug) = 'vip'
       OR LOWER(p_item_slug) LIKE '%uc%vip%'
       OR LOWER(p_item_slug) LIKE '%vip%uc%' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Товар UC VIP полностью исключен из покупок за Points');
    END IF;

    -- 4. Locate reward in rewards_catalog
    SELECT * INTO v_reward 
    FROM public.rewards_catalog 
    WHERE LOWER(slug) = LOWER(p_item_slug)
       OR LOWER(id::text) = LOWER(p_item_slug)
       OR LOWER(title_slug) = LOWER(p_item_slug)
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Товар не найден в каталоге наград');
    END IF;

    -- Check if item is categorized under 'uc' or named 'VIP'
    IF v_reward.category = 'uc' OR LOWER(v_reward.name) = 'vip' OR LOWER(v_reward.name) LIKE '%uc vip%' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Данный товар (UC VIP) недоступен для покупки за Points');
    END IF;

    -- Determine item type (title or gift)
    IF v_reward.is_title OR v_reward.category = 'titles' THEN
        v_item_type := 'title';
    ELSE
        v_item_type := 'gift';
    END IF;

    -- 5. Calculate Server-Side Unit Cost in Points (client prices are NEVER trusted)
    -- Titles pricing:
    IF v_item_type = 'title' THEN
        CASE v_reward.rarity
            WHEN 'rare' THEN v_unit_cost := 300;
            WHEN 'epic' THEN v_unit_cost := 800;
            WHEN 'mythic' THEN v_unit_cost := 1500;
            WHEN 'legendary' THEN v_unit_cost := 3000;
            ELSE v_unit_cost := 500;
        END CASE;
    ELSE
        -- Gifts pricing based on rarity and item value:
        CASE v_reward.rarity
            WHEN 'common' THEN 
                v_unit_cost := GREATEST(50, COALESCE(v_reward.value, 50));
            WHEN 'rare' THEN 
                v_unit_cost := GREATEST(150, COALESCE(v_reward.value, 150));
            WHEN 'epic' THEN 
                v_unit_cost := GREATEST(500, COALESCE(v_reward.value, 500));
            WHEN 'mythic' THEN 
                v_unit_cost := GREATEST(1500, COALESCE(v_reward.value, 1500));
            WHEN 'legendary' THEN 
                v_unit_cost := GREATEST(2500, COALESCE(v_reward.value, 2500));
            ELSE 
                v_unit_cost := 100;
        END CASE;
    END IF;

    -- If user is ADMIN: UNLIMITED POINTS!
    -- Cost to deduct is exactly 0 and admin balance remains intact.
    IF v_is_admin THEN
        v_total_cost := 0;
        v_new_points := v_user.points_balance;
    ELSE
        v_total_cost := v_unit_cost * p_quantity;

        -- Verify balance
        IF v_user.points_balance < v_total_cost THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error', 'Недостаточно Points для покупки. Требуется: ' || v_total_cost || ', доступно: ' || v_user.points_balance,
                'required_points', v_total_cost,
                'current_points', v_user.points_balance
            );
        END IF;

        -- Deduct points
        UPDATE public.users 
        SET points_balance = points_balance - v_total_cost,
            updated_at = NOW()
        WHERE id = v_user.id
        RETURNING points_balance INTO v_new_points;
    END IF;

    -- 6. Add purchased item to user_inventory
    INSERT INTO public.user_inventory (user_id, reward_id, quantity, acquired_at)
    VALUES (v_user.id, v_reward.id, p_quantity, NOW())
    ON CONFLICT (user_id, reward_id) 
    DO UPDATE SET 
        quantity = public.user_inventory.quantity + p_quantity,
        updated_at = NOW()
    RETURNING * INTO v_inv_record;

    -- 7. Record entry in purchases_history
    INSERT INTO public.purchases_history (
        user_id,
        reward_id,
        item_type,
        item_name,
        item_slug,
        cost_points,
        quantity,
        is_admin_purchase,
        created_at
    ) VALUES (
        v_user.id,
        v_reward.id,
        v_item_type,
        v_reward.name,
        COALESCE(v_reward.slug, p_item_slug),
        v_total_cost,
        p_quantity,
        v_is_admin,
        NOW()
    );

    -- 8. Add event to public feed
    INSERT INTO public.public_events (
        user_id,
        username,
        reward_id,
        reward_name,
        reward_rarity,
        reward_category,
        event_type,
        created_at
    ) VALUES (
        v_user.id,
        '@' || v_user.username,
        v_reward.id,
        v_reward.name,
        v_reward.rarity,
        v_reward.category,
        'item_purchased',
        NOW()
    );

    -- 9. Return structured success response
    RETURN jsonb_build_object(
        'success', true,
        'item', jsonb_build_object(
            'id', v_reward.id,
            'slug', v_reward.slug,
            'name', v_reward.name,
            'category', v_reward.category,
            'rarity', v_reward.rarity,
            'is_title', v_reward.is_title,
            'quantity', v_inv_record.quantity
        ),
        'cost_points', v_total_cost,
        'points_balance', v_new_points,
        'is_admin', v_is_admin,
        'message', 'Товар «' || v_reward.name || '» успешно приобретен и добавлен в ваш Инвентарь!'
    );
END;
$$;

-- 4. ROW LEVEL SECURITY (RLS) FOR PURCHASES HISTORY
ALTER TABLE public.purchases_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can view own purchases"
        ON public.purchases_history FOR SELECT
        USING (auth.uid() = user_id OR auth.role() = 'service_role');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role can insert purchases"
        ON public.purchases_history FOR INSERT
        WITH CHECK (auth.role() = 'service_role' OR auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
