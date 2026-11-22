-- ==============================================================================
-- LUCKY UC - MIGRATION V20: FULL APPLICATION AUDIT, SHOP PRICES, IP TRACKING,
-- ACCOUNT PURGE, AND CURRENCY RESETS WITH STRICT VIP/ADMIN PROTECTION
-- ==============================================================================
-- Transactions & Safety:
-- 1. Entire migration runs inside a single atomic transaction (BEGIN ... COMMIT).
-- 2. Pre-flight checks verify ALL required tables and specific columns before any change.
-- 3. Snapshots pre-migration VIP/Admin balances and user existence into a temp table.
--    Mathematically guarantees: zero change to Coins, PP (points_balance), or UC,
--    and guarantees that NO protected account is deleted or missing.
-- 4. Coins and PP are strictly separated: shop purchases deduct coins_balance ONLY,
--    and points_balance is NEVER overwritten or synced.
-- 5. No arbitrary fallback prices for rewards: all shop items require price_coins > 0.
-- 6. RPCs use SECURITY DEFINER with SET search_path = public, pg_temp.
-- 7. Anonymous (anon) access is revoked on sensitive mutating RPCs.
-- 8. IP logging uses PostgreSQL native inet validation and database check constraint.
-- 9. VIP and ADMIN accounts are permanently protected against delete and block.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. PRE-FLIGHT INTEGRITY CHECKS: VERIFY ALL REQUIRED TABLES AND COLUMNS
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_missing_items TEXT := '';
    v_users_count INTEGER;
    v_protected_count INTEGER;
    v_standard_count INTEGER;
    v_user_rec RECORD;
    v_rubix_status TEXT := 'НЕ НАЙДЕН';
    v_xronix_status TEXT := 'НЕ НАЙДЕН';
BEGIN
    -- 1. Check mandatory tables
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        v_missing_items := v_missing_items || ' [таблица public.users]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rewards_catalog') THEN
        v_missing_items := v_missing_items || ' [таблица public.rewards_catalog]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_inventory') THEN
        v_missing_items := v_missing_items || ' [таблица public.user_inventory]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchases_history') THEN
        v_missing_items := v_missing_items || ' [таблица public.purchases_history]';
    END IF;

    -- 2. Check essential columns on public.users
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id') THEN
        v_missing_items := v_missing_items || ' [users.id]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'username') THEN
        v_missing_items := v_missing_items || ' [users.username]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'coins_balance') THEN
        v_missing_items := v_missing_items || ' [users.coins_balance]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'points_balance') THEN
        v_missing_items := v_missing_items || ' [users.points_balance]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'total_uc') THEN
        v_missing_items := v_missing_items || ' [users.total_uc]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_admin') THEN
        v_missing_items := v_missing_items || ' [users.is_admin]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_vip') THEN
        v_missing_items := v_missing_items || ' [users.is_vip]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_blocked') THEN
        v_missing_items := v_missing_items || ' [users.is_blocked]';
    END IF;

    -- 3. Check essential columns on public.rewards_catalog
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rewards_catalog' AND column_name = 'id') THEN
        v_missing_items := v_missing_items || ' [rewards_catalog.id]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rewards_catalog' AND column_name = 'name') THEN
        v_missing_items := v_missing_items || ' [rewards_catalog.name]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rewards_catalog' AND column_name = 'category') THEN
        v_missing_items := v_missing_items || ' [rewards_catalog.category]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rewards_catalog' AND column_name = 'rarity') THEN
        v_missing_items := v_missing_items || ' [rewards_catalog.rarity]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rewards_catalog' AND column_name = 'is_title') THEN
        v_missing_items := v_missing_items || ' [rewards_catalog.is_title]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rewards_catalog' AND column_name = 'title_slug') THEN
        v_missing_items := v_missing_items || ' [rewards_catalog.title_slug]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rewards_catalog' AND column_name = 'icon_name') THEN
        v_missing_items := v_missing_items || ' [rewards_catalog.icon_name]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rewards_catalog' AND column_name = 'is_active') THEN
        v_missing_items := v_missing_items || ' [rewards_catalog.is_active]';
    END IF;

    -- 4. Check essential columns on public.user_inventory
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_inventory' AND column_name = 'user_id') THEN
        v_missing_items := v_missing_items || ' [user_inventory.user_id]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_inventory' AND column_name = 'reward_id') THEN
        v_missing_items := v_missing_items || ' [user_inventory.reward_id]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_inventory' AND column_name = 'quantity') THEN
        v_missing_items := v_missing_items || ' [user_inventory.quantity]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_inventory' AND column_name = 'acquired_at') THEN
        v_missing_items := v_missing_items || ' [user_inventory.acquired_at]';
    END IF;

    -- 5. Check essential columns on public.purchases_history
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases_history' AND column_name = 'user_id') THEN
        v_missing_items := v_missing_items || ' [purchases_history.user_id]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases_history' AND column_name = 'reward_id') THEN
        v_missing_items := v_missing_items || ' [purchases_history.reward_id]';
    END IF;

    -- 6. Check that all 57 canonical catalog rewards exist in public.rewards_catalog
    DECLARE
        v_catalog_check_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO v_catalog_check_count
        FROM public.rewards_catalog
        WHERE id IN (
            '10000000-0000-0000-0000-000000000051', '10000000-0000-0000-0000-000000000052',
            '10000000-0000-0000-0000-000000000053', '10000000-0000-0000-0000-000000000054',
            '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
            '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004',
            '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000006',
            '10000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000008',
            '10000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000010',
            '10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000012',
            '10000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000014',
            '10000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000061',
            '10000000-0000-0000-0000-000000000062', '10000000-0000-0000-0000-000000000063',
            '10000000-0000-0000-0000-000000000064', '10000000-0000-0000-0000-000000000065',
            '10000000-0000-0000-0000-000000000071', '10000000-0000-0000-0000-000000000072',
            '10000000-0000-0000-0000-000000000073', '10000000-0000-0000-0000-000000000074',
            '10000000-0000-0000-0000-000000000075', '10000000-0000-0000-0000-000000000076',
            '10000000-0000-0000-0000-000000000077', '10000000-0000-0000-0000-000000000078',
            '10000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000017',
            '10000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000019',
            '10000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000021',
            '10000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000023',
            '10000000-0000-0000-0000-000000000024', '10000000-0000-0000-0000-000000000025',
            '10000000-0000-0000-0000-000000000031', '10000000-0000-0000-0000-000000000032',
            '10000000-0000-0000-0000-000000000033', '10000000-0000-0000-0000-000000000034',
            '10000000-0000-0000-0000-000000000035', '10000000-0000-0000-0000-000000000038',
            '10000000-0000-0000-0000-000000000036', '10000000-0000-0000-0000-000000000037',
            '10000000-0000-0000-0000-000000000039', '10000000-0000-0000-0000-000000000040',
            '10000000-0000-0000-0000-000000000041', '10000000-0000-0000-0000-000000000042',
            '10000000-0000-0000-0000-000000000043', '10000000-0000-0000-0000-000000000044',
            '10000000-0000-0000-0000-000000000045'
        );

        IF v_catalog_check_count < 57 THEN
            v_missing_items := v_missing_items || format(' [В rewards_catalog найдено только %s из 57 обязательных предметов каталога]', v_catalog_check_count);
        END IF;
    END;

    -- Stop immediately if anything mandatory is missing
    IF v_missing_items <> '' THEN
        RAISE EXCEPTION 'КРИТИЧЕСКАЯ ОШИБКА ПРЕДВАРИТЕЛЬНОГО АУДИТА: Отсутствуют обязательные элементы схемы базы данных:%! Миграция остановлена до внесения любых изменений.', v_missing_items;
    END IF;

    SELECT COUNT(*) INTO v_users_count FROM public.users;

    -- Count protected accounts (VIP, ADMIN, and protected usernames)
    SELECT COUNT(*) INTO v_protected_count 
    FROM public.users 
    WHERE is_vip IS TRUE 
       OR is_admin IS TRUE 
       OR LOWER(TRIM(username)) IN ('vip5000x', 'vip2026z', 'vip7777m', 'vip9999k', 'admin', 'adminvip', 'lucky_admin');

    -- Count standard accounts eligible for PP/UC reset
    SELECT COUNT(*) INTO v_standard_count 
    FROM public.users 
    WHERE is_vip IS NOT TRUE 
      AND is_admin IS NOT TRUE 
      AND LOWER(TRIM(username)) NOT IN ('vip5000x', 'vip2026z', 'vip7777m', 'vip9999k', 'admin', 'adminvip', 'lucky_admin');

    RAISE NOTICE '================================================================';
    RAISE NOTICE 'ПРЕДВАРИТЕЛЬНЫЙ АУДИТ БАЗЫ ДАННЫХ (PRE-FLIGHT AUDIT):';
    RAISE NOTICE 'Всего аккаунтов в public.users: %', v_users_count;
    RAISE NOTICE 'Защищенных аккаунтов (VIP / Admin): %', v_protected_count;
    RAISE NOTICE 'Обычных аккаунтов для сброса PP и UC: %', v_standard_count;
    RAISE NOTICE '----------------------------------------------------------------';
    RAISE NOTICE 'СПИСОК ОБНАРУЖЕННЫХ ЗАЩИЩЕННЫХ АККАУНТОВ:';

    FOR v_user_rec IN 
        SELECT id, username, is_admin, is_vip, coins_balance, points_balance, total_uc 
        FROM public.users 
        WHERE is_vip IS TRUE 
           OR is_admin IS TRUE 
           OR LOWER(TRIM(username)) IN ('vip5000x', 'vip2026z', 'vip7777m', 'vip9999k', 'admin', 'adminvip', 'lucky_admin')
        ORDER BY username
    LOOP
        RAISE NOTICE '  * @% (ID: %, Admin: %, VIP: %, Coins: %, PP: %, UC: %)',
            v_user_rec.username, v_user_rec.id, v_user_rec.is_admin, v_user_rec.is_vip,
            v_user_rec.coins_balance, v_user_rec.points_balance, v_user_rec.total_uc;
    END LOOP;

    -- Audit status of target purge accounts (rubix0, xronix7, xuronix7, 444)
    FOR v_user_rec IN 
        SELECT id, username, is_admin, is_vip, coins_balance, points_balance, total_uc 
        FROM public.users 
        WHERE LOWER(TRIM(username)) IN ('rubix0', 'xronix7', 'xuronix7', '444')
    LOOP
        RAISE NOTICE 'Статус целевого аккаунта @%: Найден (ID: %, Admin: %, VIP: %, Coins: %, PP: %, UC: %)',
            v_user_rec.username, v_user_rec.id, v_user_rec.is_admin, v_user_rec.is_vip,
            v_user_rec.coins_balance, v_user_rec.points_balance, v_user_rec.total_uc;
    END LOOP;
    RAISE NOTICE '================================================================';
