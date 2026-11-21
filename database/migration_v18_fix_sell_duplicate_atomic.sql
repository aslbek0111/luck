-- ==============================================================================
-- LUCKY UC - Migration V18: Fix Sell Duplicate Atomic Function & Schema Cache
-- Canonical Signature: public.sell_duplicate_atomic(p_reward_identifier TEXT, p_user_id UUID)
-- 
-- 1. Verifies reward_rarity enum (uncommon, pro-epic, etc.)
-- 2. Creates sales_history table and RLS policies (if not exist)
-- 3. Creates canonical public.sell_duplicate_atomic(p_reward_identifier TEXT, p_user_id UUID)
-- 4. Grants EXECUTE to authenticated, service_role, and anon
-- 5. Reloads PostgREST schema cache immediately via NOTIFY pgrst, 'reload schema'
-- ==============================================================================

-- 1. ENUMS VERIFICATION
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    ALTER TYPE reward_rarity ADD VALUE 'uncommon';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE reward_rarity ADD VALUE 'pro-epic';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. SALES HISTORY TABLE (DUPLICATES SELLING)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES public.rewards_catalog(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    item_rarity reward_rarity NOT NULL,
    coins_earned INTEGER NOT NULL CHECK (coins_earned > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_history_user ON public.sales_history(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_history_created ON public.sales_history(created_at DESC);

ALTER TABLE public.sales_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sales history" ON public.sales_history;
CREATE POLICY "Users can view own sales history" 
    ON public.sales_history FOR SELECT 
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access sales" ON public.sales_history;
CREATE POLICY "Service role full access sales" 
    ON public.sales_history FOR ALL 
    USING (auth.role() = 'service_role');

-- 3. CANONICAL ATOMIC RPC FUNCTION: sell_duplicate_atomic(p_reward_identifier TEXT, p_user_id UUID)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sell_duplicate_atomic(
    p_reward_identifier TEXT,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user RECORD;
    v_reward RECORD;
    v_inv RECORD;
    v_coins_earned INTEGER;
    v_new_coins INTEGER;
    v_new_points INTEGER;
    v_new_qty INTEGER;
    v_min_price INTEGER;
    v_max_price INTEGER;
    v_clean_identifier TEXT;
BEGIN
    -- Security: Authenticated caller can only sell from their own inventory
    IF auth.uid() IS NOT NULL AND auth.role() = 'authenticated' AND auth.uid() <> p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Вы можете продавать предметы только со своего аккаунта');
    END IF;

    IF p_reward_identifier IS NULL OR TRIM(p_reward_identifier) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Укажите идентификатор предмета');
    END IF;

    v_clean_identifier := TRIM(p_reward_identifier);

    -- 1. Lock user record
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Пользователь не найден');
    END IF;

    IF v_user.is_blocked THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ваш аккаунт заблокирован');
    END IF;

    -- 2. Locate reward in catalog (supports UUID, title_slug, slug without title-, and exact name)
    SELECT * INTO v_reward 
    FROM public.rewards_catalog 
    WHERE (
        (v_clean_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id = v_clean_identifier::UUID)
        OR LOWER(COALESCE(title_slug, '')) = LOWER(v_clean_identifier)
        OR LOWER(COALESCE(title_slug, '')) = LOWER(REPLACE(v_clean_identifier, 'title-', ''))
        OR LOWER(COALESCE('title-' || title_slug, '')) = LOWER(v_clean_identifier)
        OR LOWER(id::text) = LOWER(v_clean_identifier)
        OR LOWER(name) = LOWER(v_clean_identifier)
    )
    AND is_active = TRUE
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Предмет не найден в каталоге наград');
    END IF;

    -- 3. Lock user inventory row
    SELECT * INTO v_inv 
    FROM public.user_inventory 
    WHERE user_id = p_user_id AND reward_id = v_reward.id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Предмет отсутствует в вашем инвентаре');
    END IF;

    -- Rule: Must be a duplicate (quantity > 1). Cannot sell the only instance!
    IF v_inv.quantity <= 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Нельзя продать единственный экземпляр предмета. Доступна продажа только дубликатов.');
    END IF;

    -- Rule: Cannot sell only equipped title
    IF (v_reward.is_title OR v_reward.category = 'titles') AND v_user.active_title_id = v_reward.id AND v_inv.quantity <= 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Нельзя продать единственный надетый титул.');
    END IF;

    -- 4. Server-Side Random Price Calculation based on verified rarity
    -- Common: 5–10 Coins
    -- Uncommon: 10–20 Coins
    -- Rare: 20–35 Coins
    -- Epic: 40–55 Coins
    -- Pro-Epic: 80–100 Coins
    -- Mythic: 150–200 Coins
    -- Legendary: 250–350 Coins
    CASE v_reward.rarity
        WHEN 'common' THEN
            v_min_price := 5;
            v_max_price := 10;
        WHEN 'uncommon' THEN
            v_min_price := 10;
            v_max_price := 20;
        WHEN 'rare' THEN
            v_min_price := 20;
            v_max_price := 35;
        WHEN 'epic' THEN
            v_min_price := 40;
            v_max_price := 55;
        WHEN 'pro-epic' THEN
            v_min_price := 80;
            v_max_price := 100;
        WHEN 'mythic' THEN
            v_min_price := 150;
            v_max_price := 200;
        WHEN 'legendary' THEN
            v_min_price := 250;
            v_max_price := 350;
        ELSE
            v_min_price := 5;
            v_max_price := 15;
    END CASE;

    -- Generate random integer between v_min_price and v_max_price inclusive
    v_coins_earned := floor(random() * (v_max_price - v_min_price + 1) + v_min_price)::INTEGER;

    -- 5. Decrement inventory quantity by exactly 1
    v_new_qty := v_inv.quantity - 1;
    UPDATE public.user_inventory
    SET quantity = v_new_qty,
        updated_at = NOW()
    WHERE id = v_inv.id;

    -- 6. Credit coins to user balance (and sync points)
    v_new_coins := COALESCE(v_user.coins_balance, v_user.points_balance, 0) + v_coins_earned;
    v_new_points := v_new_coins;

    UPDATE public.users 
    SET coins_balance = v_new_coins,
        points_balance = v_new_points,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- 7. Record transaction in sales_history
    INSERT INTO public.sales_history (
        user_id,
        reward_id,
        item_name,
        item_rarity,
        coins_earned,
        created_at
    ) VALUES (
        p_user_id,
        v_reward.id,
        v_reward.name,
        v_reward.rarity,
        v_coins_earned,
        NOW()
    );

    -- 8. Add system notification (if notifications table exists)
    BEGIN
        INSERT INTO public.notifications (user_id, type, title, message, data, created_at)
        VALUES (
            p_user_id,
            'system',
            'Дубликат успешно продан! 🪙',
            'Вы продали дубликат «' || v_reward.name || '» за +' || v_coins_earned || ' Coins! Монеты зачислены на ваш баланс.',
            jsonb_build_object(
                'rewardName', v_reward.name,
                'rewardRarity', v_reward.rarity,
                'coinsEarned', v_coins_earned,
                'remainingQuantity', v_new_qty
            ),
            NOW()
        );
    EXCEPTION
        WHEN undefined_table THEN
            NULL;
    END;

    -- 9. Return structured success payload
    RETURN jsonb_build_object(
        'success', true,
        'item', jsonb_build_object(
            'id', v_reward.id,
            'slug', COALESCE(v_reward.title_slug, v_reward.id::text),
            'name', v_reward.name,
            'rarity', v_reward.rarity,
            'remaining_quantity', v_new_qty
        ),
        'coins_earned', v_coins_earned,
        'coins_balance', v_new_coins,
        'points_balance', v_new_points,
        'message', 'Дубликат «' || v_reward.name || '» успешно продан за ' || v_coins_earned || ' Coins!'
    );
END;
$$;

-- 4. GRANTS & PERMISSIONS
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.sell_duplicate_atomic(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sell_duplicate_atomic(TEXT, UUID) TO authenticated, service_role, anon;

-- 5. RELOAD POSTGREST SCHEMA CACHE
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
