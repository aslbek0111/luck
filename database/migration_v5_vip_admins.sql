-- ==============================================================================
-- LUCKY UC - Migration V5: Dual VIP+Admin Architecture & Complete Inventory
-- 1. Remove separate lucky_admin account.
-- 2. Upgrade the two VIP accounts (VIP5000X, VIP2026Z) to full Administrators (is_vip = TRUE, is_admin = TRUE).
-- 3. Idempotently grant 3 copies of EVERY catalog item to both VIP/Admin accounts.
-- 4. Unlimited spins support for VIP/Admin accounts.
-- 5. Safe and idempotent for Supabase PostgreSQL.
-- ==============================================================================

-- 1. REMOVE SEPARATE lucky_admin ACCOUNT IF EXISTS
DELETE FROM public.users WHERE username = 'lucky_admin';

-- 2. UPGRADE EXISTING VIP ACCOUNTS TO FULL ADMINISTRATORS
UPDATE public.users 
SET is_admin = TRUE,
    profile_frame = 'vip_gold',
    vip_badge = 'VIP_ADMIN',
    updated_at = NOW()
WHERE is_vip = TRUE;

-- 3. ENSURE VIP CODES HAVE TYPE 'vip'
UPDATE public.registration_codes
SET type = 'vip'
WHERE code IN ('VIP5000X', 'VIP2026Z');

-- 4. IDEMPOTENTLY GRANT EXACTLY 3 COPIES OF ALL CATALOG ITEMS TO VIP/ADMIN ACCOUNTS
INSERT INTO public.user_inventory (user_id, reward_id, quantity, acquired_at)
SELECT u.id, r.id, 3, NOW()
FROM public.users u
CROSS JOIN public.rewards_catalog r
WHERE u.is_vip = TRUE
ON CONFLICT (user_id, reward_id)
DO UPDATE SET quantity = GREATEST(public.user_inventory.quantity, 3),
              updated_at = NOW();