END $$;

-- ------------------------------------------------------------------------------
-- 0.1. CREATE TEMPORARY SNAPSHOT TABLE OF PRE-MIGRATION VIP/ADMIN BALANCES & EXISTENCE
-- ------------------------------------------------------------------------------
-- This temporary table will be automatically dropped on COMMIT.
CREATE TEMP TABLE _pre_migration_vip_admin_balances ON COMMIT DROP AS
SELECT 
    id,
    username,
    COALESCE(coins_balance, 0) AS coins_balance,
    COALESCE(points_balance, 0) AS points_balance,
    COALESCE(total_uc, 0) AS total_uc,
    is_vip,
    is_admin
FROM public.users
WHERE is_vip IS TRUE 
   OR is_admin IS TRUE 
   OR LOWER(TRIM(username)) IN ('vip5000x', 'vip2026z', 'vip7777m', 'vip9999k', 'admin', 'adminvip', 'lucky_admin');

-- ------------------------------------------------------------------------------
-- 0.2. SAFE INVENTORY DEDUPLICATION & UNIQUE CONSTRAINT ENFORCEMENT
-- ------------------------------------------------------------------------------
ALTER TABLE public.user_inventory 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
DECLARE
    v_dup_count INTEGER;
BEGIN
    -- Check for duplicate (user_id, reward_id) rows in user_inventory
    SELECT COUNT(*) INTO v_dup_count
    FROM (
        SELECT user_id, reward_id
        FROM public.user_inventory
        GROUP BY user_id, reward_id
        HAVING COUNT(*) > 1
    ) d;

    IF v_dup_count > 0 THEN
        RAISE NOTICE 'Обнаружено % дублирующихся пар (user_id, reward_id) в user_inventory. Выполняется безопасное объединение...', v_dup_count;

        -- Step A: Merge quantities into the first row of each duplicate group
        WITH merged_dups AS (
            SELECT 
                user_id, 
                reward_id, 
                SUM(quantity) AS total_quantity,
                MIN(acquired_at) AS earliest_acquired,
                MAX(COALESCE(updated_at, acquired_at)) AS latest_updated,
                (ARRAY_AGG(ctid))[1] AS keep_ctid
            FROM public.user_inventory
            GROUP BY user_id, reward_id
            HAVING COUNT(*) > 1
        )
        UPDATE public.user_inventory inv
        SET 
            quantity = m.total_quantity,
            acquired_at = m.earliest_acquired,
            updated_at = m.latest_updated
        FROM merged_dups m
        WHERE inv.ctid = m.keep_ctid;

        -- Step B: Delete the redundant duplicate rows
        WITH merged_dups AS (
            SELECT 
                user_id, 
                reward_id, 
                (ARRAY_AGG(ctid))[1] AS keep_ctid
            FROM public.user_inventory
            GROUP BY user_id, reward_id
            HAVING COUNT(*) > 1
        )
        DELETE FROM public.user_inventory inv
        USING merged_dups m
        WHERE inv.user_id = m.user_id 
          AND inv.reward_id = m.reward_id 
          AND inv.ctid <> m.keep_ctid;

        RAISE NOTICE 'Дубликаты user_inventory успешно объединены и очищены.';
    END IF;

    -- Ensure UNIQUE constraint uq_user_reward exists on user_inventory(user_id, reward_id)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uq_user_reward' 
          AND conrelid = 'public.user_inventory'::regclass
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'user_inventory' 
          AND indexdef LIKE '%UNIQUE%(user_id, reward_id)%'
    ) THEN
        ALTER TABLE public.user_inventory 
        ADD CONSTRAINT uq_user_reward UNIQUE (user_id, reward_id);
        RAISE NOTICE 'Ограничение UNIQUE (user_id, reward_id) успешно создано на user_inventory.';
    END IF;
