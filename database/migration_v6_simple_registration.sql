-- ==============================================================================
-- LUCKY UC - Migration V6: Simple Registration & Passwordless Recovery Key
-- 1. Add recovery_key_hash column to public.users for passwordless account recovery.
-- 2. Update register_player_with_code_atomic to store recovery_key_hash.
-- 3. Preserve 12 total player slots (10 Standard + 2 VIP).
-- 4. Preserve Dual VIP+Admin architecture with 5000 UC and 3x catalog seeding.
-- ==============================================================================

-- 1. ADD RECOVERY KEY HASH COLUMN TO USERS
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS recovery_key_hash TEXT;

-- Synchronize existing password_hash to recovery_key_hash if empty
UPDATE public.users 
SET recovery_key_hash = password_hash 
WHERE recovery_key_hash IS NULL AND password_hash IS NOT NULL;

-- 2. UPDATE ATOMIC REGISTRATION RPC FUNCTION FOR SIMPLE REGISTRATION
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