-- 5. UPDATE ATOMIC REGISTRATION RPC FUNCTION
CREATE OR REPLACE FUNCTION public.register_player_with_code_atomic(
    p_username TEXT,
    p_password_hash TEXT,
    p_code TEXT,
    p_first_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_code_record RECORD;
    v_new_user RECORD;
    v_is_vip BOOLEAN;
    v_is_admin BOOLEAN;
    v_initial_uc INTEGER;
    v_used_codes_count INTEGER;
BEGIN
    -- 1. Verify username uniqueness (case-insensitive)
    IF EXISTS (SELECT 1 FROM public.users WHERE LOWER(username) = LOWER(p_username)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Пользователь с таким никнеймом уже зарегистрирован');
    END IF;

    -- 2. Check and lock registration code
    SELECT * INTO v_code_record 
    FROM public.registration_codes 
    WHERE LOWER(code) = LOWER(p_code)
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Неверный код регистрации. Проверьте код и повторите ввод.');
    END IF;

    IF v_code_record.is_used THEN
        RETURN jsonb_build_object('success', false, 'error', 'Этот код регистрации уже был использован другим игроком.');
    END IF;

    -- 3. Verify total used codes cap (Max 12 slots)
    SELECT COUNT(*) INTO v_used_codes_count 
    FROM public.registration_codes 
    WHERE is_used = TRUE;

    IF v_used_codes_count >= 12 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Регистрация закрыта: все 12 игровых мест заняты.');
    END IF;

    -- 4. Configure VIP vs Standard parameters
    -- TWO VIP ACCOUNTS BECOME BOTH VIP PLAYERS AND FULL ADMINISTRATORS
    IF v_code_record.type = 'vip' THEN
        v_is_vip := TRUE;
        v_is_admin := TRUE;
        v_initial_uc := 5000;
    ELSE
        v_is_vip := FALSE;
        v_is_admin := FALSE;
        v_initial_uc := 0;
    END IF;

    -- 5. Insert user record
    INSERT INTO public.users (
        username,
        first_name,
        password_hash,
        avatar_url,
        total_uc,
        spins_count,
        total_popularity,
        free_spins_balance,
        is_vip,
        is_admin,
        is_approved,
        is_blocked,
        profile_frame,
        vip_badge
    ) VALUES (
        LOWER(p_username),
        COALESCE(p_first_name, INITCAP(p_username)),
        p_password_hash,
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        v_initial_uc,
        0,
        0,
        CASE WHEN v_is_vip THEN 999999 ELSE 0 END, -- VIPs have unlimited spins
        v_is_vip,
        v_is_admin,
        TRUE,
        FALSE,
        CASE WHEN v_is_vip THEN 'vip_gold' ELSE 'default' END,
        CASE WHEN v_is_vip THEN 'VIP_ADMIN' ELSE NULL END
    )
    RETURNING * INTO v_new_user;

    -- 6. Mark code as used
    UPDATE public.registration_codes
    SET is_used = TRUE,
        used_by_user_id = v_new_user.id,
        used_at = NOW()
    WHERE code = v_code_record.code;

    -- 7. Grant starter items
    IF v_is_vip THEN
        -- VIP/Admin accounts receive 3 copies of every catalog item!
        INSERT INTO public.user_inventory (user_id, reward_id, quantity, acquired_at)
        SELECT v_new_user.id, r.id, 3, NOW()
        FROM public.rewards_catalog r
        ON CONFLICT (user_id, reward_id)
        DO UPDATE SET quantity = GREATEST(public.user_inventory.quantity, 3);
    ELSE
        -- Standard players receive starter Christmas sticker
        INSERT INTO public.user_inventory (user_id, reward_id, quantity, acquired_at)
        SELECT v_new_user.id, id, 1, NOW()
        FROM public.rewards_catalog 
        WHERE id = '10000000-0000-0000-0000-000000000031' OR slug = 'reward-xmas-sticker'
        LIMIT 1
        ON CONFLICT (user_id, reward_id) DO UPDATE SET quantity = user_inventory.quantity + 1;
    END IF;

    -- 8. Add welcome notification
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
        v_new_user.id,
        'system',
        'Добро пожаловать в Lucky UC! 🎄',
        CASE WHEN v_is_vip 
            THEN 'Вам начислен статус VIP Администратора, 5000 UC, бесконечные спины и по 3 копии всех наград каталога! Счастливого Нового года!'
            ELSE 'Вы успешно зарегистрированы в новогодней платформе Lucky UC! Ожидайте начисления спинов от Администратора.'
        END
    );

    RETURN jsonb_build_object(
        'success', true,
        'user', row_to_json(v_new_user),
        'is_vip', v_is_vip,
        'is_admin', v_is_admin,
        'initial_uc', v_initial_uc
    );
END;
$$;

-- 6. UPDATE ATOMIC SPIN RPC FUNCTION (UNLIMITED SPINS FOR VIP/ADMIN)
CREATE OR REPLACE FUNCTION public.play_spin_atomic(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user RECORD;
    v_is_vip_admin BOOLEAN;
    v_reward RECORD;
    v_rand DOUBLE PRECISION;
    v_new_spins INTEGER;
    v_new_uc INTEGER;
    v_new_pop INTEGER;
BEGIN
    -- 1. Fetch user
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Пользователь не найден');
    END IF;

    IF v_user.is_blocked THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ваш аккаунт заблокирован');
    END IF;

    v_is_vip_admin := (v_user.is_vip = TRUE AND v_user.is_admin = TRUE);

    -- 2. Verify spin balance (UNLIMITED FOR VIP/ADMIN)
    IF NOT v_is_vip_admin THEN
        IF (v_user.free_spins_balance <= 0) THEN
            RETURN jsonb_build_object('success', false, 'error', 'У вас закончились бесплатные вращения!');
        END IF;
    END IF;

    -- 3. Weighted RNG reward selection
    v_rand := random() * 100.0;
    IF v_rand < 40.0 THEN
        SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity = 'common' ORDER BY random() LIMIT 1;
    ELSIF v_rand < 70.0 THEN
        SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity = 'rare' ORDER BY random() LIMIT 1;
    ELSIF v_rand < 90.0 THEN
        SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity = 'epic' ORDER BY random() LIMIT 1;
    ELSIF v_rand < 98.0 THEN
        SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity = 'legendary' ORDER BY random() LIMIT 1;
    ELSE
        SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity = 'mythic' ORDER BY random() LIMIT 1;
    END IF;

    IF v_reward.id IS NULL THEN
        SELECT * INTO v_reward FROM public.rewards_catalog ORDER BY random() LIMIT 1;
    END IF;

    -- 4. Calculate balances
    v_new_uc := v_user.total_uc;
    v_new_pop := v_user.total_popularity;

    IF v_is_vip_admin THEN
        -- VIP balances NEVER decrement
        v_new_spins := v_user.free_spins_balance;
        IF v_reward.category = 'spins' THEN
            v_new_spins := v_new_spins + v_reward.value;
        END IF;
    ELSE
        -- Standard players decrement by 1
        v_new_spins := v_user.free_spins_balance - 1;
        IF v_reward.category = 'spins' THEN
            v_new_spins := v_new_spins + v_reward.value;
        END IF;
    END IF;

    IF v_reward.category = 'uc' THEN
        v_new_uc := v_new_uc + v_reward.value;
    ELSIF v_reward.category = 'popularity' THEN
        v_new_pop := v_new_pop + v_reward.value;
    END IF;

    -- 5. Update user state
    UPDATE public.users
    SET free_spins_balance = v_new_spins,
        total_uc = v_new_uc,
        total_popularity = v_new_pop,
        spins_count = spins_count + 1,
        updated_at = NOW()
    WHERE id = v_user.id;

    -- 6. Add reward to inventory
    INSERT INTO public.user_inventory (user_id, reward_id, quantity, acquired_at)
    VALUES (v_user.id, v_reward.id, 1, NOW())
    ON CONFLICT (user_id, reward_id)
    DO UPDATE SET quantity = user_inventory.quantity + 1, updated_at = NOW();

    -- 7. Add spin history record
    INSERT INTO public.spins_history (user_id, reward_id, created_at)
    VALUES (v_user.id, v_reward.id, NOW());

    RETURN jsonb_build_object(
        'success', true,
        'reward', row_to_json(v_reward),
        'spins_left', v_new_spins,
        'total_spins', v_user.spins_count + 1,
        'total_uc', v_new_uc,
        'total_popularity', v_new_pop,
        'is_vip_admin', v_is_vip_admin
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_player_with_code_atomic TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.play_spin_atomic TO authenticated, service_role;