END $$;

ALTER TABLE public.purchases_history 
ADD COLUMN IF NOT EXISTS cost_coins INTEGER NOT NULL DEFAULT 0;

-- ------------------------------------------------------------------------------
-- 1. ADD AND POPULATE EXPLICIT PRICE COLUMNS IN REWARDS_CATALOG
-- ------------------------------------------------------------------------------
ALTER TABLE public.rewards_catalog 
ADD COLUMN IF NOT EXISTS price_coins INTEGER,
ADD COLUMN IF NOT EXISTS price_points INTEGER;

-- 1.1. Roulette & Special Non-Shop Items (Explicitly NULL prices)
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000051'; -- 25 Монет (Рулетка)
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000052'; -- 50 Монет (Рулетка)
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000053'; -- 75 Монет (Рулетка)
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000054'; -- 125 Монет (Рулетка)
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000001'; -- 30 UC (Исключен из покупок)
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000002'; -- 60 UC (Исключен из покупок)
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000017'; -- Титул VIP (Исключен)

-- 1.2. Popularity Items (Explicit Coin & Point Prices)
UPDATE public.rewards_catalog SET price_coins = 25, price_points = 25 WHERE id = '10000000-0000-0000-0000-000000000003';   -- 10 популярности
UPDATE public.rewards_catalog SET price_coins = 60, price_points = 60 WHERE id = '10000000-0000-0000-0000-000000000004';   -- 25 популярности
UPDATE public.rewards_catalog SET price_coins = 160, price_points = 160 WHERE id = '10000000-0000-0000-0000-000000000005'; -- 50 популярности
UPDATE public.rewards_catalog SET price_coins = 480, price_points = 480 WHERE id = '10000000-0000-0000-0000-000000000006'; -- 100 популярности

-- 1.3. Roses & Bouquets
UPDATE public.rewards_catalog SET price_coins = 20, price_points = 20 WHERE id = '10000000-0000-0000-0000-000000000007';   -- Одна роза
UPDATE public.rewards_catalog SET price_coins = 120, price_points = 120 WHERE id = '10000000-0000-0000-0000-000000000008'; -- Букет роз
UPDATE public.rewards_catalog SET price_coins = 550, price_points = 550 WHERE id = '10000000-0000-0000-0000-000000000009'; -- Большой букет роз

-- 1.4. Spins
UPDATE public.rewards_catalog SET price_coins = 75, price_points = 75 WHERE id = '10000000-0000-0000-0000-000000000010';   -- +1 вращение
UPDATE public.rewards_catalog SET price_coins = 140, price_points = 140 WHERE id = '10000000-0000-0000-0000-000000000011'; -- +2 вращения

-- 1.5. Titles
UPDATE public.rewards_catalog SET price_coins = 250, price_points = 250 WHERE id = '10000000-0000-0000-0000-000000000012';   -- СОСУН
UPDATE public.rewards_catalog SET price_coins = 350, price_points = 350 WHERE id = '10000000-0000-0000-0000-000000000013';   -- ВОЗДУХАН
UPDATE public.rewards_catalog SET price_coins = 750, price_points = 750 WHERE id = '10000000-0000-0000-0000-000000000014';   -- КОРОЛЬ
UPDATE public.rewards_catalog SET price_coins = 750, price_points = 750 WHERE id = '10000000-0000-0000-0000-000000000015';   -- КОРОЛЕВА
UPDATE public.rewards_catalog SET price_coins = 1200, price_points = 1200 WHERE id = '10000000-0000-0000-0000-000000000061'; -- ФЕНИКС
UPDATE public.rewards_catalog SET price_coins = 1350, price_points = 1350 WHERE id = '10000000-0000-0000-0000-000000000062'; -- ПРИЗРАК
UPDATE public.rewards_catalog SET price_coins = 1500, price_points = 1500 WHERE id = '10000000-0000-0000-0000-000000000063'; -- ДОМИНАТОР
UPDATE public.rewards_catalog SET price_coins = 1650, price_points = 1650 WHERE id = '10000000-0000-0000-0000-000000000064'; -- ТИТАН
UPDATE public.rewards_catalog SET price_coins = 2800, price_points = 2800 WHERE id = '10000000-0000-0000-0000-000000000065'; -- ОВЕРЛОРД
UPDATE public.rewards_catalog SET price_coins = 300, price_points = 300 WHERE id = '10000000-0000-0000-0000-000000000071';   -- ТЕРПИЛЛА
UPDATE public.rewards_catalog SET price_coins = 350, price_points = 350 WHERE id = '10000000-0000-0000-0000-000000000072';   -- ПОДСОС
UPDATE public.rewards_catalog SET price_coins = 3000, price_points = 3000 WHERE id = '10000000-0000-0000-0000-000000000073'; -- САНТА
UPDATE public.rewards_catalog SET price_coins = 800, price_points = 800 WHERE id = '10000000-0000-0000-0000-000000000074';   -- FEMBOY
UPDATE public.rewards_catalog SET price_coins = 450, price_points = 450 WHERE id = '10000000-0000-0000-0000-000000000075';   -- NEFOR
UPDATE public.rewards_catalog SET price_coins = 150, price_points = 150 WHERE id = '10000000-0000-0000-0000-000000000076';   -- BALBIBOL
UPDATE public.rewards_catalog SET price_coins = 2200, price_points = 2200 WHERE id = '10000000-0000-0000-0000-000000000077'; -- ИМПЕРАТОР
UPDATE public.rewards_catalog SET price_coins = 5500, price_points = 5500 WHERE id = '10000000-0000-0000-0000-000000000078'; -- ДЕМИУРГ
UPDATE public.rewards_catalog SET price_coins = 5000, price_points = 5000 WHERE id = '10000000-0000-0000-0000-000000000016'; -- КИБОРГ

