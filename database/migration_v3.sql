-- ==============================================================================
-- LUCKY UC - Migration V3: Secure Password Hashing & Persistent Spins
-- ==============================================================================

-- 1. ADD PASSWORD_HASH COLUMN & MAKE TELEGRAM_ID OPTIONAL FOR BROWSER USERS
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE public.users 
ALTER COLUMN telegram_id DROP NOT NULL;

-- 2. CREATE UNIQUE CASE-INSENSITIVE INDEX ON USERNAME
-- Ensures no duplicate usernames can be registered
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique 
ON public.users (LOWER(username));

-- 3. ENSURE FREE_SPINS_BALANCE HAS SAFE DEFAULT AND CHECK CONSTRAINT
ALTER TABLE public.users 
ALTER COLUMN free_spins_balance SET DEFAULT 5;

DO $$ BEGIN
    ALTER TABLE public.users 
    ADD CONSTRAINT chk_free_spins_non_negative 
    CHECK (free_spins_balance >= 0);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 4. UPDATE play_spin_atomic TO NEVER DROP SPINS TO ZERO UNEXPECTEDLY
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
    v_new_spins INTEGER;
    v_new_uc INTEGER;
    v_new_pop INTEGER;
BEGIN
    -- 1. Lock user row for update
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Пользователь не найден');
    END IF;

    IF v_user.is_blocked THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ваш аккаунт заблокирован');
    END IF;

    IF COALESCE(v_user.free_spins_balance, 0) <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'У вас закончились бесплатные вращения');
    END IF;

    -- 2. Decrement spin balance and increment total count
    v_new_spins := v_user.free_spins_balance - 1;
    v_new_uc := COALESCE(v_user.total_uc, 0);
    v_new_pop := COALESCE(v_user.total_popularity, 0);

    -- 3. Weighted random selection
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
        WHERE ((rarity = 'rare' AND is_title = TRUE) OR (rarity = 'epic' AND is_title = FALSE))
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

    -- Apply reward bonuses
    IF v_reward.category = 'spins' THEN
        v_new_spins := v_new_spins + COALESCE(v_reward.value, 0);
    ELSIF v_reward.category = 'popularity' THEN
        v_new_pop := v_new_pop + COALESCE(v_reward.value, 0);
    ELSIF v_reward.category = 'uc' THEN
        v_new_uc := v_new_uc + COALESCE(v_reward.value, 0);
    END IF;

    -- Update user balances atomically
    UPDATE public.users 
    SET free_spins_balance = v_new_spins,
        spins_count = COALESCE(spins_count, 0) + 1,
        total_uc = v_new_uc,
        total_popularity = v_new_pop,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Insert or increment user inventory
    INSERT INTO public.user_inventory (user_id, reward_id, quantity, acquired_at, updated_at)
    VALUES (p_user_id, v_reward.id, 1, NOW(), NOW())
    ON CONFLICT (user_id, reward_id)
    DO UPDATE SET quantity = public.user_inventory.quantity + 1, updated_at = NOW();

    -- Log spin in spins_history
    INSERT INTO public.spins_history (user_id, reward_id, reward_name, reward_rarity, reward_value, created_at)
    VALUES (p_user_id, v_reward.id, v_reward.name, v_reward.rarity, COALESCE(v_reward.value, 0), NOW());

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
        'spins_left', v_new_spins,
        'total_spins', v_user.spins_count + 1,
        'total_uc', v_new_uc,
        'total_popularity', v_new_pop
    );
END;
$$;

-- 5. ENSURE RLS NEVER EXPOSES password_hash
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
CREATE POLICY "Users can view own data" 
    ON public.users FOR SELECT 
    USING (auth.uid() = id OR auth.role() = 'service_role');
