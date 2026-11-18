-- ==============================================================================
-- LUCKY UC - Migration V7: Add 2 Additional VIP Accounts (Total 4 VIP Accounts)
-- 1. Add 2 new VIP registration codes: 'VIP7777M' and 'VIP9999K'.
-- 2. Expand total player slots from 12 to 14 (10 Standard + 4 VIP).
-- 3. Update register_player_with_code_atomic RPC function to enforce 14-slot limit.
-- 4. Guarantee identical VIP + Admin privileges, 5000 UC, unlimited spins,
--    golden animated profile frame, and 3x catalog seeding for all 4 VIP accounts.
-- ==============================================================================

-- 1. INSERT 2 NEW VIP REGISTRATION CODES
INSERT INTO public.registration_codes (code, type, is_used)
VALUES 
    ('VIP7777M', 'vip', FALSE),
    ('VIP9999K', 'vip', FALSE)
ON CONFLICT (code) DO NOTHING;

-- 2. UPDATE SYSTEM CONFIGURATION TO 14 SLOTS
INSERT INTO public.system_config (key, value)
VALUES ('max_player_slots', '{"max": 14}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = '{"max": 14}'::jsonb;

-- 3. UPDATE ATOMIC REGISTRATION RPC FUNCTION (14 SLOTS & 4 VIP ARCHITECTURE)
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

    -- 3. Verify total used codes cap (Max 14 slots: 10 Standard + 4 VIP)
    SELECT COUNT(*) INTO v_used_codes_count 
    FROM public.registration_codes 
    WHERE is_used = TRUE;

    IF v_used_codes_count >= 14 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Регистрация закрыта: все 14 игровых мест заняты.');
    END IF;

    -- 4. Configure VIP vs Standard parameters
    IF v_code_record.type = 'vip' THEN
        v_is_vip := TRUE;
        v_is_admin := TRUE;
        v_initial_uc := 5000;
    ELSE
        v_is_vip := FALSE;
        v_is_admin := FALSE;
        v_initial_uc := 0;
    END IF;

    -- 5. Insert user record with recovery_key_hash and password_hash
    INSERT INTO public.users (
        username,
        first_name,
        password_hash,
        recovery_key_hash,
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
        -- All 4 VIP/Admin accounts receive 3 copies of every catalog item!
        INSERT INTO public.user_inventory (user_id, reward_id, quantity, acquired_at)
        SELECT v_new_user.id, r.id, 3, NOW()
        FROM public.rewards_catalog r
        ON CONFLICT (user_id, reward_id)
        DO UPDATE SET quantity = GREATEST(public.user_inventory.quantity, 3);
    ELSE
        -- Standard players receive starter Christmas sticker
        INSERT INTO public.user_inventory (user_id, reward_id, quantity, acquired_at)
        SELECT v_new_user.id, r.id, 1, NOW()
        FROM public.rewards_catalog r
        WHERE r.slug = 'reward-xmas-sticker'
        ON CONFLICT (user_id, reward_id)
        DO UPDATE SET quantity = GREATEST(public.user_inventory.quantity, 1);
    END IF;

    -- 8. Add welcome notification
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        is_read,
        data
    ) VALUES (
        v_new_user.id,
        'system',
        CASE WHEN v_is_vip THEN 'Добро пожаловать, VIP-Администратор! 🎄👑' ELSE 'Добро пожаловать в Lucky UC! 🎄' END,
        CASE 
            WHEN v_is_vip THEN 'Вам присвоен статус VIP-Администратора: 5000 UC, неограниченные вращения, золотая рамка и полный доступ к панели управления!'
            ELSE 'Вы успешно зарегистрированы в новогодней акции! Вращайте праздничное колесо и получайте подарки.'
        END,
        FALSE,
        jsonb_build_object('event', 'welcome', 'is_vip', v_is_vip)
    );

    -- Return new user data with status
    RETURN jsonb_build_object(
        'success', true,
        'user', jsonb_build_object(
            'id', v_new_user.id,
            'username', v_new_user.username,
            'is_vip', v_new_user.is_vip,
            'is_admin', v_new_user.is_admin,
            'total_uc', v_new_user.total_uc,
            'free_spins_balance', v_new_user.free_spins_balance,
            'profile_frame', v_new_user.profile_frame,
            'vip_badge', v_new_user.vip_badge
        )
    );
END;
$$;

-- 4. ENSURE ALL 4 VIP ACCOUNTS HAVE UNIFIED VIP+ADMIN PERMISSIONS
UPDATE public.users u
SET is_vip = TRUE,
    is_admin = TRUE,
    profile_frame = 'vip_gold',
    vip_badge = 'VIP_ADMIN',
    free_spins_balance = GREATEST(COALESCE(u.free_spins_balance, 0), 999999)
FROM public.registration_codes rc
WHERE rc.used_by_user_id = u.id AND rc.type = 'vip';

-- Ensure 3 copies of every catalog item for any active VIP users
INSERT INTO public.user_inventory (user_id, reward_id, quantity, acquired_at)
SELECT u.id, r.id, 3, NOW()
FROM public.users u
CROSS JOIN public.rewards_catalog r
WHERE u.is_vip = TRUE
ON CONFLICT (user_id, reward_id)
DO UPDATE SET quantity = GREATEST(public.user_inventory.quantity, 3);