-- 1.6. Jokes & Gifts
UPDATE public.rewards_catalog SET price_coins = 2600, price_points = 2600 WHERE id = '10000000-0000-0000-0000-000000000018'; -- Золотая соска
UPDATE public.rewards_catalog SET price_coins = 500, price_points = 500 WHERE id = '10000000-0000-0000-0000-000000000019';   -- Серебряная соска
UPDATE public.rewards_catalog SET price_coins = 200, price_points = 200 WHERE id = '10000000-0000-0000-0000-000000000020';   -- Бронзовая соска
UPDATE public.rewards_catalog SET price_coins = 600, price_points = 600 WHERE id = '10000000-0000-0000-0000-000000000021';   -- Кубок
UPDATE public.rewards_catalog SET price_coins = 70, price_points = 70 WHERE id = '10000000-0000-0000-0000-000000000022';     -- Трусы деда
UPDATE public.rewards_catalog SET price_coins = 85, price_points = 85 WHERE id = '10000000-0000-0000-0000-000000000023';     -- Трусы Андрея
UPDATE public.rewards_catalog SET price_coins = 180, price_points = 180 WHERE id = '10000000-0000-0000-0000-000000000024';   -- Соска Зама
UPDATE public.rewards_catalog SET price_coins = 15, price_points = 15 WHERE id = '10000000-0000-0000-0000-000000000025';     -- Позор дня

-- 1.7. Christmas & Winter Theme Items
UPDATE public.rewards_catalog SET price_coins = 30, price_points = 30 WHERE id = '10000000-0000-0000-0000-000000000031';   -- Новогодний стикер
UPDATE public.rewards_catalog SET price_coins = 40, price_points = 40 WHERE id = '10000000-0000-0000-0000-000000000032';   -- Значок Снежинка
UPDATE public.rewards_catalog SET price_coins = 50, price_points = 50 WHERE id = '10000000-0000-0000-0000-000000000033';   -- Леденец-Трость
UPDATE public.rewards_catalog SET price_coins = 90, price_points = 90 WHERE id = '10000000-0000-0000-0000-000000000034';   -- Новогодняя аватарка
UPDATE public.rewards_catalog SET price_coins = 110, price_points = 110 WHERE id = '10000000-0000-0000-0000-000000000035'; -- Зимняя рамка профиля
UPDATE public.rewards_catalog SET price_coins = 130, price_points = 130 WHERE id = '10000000-0000-0000-0000-000000000038'; -- Значок Оленёнок
UPDATE public.rewards_catalog SET price_coins = 220, price_points = 220 WHERE id = '10000000-0000-0000-0000-000000000036'; -- Снежный шар
UPDATE public.rewards_catalog SET price_coins = 280, price_points = 280 WHERE id = '10000000-0000-0000-0000-000000000037'; -- Подарок Санты
UPDATE public.rewards_catalog SET price_coins = 340, price_points = 340 WHERE id = '10000000-0000-0000-0000-000000000039'; -- Золотой колокольчик
UPDATE public.rewards_catalog SET price_coins = 420, price_points = 420 WHERE id = '10000000-0000-0000-0000-000000000040'; -- Рождественский сундук
UPDATE public.rewards_catalog SET price_coins = 680, price_points = 680 WHERE id = '10000000-0000-0000-0000-000000000041'; -- Волшебная снежинка
UPDATE public.rewards_catalog SET price_coins = 800, price_points = 800 WHERE id = '10000000-0000-0000-0000-000000000042'; -- Золотая ёлочка
UPDATE public.rewards_catalog SET price_coins = 950, price_points = 950 WHERE id = '10000000-0000-0000-0000-000000000043'; -- Аватар Ледяного дракона
UPDATE public.rewards_catalog SET price_coins = 2800, price_points = 2800 WHERE id = '10000000-0000-0000-0000-000000000044'; -- Золотые сани Санты
UPDATE public.rewards_catalog SET price_coins = 5500, price_points = 5500 WHERE id = '10000000-0000-0000-0000-000000000045'; -- Шкатулка Рождественского чуда

-- ------------------------------------------------------------------------------
-- 2. REVISE PURCHASE_ITEM_ATOMIC: AUTHORITATIVE COIN DEDUCTION (NO PP CORRUPTION)
-- ------------------------------------------------------------------------------
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
    v_total_cost_bigint BIGINT;
    v_is_admin BOOLEAN;
    v_item_type TEXT;
    v_current_coins INTEGER;
    v_new_coins INTEGER;
    v_final_quantity INTEGER := 0;
    v_match_count INTEGER := 0;
    v_clean_slug TEXT;
    v_stripped_slug TEXT;
