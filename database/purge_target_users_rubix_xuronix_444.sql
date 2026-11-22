-- ==============================================================================
-- LUCKY UC - STANDALONE SCRIPT: WIPE INVENTORY, UC, SPINS & BALANCES
-- TARGETS: rubix0, xuronix7 (xronix7), 444
--
-- Actions performed:
-- 1. Completely deletes all items from public.user_inventory
-- 2. Sets total_uc = 0, free_spins_balance = 0, spins_left = 0, daily_spins_count = 0
-- 3. Sets coins_balance = 0, points_balance = 0, active_title_id = NULL
-- 4. Clears purchases_history, gifts_history, spins_history, sales_history
-- 5. Preserves VIP / Admin status accounts if any match
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_target_user RECORD;
    v_purged_count INTEGER := 0;
BEGIN
    FOR v_target_user IN 
        SELECT id, username, is_admin, is_vip, coins_balance, points_balance, total_uc 
        FROM public.users 
        WHERE LOWER(TRIM(username)) IN ('rubix0', 'xronix7', 'xuronix7', '444')
    LOOP
        -- If account is VIP or ADMIN, skip completely and emit NOTICE
        IF v_target_user.is_admin IS TRUE 
           OR v_target_user.is_vip IS TRUE 
           OR LOWER(TRIM(v_target_user.username)) IN ('vip5000x', 'vip2026z', 'vip7777m', 'vip9999k', 'admin', 'adminvip', 'lucky_admin') THEN
            RAISE NOTICE 'ПРОПУСК: Аккаунт @% (%) защищен (VIP/ADMIN), очистка пропущена', 
                v_target_user.username, v_target_user.id;
            CONTINUE;
        END IF;

        -- 1. Delete all items from user_inventory
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_inventory' AND column_name = 'user_id') THEN
            DELETE FROM public.user_inventory WHERE user_id = v_target_user.id;
        END IF;

        -- 2. Delete history records
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gifts_history' AND column_name = 'sender_id') THEN
            DELETE FROM public.gifts_history WHERE sender_id = v_target_user.id OR recipient_id = v_target_user.id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'spins_history' AND column_name = 'user_id') THEN
            DELETE FROM public.spins_history WHERE user_id = v_target_user.id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases_history' AND column_name = 'user_id') THEN
            DELETE FROM public.purchases_history WHERE user_id = v_target_user.id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales_history' AND column_name = 'user_id') THEN
            DELETE FROM public.sales_history WHERE user_id = v_target_user.id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'user_id') THEN
            DELETE FROM public.notifications WHERE user_id = v_target_user.id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'action_logs' AND column_name = 'user_id') THEN
            DELETE FROM public.action_logs WHERE user_id = v_target_user.id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_connections' AND column_name = 'user_id') THEN
            DELETE FROM public.user_connections WHERE user_id = v_target_user.id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'popularity_transactions' AND column_name = 'user_id') THEN
            DELETE FROM public.popularity_transactions WHERE user_id = v_target_user.id;
        END IF;

        -- 3. Reset UC, coins, PP, title, and all spin balances to 0
        UPDATE public.users
        SET points_balance = 0,
            coins_balance = 0,
            total_uc = 0,
            active_title_id = NULL,
            updated_at = NOW()
        WHERE id = v_target_user.id;

        -- Safely reset spin columns to 0
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'total_popularity') THEN
            UPDATE public.users SET total_popularity = 0 WHERE id = v_target_user.id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'spins_count') THEN
            UPDATE public.users SET spins_count = 0 WHERE id = v_target_user.id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'spins_left') THEN
            UPDATE public.users SET spins_left = 0 WHERE id = v_target_user.id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'daily_spins_count') THEN
            UPDATE public.users SET daily_spins_count = 0 WHERE id = v_target_user.id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'free_spins_balance') THEN
            UPDATE public.users SET free_spins_balance = 0 WHERE id = v_target_user.id;
        END IF;

        v_purged_count := v_purged_count + 1;
        RAISE NOTICE 'УСПЕШНО ОЧИЩЕН: Аккаунт @% (ID: %) -> UC=0, Спины=0, Монеты=0, Инвентарь полностью удален.', 
            v_target_user.username, v_target_user.id;
    END LOOP;

    IF v_purged_count = 0 THEN
        RAISE NOTICE 'ИНФОРМАЦИЯ: Ни один целевой аккаунт (rubix0, xronix7, xuronix7, 444) не найден или защищен.';
    ELSE
        RAISE NOTICE 'ИТОГО: Успешно очищено аккаунтов: %', v_purged_count;
    END IF;
END $$;

COMMIT;
