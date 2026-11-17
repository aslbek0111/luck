-- ==============================================================================
-- LUCKY UC - Migration V2: Atomic RPC Functions, Spins History & Browser Auth
-- ==============================================================================

-- 1. ADD BROWSER PIN / AUTH COLUMNS TO USERS TABLE
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS browser_pin TEXT DEFAULT '1234',
ADD COLUMN IF NOT EXISTS auth_token TEXT;

-- 2. CREATE SPINS HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.spins_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reward_id UUID REFERENCES public.rewards_catalog(id) ON DELETE SET NULL,
    reward_name TEXT NOT NULL,
    reward_rarity reward_rarity NOT NULL,
    reward_value INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spins_history_user ON public.spins_history(user_id, created_at DESC);
ALTER TABLE public.spins_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own spins history" 
    ON public.spins_history FOR SELECT 
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Service role full access spins_history" 
    ON public.spins_history FOR ALL 
    USING (auth.role() = 'service_role');

-- 3. ATOMIC RPC FUNCTION: SEND GIFT
-- Ensures strict duplicate rules, prevents gifting only copy or last copy of equipped title
CREATE OR REPLACE FUNCTION public.send_gift_atomic(
    p_sender_id UUID,
    p_recipient_username TEXT,
    p_reward_id UUID,
    p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_sender RECORD;
    v_recipient RECORD;
    v_sender_item RECORD;
    v_reward RECORD;
    v_clean_username TEXT;
BEGIN
    -- 1. Validate quantity
    IF p_quantity <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Некорректное количество предметов');
    END IF;

    -- 2. Clean recipient username
    v_clean_username := LOWER(TRIM(LEADING '@' FROM p_recipient_username));
    IF v_clean_username IS NULL OR v_clean_username = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Укажите username получателя');
    END IF;

    -- 3. Check sender
    SELECT * INTO v_sender FROM public.users WHERE id = p_sender_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Отправитель не найден');
    END IF;

    IF v_sender.is_blocked THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ваш аккаунт заблокирован');
    END IF;

    -- 4. Check recipient
    SELECT * INTO v_recipient FROM public.users WHERE LOWER(username) = v_clean_username FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Игрок @' || v_clean_username || ' не найден');
    END IF;

    IF v_recipient.id = p_sender_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Нельзя отправить подарок самому себе');
    END IF;

    -- 5. Check reward in catalog
    SELECT * INTO v_reward FROM public.rewards_catalog WHERE id = p_reward_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Предмет не найден в каталоге');
    END IF;

    -- 6. Lock and check sender inventory
    SELECT * INTO v_sender_item FROM public.user_inventory 
    WHERE user_id = p_sender_id AND reward_id = p_reward_id FOR UPDATE;

    IF NOT FOUND OR v_sender_item.quantity < 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Нельзя подарить единственный экземпляр предмета');
    END IF;

    -- 7. Check if active title
    IF v_sender.active_title_id = p_reward_id AND (v_sender_item.quantity - p_quantity) < 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Нельзя подарить последний экземпляр надетого титула');
    END IF;

    IF v_sender_item.quantity - p_quantity < 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Нельзя подарить все копии предмета');
    END IF;

    -- 8. Deduct from sender
    UPDATE public.user_inventory
    SET quantity = quantity - p_quantity, updated_at = NOW()
    WHERE id = v_sender_item.id;

    -- 9. Add to recipient
    INSERT INTO public.user_inventory (user_id, reward_id, quantity, acquired_at, updated_at)
    VALUES (v_recipient.id, p_reward_id, p_quantity, NOW(), NOW())
    ON CONFLICT (user_id, reward_id)
    DO UPDATE SET quantity = public.user_inventory.quantity + p_quantity, updated_at = NOW();

    -- 10. Record in gifts_history
    INSERT INTO public.gifts_history (sender_id, recipient_id, reward_id, quantity, status, created_at)
    VALUES (p_sender_id, v_recipient.id, p_reward_id, p_quantity, 'completed', NOW());

    -- 11. Add public event
    INSERT INTO public.public_events (user_id, username, reward_id, reward_name, reward_rarity, reward_category, event_type, created_at)
    VALUES (
        p_sender_id,
        COALESCE('@' || v_sender.username, 'Игрок'),
        p_reward_id,
        'ПОДАРОК: ' || v_reward.name || ' для @' || v_recipient.username,
        v_reward.rarity,
        v_reward.category,
        'gift_sent',
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'recipient', v_recipient.username,
        'reward_name', v_reward.name,
        'remaining_quantity', v_sender_item.quantity - p_quantity
    );
END;
$$;

-- 4. ATOMIC RPC FUNCTION: PLAY SPIN
-- Server-side RNG spin execution and inventory reward allocation
CREATE OR REPLACE FUNCTION public.play_spin_atomic(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user RECORD;
    v_reward RECORD;
    v_random_pct FLOAT;
BEGIN
    -- Lock user
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Пользователь не найден');
    END IF;

    IF v_user.is_blocked THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ваш аккаунт заблокирован');
    END IF;

    IF v_user.free_spins_balance <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'У вас закончились бесплатные вращения');
    END IF;

    -- Decrement spin balance and increment total spins count
    UPDATE public.users 
    SET free_spins_balance = free_spins_balance - 1,
        spins_count = spins_count + 1,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Weighted random selection
    v_random_pct := random() * 100;
    
    IF v_random_pct < 35 THEN
        -- Common drop: Popularity or single rose (35%)
        SELECT * INTO v_reward FROM public.rewards_catalog 
        WHERE rarity = 'common' AND is_active = TRUE ORDER BY random() LIMIT 1;
    ELSIF v_random_pct < 65 THEN
        -- Rare item: Free spins or 50 pop or bouquet (30%)
        SELECT * INTO v_reward FROM public.rewards_catalog 
        WHERE rarity = 'rare' AND is_title = FALSE AND is_active = TRUE ORDER BY random() LIMIT 1;
    ELSIF v_random_pct < 85 THEN
        -- Rare Title or Epic item (20%)
        SELECT * INTO v_reward FROM public.rewards_catalog 
        WHERE (rarity = 'rare' AND is_title = TRUE) OR (rarity = 'epic' AND is_title = FALSE) 
        AND is_active = TRUE ORDER BY random() LIMIT 1;
    ELSIF v_random_pct < 96 THEN
        -- Epic Title: КОРОЛЬ or КОРОЛЕВА (11%)
        SELECT * INTO v_reward FROM public.rewards_catalog 
        WHERE rarity = 'epic' AND is_title = TRUE AND is_active = TRUE ORDER BY random() LIMIT 1;
    ELSIF v_random_pct < 99 THEN
        -- Mythic Title: КИБОРГ (3%)
        SELECT * INTO v_reward FROM public.rewards_catalog 
        WHERE rarity = 'mythic' AND is_active = TRUE ORDER BY random() LIMIT 1;
    ELSE
        -- Legendary Title: VIP or Gold Pacifier (1%)
        SELECT * INTO v_reward FROM public.rewards_catalog 
        WHERE rarity = 'legendary' AND is_active = TRUE ORDER BY random() LIMIT 1;
    END IF;

    -- Fallback safety
    IF v_reward.id IS NULL THEN
        SELECT * INTO v_reward FROM public.rewards_catalog WHERE is_active = TRUE ORDER BY random() LIMIT 1;
    END IF;

    -- Handle specific reward side-effects
    IF v_reward.category = 'spins' THEN
        UPDATE public.users SET free_spins_balance = free_spins_balance + v_reward.value WHERE id = p_user_id;
    ELSIF v_reward.category = 'popularity' THEN
        UPDATE public.users SET total_popularity = total_popularity + v_reward.value WHERE id = p_user_id;
    ELSIF v_reward.category = 'uc' THEN
        UPDATE public.users SET total_uc = total_uc + v_reward.value WHERE id = p_user_id;
    END IF;

    -- Insert or increment user inventory
    INSERT INTO public.user_inventory (user_id, reward_id, quantity, acquired_at, updated_at)
    VALUES (p_user_id, v_reward.id, 1, NOW(), NOW())
    ON CONFLICT (user_id, reward_id)
    DO UPDATE SET quantity = public.user_inventory.quantity + 1, updated_at = NOW();

    -- Log spin in spins_history
    INSERT INTO public.spins_history (user_id, reward_id, reward_name, reward_rarity, reward_value, created_at)
    VALUES (p_user_id, v_reward.id, v_reward.name, v_reward.rarity, v_reward.value, NOW());

    -- Log public event for notable rewards
    IF v_reward.rarity IN ('rare', 'epic', 'mythic', 'legendary') THEN
        INSERT INTO public.public_events (user_id, username, reward_id, reward_name, reward_rarity, reward_category, event_type, created_at)
        VALUES (
            p_user_id,
            COALESCE('@' || v_user.username, 'Игрок'),
            v_reward.id,
            v_reward.name,
            v_reward.rarity,
            v_reward.category,
            'reward_received',
            NOW()
        );
    END IF;

    -- Fetch updated balances
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'reward', jsonb_build_object(
            'id', v_reward.id,
            'name', v_reward.name,
            'category', v_reward.category,
            'rarity', v_reward.rarity,
            'icon', v_reward.icon_name,
            'description', v_reward.description,
            'value', v_reward.value,
            'is_title', v_reward.is_title,
            'title_slug', v_reward.title_slug
        ),
        'spins_left', v_user.free_spins_balance,
        'total_spins', v_user.spins_count,
        'total_uc', v_user.total_uc,
        'total_popularity', v_user.total_popularity
    );
END;
$$;

-- 5. FUNCTION SECURITY & RPC PERMISSIONS
REVOKE ALL ON FUNCTION public.send_gift_atomic(UUID, TEXT, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_gift_atomic(UUID, TEXT, UUID, INTEGER) TO service_role, authenticated;

REVOKE ALL ON FUNCTION public.play_spin_atomic(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.play_spin_atomic(UUID) TO service_role, authenticated;

-- 6. HARDEN RLS ON USERS TABLE (Prevent leakage of browser_pin and auth_token)
DROP POLICY IF EXISTS "Public user profile viewable by all" ON public.users;
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
CREATE POLICY "Users can view own data" 
    ON public.users FOR SELECT 
    USING (auth.uid() = id OR auth.role() = 'service_role');

-- 7. SECURE PUBLIC PROFILES VIEW
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
    id,
    username,
    first_name,
    avatar_url,
    active_title_id,
    total_popularity,
    total_uc,
    spins_count,
    created_at
FROM public.users
WHERE is_blocked = FALSE;

GRANT SELECT ON public.public_profiles TO anon, authenticated, service_role;