BEGIN
    -- 1. Security: Block unauthenticated or anon callers completely (fail-closed)
    IF (auth.role() IS NULL) OR (auth.role() = 'anon') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Требуется авторизация для совершения покупок');
    END IF;

    -- Security: Authenticated caller can only purchase items for their own account
    IF auth.role() = 'authenticated' THEN
        IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'Вы можете совершать покупки только для своего аккаунта');
        END IF;
    ELSIF (auth.jwt() ->> 'role') IS NOT DISTINCT FROM 'service_role' OR current_user = 'postgres' THEN
        NULL;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Неавторизованный вызов функции покупки');
    END IF;

    -- 2. Input validation: quantity must be between 1 and 100
    IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 100 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Недопустимое количество предметов для покупки (разрешено от 1 до 100)');
    END IF;

    IF p_item_slug IS NULL OR TRIM(p_item_slug) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Укажите идентификатор товара');
    END IF;

    v_clean_slug := TRIM(p_item_slug);
    v_stripped_slug := REGEXP_REPLACE(v_clean_slug, '^(title-|reward-|gift-)', '', 'i');

    -- 3. Lock user record to prevent race conditions and concurrent double-spend
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

    v_is_admin := (v_user.is_admin IS TRUE);

    -- 4. STRICT EXCLUSION CHECK: UC VIP and direct UC rewards cannot be bought for Coins
    IF LOWER(v_clean_slug) IN ('reward-uc-30', 'reward-uc-60', 'title-vip', 'vip')
       OR LOWER(v_clean_slug) LIKE '%uc%vip%'
       OR LOWER(v_clean_slug) LIKE '%vip%uc%' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Товар UC VIP полностью исключен из покупок за монеты');
    END IF;

    -- 5. Locate reward in rewards_catalog with strict unambiguous lookup hierarchy
    -- 5.1: If input matches UUID format, check exact UUID first
    IF v_clean_slug ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT COUNT(*) INTO v_match_count
        FROM public.rewards_catalog
        WHERE id = v_clean_slug::UUID AND is_active = TRUE;

        IF v_match_count > 1 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Неоднозначность поиска: найдено несколько товаров с одинаковым UUID');
        ELSIF v_match_count = 1 THEN
            SELECT * INTO v_reward 
            FROM public.rewards_catalog 
            WHERE id = v_clean_slug::UUID AND is_active = TRUE;
        END IF;
    END IF;

    -- 5.2: If not found by UUID, try exact title_slug match
    IF v_reward.id IS NULL THEN
        SELECT COUNT(*) INTO v_match_count
        FROM public.rewards_catalog 
        WHERE (
            LOWER(title_slug) = LOWER(v_clean_slug)
            OR LOWER(title_slug) = LOWER(v_stripped_slug)
            OR LOWER(CONCAT('title-', title_slug)) = LOWER(v_clean_slug)
            OR LOWER(CONCAT('reward-', title_slug)) = LOWER(v_clean_slug)
        )
        AND is_active = TRUE;

        IF v_match_count > 1 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Неоднозначность поиска: найдено несколько товаров с данным slug');
        ELSIF v_match_count = 1 THEN
            SELECT * INTO v_reward 
            FROM public.rewards_catalog 
            WHERE (
                LOWER(title_slug) = LOWER(v_clean_slug)
                OR LOWER(title_slug) = LOWER(v_stripped_slug)
                OR LOWER(CONCAT('title-', title_slug)) = LOWER(v_clean_slug)
                OR LOWER(CONCAT('reward-', title_slug)) = LOWER(v_clean_slug)
            )
            AND is_active = TRUE;
        END IF;
    END IF;

    -- 5.3: If not found by slug, try exact name match
    IF v_reward.id IS NULL THEN
        SELECT COUNT(*) INTO v_match_count
        FROM public.rewards_catalog 
        WHERE (
            LOWER(name) = LOWER(v_clean_slug)
            OR LOWER(name) = LOWER(v_stripped_slug)
        )
        AND is_active = TRUE;

        IF v_match_count > 1 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Неоднозначность поиска: найдено несколько товаров с данным названием');
        ELSIF v_match_count = 1 THEN
            SELECT * INTO v_reward 
            FROM public.rewards_catalog 
            WHERE (
                LOWER(name) = LOWER(v_clean_slug)
                OR LOWER(name) = LOWER(v_stripped_slug)
            )
            AND is_active = TRUE;
        END IF;
    END IF;

    IF v_reward.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Товар не найден в каталоге наград');
    END IF;

    -- Extra safety check for UC category or VIP name
    IF COALESCE(v_reward.category::text, '') = 'uc' 
       OR LOWER(v_reward.name) = 'vip' 
       OR LOWER(v_reward.name) LIKE '%uc vip%' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Данный товар (UC VIP) недоступен для покупки в магазине');
    END IF;

    -- Determine item type (title or gift)
    IF v_reward.is_title IS TRUE OR LOWER(COALESCE(v_reward.category::text, '')) = 'titles' THEN
        v_item_type := 'title';
    ELSE
        v_item_type := 'gift';
    END IF;

    -- 6. AUTHORITATIVE PRICE DETERMINATION (NO ARBITRARY FALLBACKS!)
    -- Regardless of whether category is NULL or text, price_coins MUST be strictly > 0
    IF v_reward.price_coins IS NULL OR v_reward.price_coins <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Данный товар недоступен для покупки в магазине (цена не установлена)');
    END IF;

    v_unit_cost := v_reward.price_coins;

    -- 7. Cost Calculation: Admin is 0 cost, non-admin pays unit_cost * p_quantity
    -- Overflow protection: check using BIGINT arithmetic before casting to integer
    IF v_is_admin THEN
        v_total_cost := 0;
    ELSE
        v_total_cost_bigint := (v_unit_cost::BIGINT) * (p_quantity::BIGINT);
        IF v_total_cost_bigint > 2147483647 OR v_total_cost_bigint < 0 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Превышен максимальный лимит стоимости операции');
        END IF;
        v_total_cost := v_total_cost_bigint::INTEGER;
    END IF;

    -- 8. Balance Verification & Deduction (COINS ONLY! NEVER TOUCH OR SYNC points_balance!)
    v_current_coins := COALESCE(v_user.coins_balance, 0);

    IF NOT v_is_admin AND v_current_coins < v_total_cost THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', format('Недостаточно Монет для покупки. Требуется: %s, доступно: %s', v_total_cost, v_current_coins),
            'required_coins', v_total_cost,
            'current_coins', v_current_coins,
            'requiredCoins', v_total_cost,
            'currentCoins', v_current_coins
        );
    END IF;

    IF v_is_admin THEN
        v_new_coins := v_current_coins;
    ELSE
        v_new_coins := v_current_coins - v_total_cost;
    END IF;

    -- UPDATE ONLY coins_balance! DO NOT OVERWRITE points_balance!
    UPDATE public.users 
    SET 
        coins_balance = v_new_coins,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- 9. Add Item / Title to User Inventory
    INSERT INTO public.user_inventory (
        user_id,
        reward_id,
        quantity,
        acquired_at,
        updated_at
    )
    VALUES (
        p_user_id,
        v_reward.id,
        p_quantity,
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id, reward_id) 
    DO UPDATE SET 
        quantity = public.user_inventory.quantity + EXCLUDED.quantity,
        updated_at = NOW()
    RETURNING quantity INTO v_final_quantity;

    -- 10. Record Purchase History (cost_coins = v_total_cost, cost_points = 0)
    INSERT INTO public.purchases_history (
        user_id,
        reward_id,
        item_type,
        item_name,
        item_slug,
        cost_coins,
        cost_points,
        quantity,
        is_admin_purchase,
        created_at
    )
    VALUES (
        p_user_id,
        v_reward.id,
        v_item_type,
        v_reward.name,
        COALESCE(v_reward.title_slug, v_reward.id::text),
        v_total_cost,
        0,
        p_quantity,
        v_is_admin,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'item', jsonb_build_object(
            'id', v_reward.id,
            'name', v_reward.name,
            'rarity', v_reward.rarity,
            'category', v_reward.category,
            'item_type', v_item_type,
            'title_slug', v_reward.title_slug,
            'icon', v_reward.icon_name,
            'is_title', (v_item_type = 'title')
        ),
        'quantity', p_quantity,
        'final_inventory_quantity', v_final_quantity,
        'cost_coins', v_total_cost,
        'coins_spent', v_total_cost,
        'cost_points', 0,
        'points_spent', 0,
        'coins_balance', v_new_coins,
        'new_coins_balance', v_new_coins,
        'points_balance', v_user.points_balance,
        'new_points_balance', v_user.points_balance,
        'is_admin', v_is_admin,
        'is_admin_purchase', v_is_admin
    );
END;
$$;

-- Permissions for purchase_item_atomic: anon cannot execute!
REVOKE ALL ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. PLAYER IP TRACKING & CONNECTION HISTORY TABLE (WITH MANDATORY POSTGRESQL INET CHECK)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    connections_count INTEGER NOT NULL DEFAULT 1,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure strict inet validation on ip_address at database level (NO EXCEPTION suppression!)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'user_connections' 
          AND constraint_name = 'chk_user_connections_valid_ip'
    ) THEN
        ALTER TABLE public.user_connections 
        ADD CONSTRAINT chk_user_connections_valid_ip 
        CHECK (ip_address = host(ip_address::inet));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_connections_user_id ON public.user_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_username ON public.user_connections(username);
CREATE INDEX IF NOT EXISTS idx_user_connections_ip ON public.user_connections(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_connections_last_seen ON public.user_connections(last_seen_at DESC);

-- Enable RLS on user_connections
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view connection history" ON public.user_connections;
DROP POLICY IF EXISTS "Service role can manage connection history" ON public.user_connections;

-- Allow ONLY administrators (via authenticated session) and service_role to view connection history
CREATE POLICY "Admins can view connection history"
    ON public.user_connections
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
              AND users.is_admin = TRUE
        )
    );

CREATE POLICY "Service role can manage connection history"
    ON public.user_connections
    FOR ALL
    TO service_role
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Strict permissions: regular users cannot read, insert, update or delete user_connections directly
REVOKE ALL ON public.user_connections FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_connections FROM authenticated;
GRANT SELECT ON public.user_connections TO authenticated;
GRANT ALL ON public.user_connections TO service_role;

-- ------------------------------------------------------------------------------
-- 3.1. ATOMIC RPC: log_user_connection (POSTGRESQL INET VALIDATION & SERVICE_ROLE ONLY)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_user_connection(
    p_user_id UUID,
    p_username TEXT DEFAULT NULL,
    p_ip TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing_id UUID;
    v_clean_ip TEXT;
    v_target_user RECORD;
    v_real_username TEXT;
BEGIN
    -- 1. Security check: Only service_role or superuser can log connection history!
    IF auth.role() IS NOT NULL AND auth.role() IN ('anon', 'authenticated') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Прямой вызов запрещен. Доступ только у доверенного сервера');
    END IF;

    IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' AND current_user <> 'postgres' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Доступ разрешен только доверенному серверу');
    END IF;

    IF p_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User ID обязателен');
    END IF;

    -- 2. Verify target user in database & derive real username (prevents spoofing)
    SELECT id, username INTO v_target_user 
    FROM public.users 
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Пользователь не найден в базе данных');
    END IF;

    v_real_username := v_target_user.username;

    -- 3. Strict IP validation using native PostgreSQL INET parser (NO fake 127.0.0.1 substitute!)
    IF p_ip IS NULL OR TRIM(p_ip) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'IP-адрес не может быть пустым');
    END IF;

    BEGIN
        -- host(inet) validates IPv4 / IPv6, strips any CIDR mask, rejects malformed IPs/injections
        v_clean_ip := host(TRIM(p_ip)::inet);
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'Недопустимый сетевой IP-адрес (валидация PostgreSQL inet не пройдена)');
    END;

    -- 4. Deduplication: Check for connection within the last 15 minutes
    SELECT id INTO v_existing_id
    FROM public.user_connections
    WHERE user_id = p_user_id
      AND ip_address = v_clean_ip
      AND last_seen_at > (NOW() - INTERVAL '15 minutes')
    ORDER BY last_seen_at DESC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        UPDATE public.user_connections
        SET 
            connections_count = connections_count + 1,
            last_seen_at = NOW(),
            user_agent = COALESCE(p_user_agent, user_agent)
        WHERE id = v_existing_id;

        RETURN jsonb_build_object('success', true, 'action', 'updated', 'connection_id', v_existing_id);
    ELSE
        INSERT INTO public.user_connections (
            user_id,
            username,
            ip_address,
            user_agent,
            connections_count,
            first_seen_at,
            last_seen_at
        )
        VALUES (
            p_user_id,
            v_real_username,
            v_clean_ip,
            p_user_agent,
            1,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_existing_id;

        RETURN jsonb_build_object('success', true, 'action', 'inserted', 'connection_id', v_existing_id);
    END IF;
END;
$$;

-- Restrict execution strictly to service_role:
REVOKE ALL ON FUNCTION public.log_user_connection(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_user_connection(UUID, TEXT, TEXT, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 4. ADMIN ACCOUNT MANAGEMENT: CASCADE DELETE & TOGGLE BLOCK WITH VIP PROTECTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_user_atomic(
    p_admin_id UUID,
    p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_admin RECORD;
    v_target RECORD;
    v_target_username TEXT;
    v_fk_rec RECORD;
BEGIN
    -- 1. Security: Block unauthenticated or anon callers completely (fail-closed)
    IF (auth.role() IS NULL) OR (auth.role() = 'anon') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Требуется авторизация администратора');
    END IF;

    IF auth.role() = 'authenticated' THEN
        IF auth.uid() IS NULL OR auth.uid() <> p_admin_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'Неавторизованное действие администратора');
        END IF;
    ELSIF (auth.jwt() ->> 'role') IS NOT DISTINCT FROM 'service_role' OR current_user = 'postgres' THEN
        NULL;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Доступ разрешен только доверенному администратору');
    END IF;

    -- 2. Verify admin exists and has admin privileges
    SELECT * INTO v_admin FROM public.users WHERE id = p_admin_id;
    IF NOT FOUND OR v_admin.is_admin IS NOT TRUE THEN
        RETURN jsonb_build_object('success', false, 'error', 'Только подтвержденный администратор может удалять аккаунты');
    END IF;

    -- 3. Verify target user
    SELECT * INTO v_target FROM public.users WHERE id = p_target_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Пользователь не найден');
    END IF;

    -- 4. Protected VIP & Admin accounts check
    IF v_target.is_vip IS TRUE 
       OR v_target.is_admin IS TRUE 
       OR LOWER(TRIM(v_target.username)) IN ('vip5000x', 'vip2026z', 'vip7777m', 'vip9999k', 'admin', 'adminvip', 'lucky_admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Категорически запрещено удалять защищенные системные аккаунты (VIP / Admin)');
    END IF;

    v_target_username := v_target.username;

    -- 5. Cascade deletions
    -- 5.1. Dynamic FK cleanup: discovers and deletes rows from all tables referencing public.users
    FOR v_fk_rec IN 
        SELECT 
            tc.table_schema, 
            tc.table_name, 
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name 
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.referential_constraints rc 
          ON tc.constraint_name = rc.constraint_name
        JOIN information_schema.constraint_column_usage ccu 
          ON rc.unique_constraint_name = ccu.constraint_name 
         AND rc.unique_constraint_schema = ccu.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_schema = 'public'
          AND ccu.table_name = 'users'
          AND tc.table_schema = 'public'
    LOOP
        EXECUTE format('DELETE FROM %I.%I WHERE %I = $1', 
            v_fk_rec.table_schema, v_fk_rec.table_name, v_fk_rec.column_name) 
        USING p_target_user_id;
    END LOOP;

    -- 5.2. Explicit deletion with column existence verification (protecting against schema drift)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_inventory' AND column_name = 'user_id') THEN
        DELETE FROM public.user_inventory WHERE user_id = p_target_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gifts_history' AND column_name = 'sender_id') THEN
        DELETE FROM public.gifts_history WHERE sender_id = p_target_user_id OR recipient_id = p_target_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'spins_history' AND column_name = 'user_id') THEN
        DELETE FROM public.spins_history WHERE user_id = p_target_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases_history' AND column_name = 'user_id') THEN
        DELETE FROM public.purchases_history WHERE user_id = p_target_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales_history' AND column_name = 'user_id') THEN
        DELETE FROM public.sales_history WHERE user_id = p_target_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'user_id') THEN
        DELETE FROM public.notifications WHERE user_id = p_target_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'action_logs' AND column_name = 'user_id') THEN
        DELETE FROM public.action_logs WHERE user_id = p_target_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_connections' AND column_name = 'user_id') THEN
        DELETE FROM public.user_connections WHERE user_id = p_target_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'popularity_transactions' AND column_name = 'user_id') THEN
        DELETE FROM public.popularity_transactions WHERE user_id = p_target_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'public_events' AND column_name = 'user_id') THEN
        DELETE FROM public.public_events WHERE user_id = p_target_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'uc_requests' AND column_name = 'user_id') THEN
        DELETE FROM public.uc_requests WHERE user_id = p_target_user_id OR admin_id = p_target_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'admin_audit_logs' AND column_name = 'admin_id') THEN
        DELETE FROM public.admin_audit_logs WHERE admin_id = p_target_user_id OR target_user_id = p_target_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'registration_codes' AND column_name = 'used_by_user_id') THEN
        DELETE FROM public.registration_codes WHERE used_by_user_id = p_target_user_id;
    END IF;

    DELETE FROM public.users WHERE id = p_target_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('Аккаунт @%s успешно удален со всеми данными', v_target_username)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_toggle_block_user(
    p_admin_id UUID,
    p_target_user_id UUID,
    p_blocked BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_admin RECORD;
    v_target RECORD;
BEGIN
    -- 1. Security check (fail-closed)
    IF (auth.role() IS NULL) OR (auth.role() = 'anon') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Требуется авторизация администратора');
    END IF;

    IF auth.role() = 'authenticated' THEN
        IF auth.uid() IS NULL OR auth.uid() <> p_admin_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'Неавторизованное действие администратора');
        END IF;
    ELSIF (auth.jwt() ->> 'role') IS NOT DISTINCT FROM 'service_role' OR current_user = 'postgres' THEN
        NULL;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Доступ разрешен только доверенному администратору');
    END IF;

    -- 2. Verify admin exists and is admin
    SELECT * INTO v_admin FROM public.users WHERE id = p_admin_id;
    IF NOT FOUND OR v_admin.is_admin IS NOT TRUE THEN
        RETURN jsonb_build_object('success', false, 'error', 'Только администратор может изменять статус блокировки');
    END IF;

    -- 3. Verify target user
    SELECT * INTO v_target FROM public.users WHERE id = p_target_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Пользователь не найден');
    END IF;

    -- 4. Protected VIP & Admin check
    IF (v_target.is_vip IS TRUE 
        OR v_target.is_admin IS TRUE 
        OR LOWER(TRIM(v_target.username)) IN ('vip5000x', 'vip2026z', 'vip7777m', 'vip9999k', 'admin', 'adminvip', 'lucky_admin'))
       AND p_blocked IS TRUE THEN
        RETURN jsonb_build_object('success', false, 'error', 'Категорически запрещено блокировать защищенные аккаунты (VIP / Admin)');
    END IF;

    UPDATE public.users 
    SET is_blocked = p_blocked, updated_at = NOW()
    WHERE id = p_target_user_id;

    RETURN jsonb_build_object('success', true, 'is_blocked', p_blocked);
END;
$$;

-- Permissions for admin RPCs:
REVOKE ALL ON FUNCTION public.admin_delete_user_atomic(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_atomic(UUID, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_toggle_block_user(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_block_user(UUID, UUID, BOOLEAN) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. ACCOUNT PURGE FOR rubix0, xronix7, xuronix7, AND 444
-- (COMPLETE WIPE OF INVENTORY, UC, SPINS, BALANCES, AND GAME PROGRESS)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_target_user RECORD;
    v_purged_count INTEGER := 0;
BEGIN
    FOR v_target_user IN 
        SELECT id, username, is_admin, is_vip 
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

        -- 1. Completely delete inventory & history
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_inventory' AND column_name = 'user_id') THEN
            DELETE FROM public.user_inventory WHERE user_id = v_target_user.id;
        END IF;
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

        -- 2. Reset currencies, title, UC, and spins to 0
        UPDATE public.users
        SET points_balance = 0,
            coins_balance = 0,
            total_uc = 0,
            active_title_id = NULL,
            updated_at = NOW()
        WHERE id = v_target_user.id;

        -- Safely reset all spin columns to 0
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
        RAISE NOTICE 'ОЧИСТКА ВЫПОЛНЕНА: Аккаунт @% (%) полностью очищен (UC=0, Спины=0, Инвентарь удален)', 
            v_target_user.username, v_target_user.id;
    END LOOP;

    IF v_purged_count = 0 THEN
        RAISE NOTICE 'ИНФОРМАЦИЯ: Аккаунты rubix0 / xronix7 / xuronix7 / 444 не найдены или защищены от очистки';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 6. GLOBAL RESET: PP = 0, UC = 0 (STRICT VIP & ADMIN EXEMPTION, COINS PRESERVED)
-- ------------------------------------------------------------------------------
-- Reset PP (points_balance) = 0 and UC (total_uc) = 0 for standard players only.
-- Strictly preserves VIPs, Admins, and protected usernames.
-- Coins (coins_balance) of standard players are GLOBALLY PRESERVED (NOT ZEROED).
UPDATE public.users
SET points_balance = 0,
    total_uc = 0,
    updated_at = NOW()
WHERE is_vip IS NOT TRUE
  AND is_admin IS NOT TRUE
  AND LOWER(TRIM(username)) NOT IN ('vip5000x', 'vip2026z', 'vip7777m', 'vip9999k', 'admin', 'adminvip', 'lucky_admin');

-- ------------------------------------------------------------------------------
-- 7. POST-MIGRATION SANITY CHECKS & EXACT BALANCE COMPARISON
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_missing_prices INTEGER;
    v_missing_vip RECORD;
    v_diff RECORD;
    v_diff_count INTEGER := 0;
BEGIN
    -- 1. Assert no active shop items have missing or <= 0 price_coins
    -- (Checks ALL active items, regardless of whether category is NULL, empty, or custom)
    SELECT COUNT(*) INTO v_missing_prices 
    FROM public.rewards_catalog 
    WHERE is_active = TRUE 
      AND id NOT IN (
          '10000000-0000-0000-0000-000000000051',
          '10000000-0000-0000-0000-000000000052',
          '10000000-0000-0000-0000-000000000053',
          '10000000-0000-0000-0000-000000000054',
          '10000000-0000-0000-0000-000000000001',
          '10000000-0000-0000-0000-000000000002',
          '10000000-0000-0000-0000-000000000017'
      )
      AND COALESCE(title_slug, '') <> 'vip'
      AND (price_coins IS NULL OR price_coins <= 0);

    IF v_missing_prices > 0 THEN
        RAISE EXCEPTION 'ОШИБКА ВАЛИДАЦИИ: Обнаружено % активных товаров магазина без установленной цены price_coins!', v_missing_prices;
    END IF;

    -- 2. Verify that NO protected user was deleted or went missing
    FOR v_missing_vip IN
        SELECT pre.id, pre.username
        FROM _pre_migration_vip_admin_balances pre
        LEFT JOIN public.users curr ON curr.id = pre.id
        WHERE curr.id IS NULL
    LOOP
        RAISE EXCEPTION 'КРИТИЧЕСКАЯ ОШИБКА: Защищенный пользователь @% (ID: %) исчез из базы данных во время миграции! Откат транзакции.',
            v_missing_vip.username, v_missing_vip.id;
    END LOOP;

    -- 3. Rigorous balance comparison: Compare pre-migration snapshot with current public.users
    -- Checks Coins, PP (points_balance), and UC (total_uc) separately via IS DISTINCT FROM
    FOR v_diff IN 
        SELECT 
            pre.username,
            pre.id,
            pre.coins_balance AS old_coins, curr.coins_balance AS new_coins,
            pre.points_balance AS old_pp, curr.points_balance AS new_pp,
            pre.total_uc AS old_uc, curr.total_uc AS new_uc
        FROM _pre_migration_vip_admin_balances pre
        JOIN public.users curr ON curr.id = pre.id
        WHERE curr.coins_balance IS DISTINCT FROM pre.coins_balance
           OR curr.points_balance IS DISTINCT FROM pre.points_balance
           OR curr.total_uc IS DISTINCT FROM pre.total_uc
    LOOP
        v_diff_count := v_diff_count + 1;
        RAISE WARNING 'НЕСООТВЕТСТВИЕ: Баланс защищенного аккаунта @% (ID: %) изменен! Coins: % -> %, PP: % -> %, UC: % -> %',
            v_diff.username, v_diff.id, v_diff.old_coins, v_diff.new_coins, v_diff.old_pp, v_diff.new_pp, v_diff.old_uc, v_diff.new_uc;
    END LOOP;

    IF v_diff_count > 0 THEN
        RAISE EXCEPTION 'КРИТИЧЕСКАЯ ОШИБКА: Обнаружено несанкционированное изменение балансов % защищенных аккаунтов! Откат транзакции.', v_diff_count;
    END IF;

    RAISE NOTICE '================================================================';
    RAISE NOTICE 'БАЛАНСЫ И НАЛИЧИЕ ЗАЩИЩЕННЫХ АККАУНТОВ: 100%% совпадение с исходными данными.';
    RAISE NOTICE 'МИГРАЦИЯ V20 УСПЕШНО ВЫПОЛНЕНА И ПРОВЕРЕНА (TRANSACTION COMMITTED)';
    RAISE NOTICE '================================================================';
END $$;

COMMIT;
