-- ==============================================================================
-- LUCKY UC - Migration V23: Production Shop Price Repair & RPC Hardening
--
-- TARGET SCHEMA: Production Supabase (rewards_catalog without price columns)
--
-- OBJECTIVES:
-- 1. Add missing price_coins and price_points columns to public.rewards_catalog.
-- 2. Populate authoritative Coin prices for all 48 purchasable catalog items
--    matching lib/catalog-data.js.
-- 3. Preserve existing resource values in the "value" column without overwriting them.
-- 4. Exclude non-purchasable items (Spins, UC, VIP Title, Wheel Coins).
-- 5. Harden public.purchase_item_atomic:
--    - Authoritative coins_balance deduction only (never fallback to points_balance).
--    - Zero fallback to "value", rarity, or 1.
--    - Strict quantity validation (1..100) and BIGINT overflow protection.
--    - Strict inventory locking and bounds checking.
--    - Direct non-swallowing purchases_history insertion.
--    - Strict authentication: authenticated for self only, service_role allowed, anon rejected.
--    - Secure search_path = public, pg_temp.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. ADD MISSING PRICE COLUMNS TO public.rewards_catalog & SCHEMA PREPARATION
-- ------------------------------------------------------------------------------
ALTER TABLE public.rewards_catalog 
ADD COLUMN IF NOT EXISTS price_coins INTEGER;

ALTER TABLE public.rewards_catalog 
ADD COLUMN IF NOT EXISTS price_points INTEGER;

-- Ensure purchases_history table and all required columns exist
CREATE TABLE IF NOT EXISTS public.purchases_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    item_id UUID,
    reward_id UUID,
    item_type TEXT DEFAULT 'gift',
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    cost_coins INTEGER NOT NULL DEFAULT 0,
    cost_points INTEGER NOT NULL DEFAULT 0,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    is_admin_purchase BOOLEAN NOT NULL DEFAULT FALSE,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. Add columns WITHOUT immediate defaults so existing rows are NOT prematurely filled
-- (PostgreSQL 11+ automatically fills new columns having DEFAULT with that default value,
-- which would prevent distinguishing legacy missing values from genuine data).
ALTER TABLE public.purchases_history ADD COLUMN IF NOT EXISTS item_id UUID;
ALTER TABLE public.purchases_history ADD COLUMN IF NOT EXISTS reward_id UUID;
ALTER TABLE public.purchases_history ADD COLUMN IF NOT EXISTS item_type TEXT;
ALTER TABLE public.purchases_history ADD COLUMN IF NOT EXISTS cost_coins INTEGER;
ALTER TABLE public.purchases_history ADD COLUMN IF NOT EXISTS cost_points INTEGER;
ALTER TABLE public.purchases_history ADD COLUMN IF NOT EXISTS is_admin BOOLEAN;
ALTER TABLE public.purchases_history ADD COLUMN IF NOT EXISTS is_admin_purchase BOOLEAN;
ALTER TABLE public.purchases_history ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMPTZ;
ALTER TABLE public.purchases_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- 2. Safely backfill between legacy sibling columns while NULL values are still identifiable:
-- A. Timestamps: preserve original timestamp from whichever column had it
UPDATE public.purchases_history SET created_at = purchased_at WHERE created_at IS NULL AND purchased_at IS NOT NULL;
UPDATE public.purchases_history SET purchased_at = created_at WHERE purchased_at IS NULL AND created_at IS NOT NULL;
UPDATE public.purchases_history SET created_at = NOW(), purchased_at = NOW() WHERE created_at IS NULL AND purchased_at IS NULL;

-- B. Admin flags: preserve original admin flag from whichever column had it
UPDATE public.purchases_history SET is_admin_purchase = is_admin WHERE is_admin_purchase IS NULL AND is_admin IS NOT NULL;
UPDATE public.purchases_history SET is_admin = is_admin_purchase WHERE is_admin IS NULL AND is_admin_purchase IS NOT NULL;
UPDATE public.purchases_history SET is_admin = FALSE, is_admin_purchase = FALSE WHERE is_admin IS NULL AND is_admin_purchase IS NULL;

-- C. Item and reward IDs: cross-backfill if one is present
UPDATE public.purchases_history SET reward_id = item_id WHERE reward_id IS NULL AND item_id IS NOT NULL;
UPDATE public.purchases_history SET item_id = reward_id WHERE item_id IS NULL AND reward_id IS NOT NULL;

-- D. Legacy costs and item_type defaults for existing records with NULL
UPDATE public.purchases_history SET cost_coins = 0 WHERE cost_coins IS NULL;
UPDATE public.purchases_history SET cost_points = 0 WHERE cost_points IS NULL;
UPDATE public.purchases_history SET item_type = 'gift' WHERE item_type IS NULL;

-- 3. Set standard defaults for subsequent inserts
ALTER TABLE public.purchases_history ALTER COLUMN item_type SET DEFAULT 'gift';
ALTER TABLE public.purchases_history ALTER COLUMN cost_coins SET DEFAULT 0;
ALTER TABLE public.purchases_history ALTER COLUMN cost_points SET DEFAULT 0;
ALTER TABLE public.purchases_history ALTER COLUMN is_admin SET DEFAULT FALSE;
ALTER TABLE public.purchases_history ALTER COLUMN is_admin_purchase SET DEFAULT FALSE;
ALTER TABLE public.purchases_history ALTER COLUMN purchased_at SET DEFAULT NOW();
ALTER TABLE public.purchases_history ALTER COLUMN created_at SET DEFAULT NOW();

-- Enable RLS and idempotent security policies on public.purchases_history
ALTER TABLE public.purchases_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own purchases" ON public.purchases_history;
CREATE POLICY "Users can view own purchases"
    ON public.purchases_history FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access purchases" ON public.purchases_history;
CREATE POLICY "Service role full access purchases"
    ON public.purchases_history FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);

-- ------------------------------------------------------------------------------
-- 1.2 PREFLIGHT VALIDATION: CHECK ALL EXPECTED CATALOG IDS EXIST BEFORE UPDATING
-- Ensures that the target production database contains the exact reward UUIDs
-- before any price updates are applied.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_missing_ids TEXT[];
BEGIN
    SELECT ARRAY_AGG(expected_id::TEXT)
    INTO v_missing_ids
    FROM (
        VALUES 
            -- Exactly 57 canonical catalog UUIDs
            ('10000000-0000-0000-0000-000000000051'::UUID), -- 25 Монет (reward-coins-25)
            ('10000000-0000-0000-0000-000000000052'::UUID), -- 50 Монет (reward-coins-50)
            ('10000000-0000-0000-0000-000000000053'::UUID), -- 75 Монет (reward-coins-75)
            ('10000000-0000-0000-0000-000000000054'::UUID), -- 125 Монет (reward-coins-125)
            ('10000000-0000-0000-0000-000000000001'::UUID), -- 30 UC (reward-uc-30)
            ('10000000-0000-0000-0000-000000000002'::UUID), -- 60 UC (reward-uc-60)
            ('10000000-0000-0000-0000-000000000003'::UUID), -- 10 популярности (reward-pop-10)
            ('10000000-0000-0000-0000-000000000004'::UUID), -- 25 популярности (reward-pop-25)
            ('10000000-0000-0000-0000-000000000005'::UUID), -- 50 популярности (reward-pop-50)
            ('10000000-0000-0000-0000-000000000006'::UUID), -- 100 популярности (reward-pop-100)
            ('10000000-0000-0000-0000-000000000007'::UUID), -- Одна роза (reward-rose-1)
            ('10000000-0000-0000-0000-000000000008'::UUID), -- Букет роз (reward-rose-bouquet)
            ('10000000-0000-0000-0000-000000000009'::UUID), -- Большой букет роз (reward-rose-big-bouquet)
            ('10000000-0000-0000-0000-000000000012'::UUID), -- СОСУН (title-sosun)
            ('10000000-0000-0000-0000-000000000013'::UUID), -- ВОЗДУХАН (title-vozduhan)
            ('10000000-0000-0000-0000-000000000014'::UUID), -- КОРОЛЬ (title-korol)
            ('10000000-0000-0000-0000-000000000015'::UUID), -- КОРОЛЕВА (title-koroleva)
            ('10000000-0000-0000-0000-000000000061'::UUID), -- ФЕНИКС (title-phoenix)
            ('10000000-0000-0000-0000-000000000062'::UUID), -- ПРИЗРАК (title-phantom)
            ('10000000-0000-0000-0000-000000000063'::UUID), -- ДОМИНАТОР (title-dominator)
            ('10000000-0000-0000-0000-000000000064'::UUID), -- ТИТАН (title-titan)
            ('10000000-0000-0000-0000-000000000065'::UUID), -- ОВЕРЛОРД (title-overlord)
            ('10000000-0000-0000-0000-000000000071'::UUID), -- ТЕРПИЛЛА (title-terpilla)
            ('10000000-0000-0000-0000-000000000072'::UUID), -- ПОДСОС (title-podsos)
            ('10000000-0000-0000-0000-000000000073'::UUID), -- САНТА (title-santa)
            ('10000000-0000-0000-0000-000000000074'::UUID), -- FEMBOY (title-femboy)
            ('10000000-0000-0000-0000-000000000075'::UUID), -- NEFOR (title-nefor)
            ('10000000-0000-0000-0000-000000000076'::UUID), -- BALBIBOL (title-balbibol)
            ('10000000-0000-0000-0000-000000000077'::UUID), -- ИМПЕРАТОР (title-imperator)
            ('10000000-0000-0000-0000-000000000078'::UUID), -- ДЕМИУРГ (title-demiurge)
            ('10000000-0000-0000-0000-000000000016'::UUID), -- КИБОРГ (title-cyborg)
            ('10000000-0000-0000-0000-000000000017'::UUID), -- VIP (title-vip)
            ('10000000-0000-0000-0000-000000000018'::UUID), -- Золотая соска (reward-pacifier-gold)
            ('10000000-0000-0000-0000-000000000019'::UUID), -- Серебряная соска (reward-pacifier-silver)
            ('10000000-0000-0000-0000-000000000020'::UUID), -- Бронзовая соска (reward-pacifier-bronze)
            ('10000000-0000-0000-0000-000000000021'::UUID), -- Кубок (reward-cup)
            ('10000000-0000-0000-0000-000000000022'::UUID), -- Трусы деда (reward-boxers-grandpa)
            ('10000000-0000-0000-0000-000000000023'::UUID), -- Трусы Андрея (reward-boxers-andrey)
            ('10000000-0000-0000-0000-000000000024'::UUID), -- Соска Зама (reward-pacifier-deputy)
            ('10000000-0000-0000-0000-000000000025'::UUID), -- Позор дня (reward-shame-of-the-day)
            ('10000000-0000-0000-0000-000000000031'::UUID), -- Новогодний стикер (reward-xmas-sticker)
            ('10000000-0000-0000-0000-000000000032'::UUID), -- Значок Снежинка (reward-xmas-snowflake-badge)
            ('10000000-0000-0000-0000-000000000033'::UUID), -- Леденец-Трость (reward-xmas-candy-cane)
            ('10000000-0000-0000-0000-000000000034'::UUID), -- Новогодняя аватарка (reward-xmas-avatar)
            ('10000000-0000-0000-0000-000000000035'::UUID), -- Зимняя рамка профиля (reward-xmas-frame)
            ('10000000-0000-0000-0000-000000000038'::UUID), -- Значок Оленёнок (reward-xmas-reindeer-badge)
            ('10000000-0000-0000-0000-000000000036'::UUID), -- Снежный шар (reward-xmas-snow-globe)
            ('10000000-0000-0000-0000-000000000037'::UUID), -- Подарок Санты (reward-xmas-santas-gift)
            ('10000000-0000-0000-0000-000000000039'::UUID), -- Золотой колокольчик (reward-xmas-golden-bell)
            ('10000000-0000-0000-0000-000000000040'::UUID), -- Рождественский сундук (reward-xmas-chest)
            ('10000000-0000-0000-0000-000000000041'::UUID), -- Волшебная снежинка (reward-xmas-magic-snowflake)
            ('10000000-0000-0000-0000-000000000042'::UUID), -- Золотая ёлочка (reward-xmas-golden-tree)
            ('10000000-0000-0000-0000-000000000043'::UUID), -- Аватар Ледяного дракона (reward-xmas-ice-dragon-avatar)
            ('10000000-0000-0000-0000-000000000044'::UUID), -- Золотые сани Санты (reward-xmas-santas-sleigh)
            ('10000000-0000-0000-0000-000000000045'::UUID), -- Шкатулка Рождественского чуда (reward-xmas-miracle-box)
            ('10000000-0000-0000-0000-000000000010'::UUID), -- 1 вращение (reward-spin-1)
            ('10000000-0000-0000-0000-000000000011'::UUID) -- 2 вращения (reward-spin-2)

    ) t(expected_id)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.rewards_catalog r WHERE r.id = t.expected_id
    );

    IF v_missing_ids IS NOT NULL AND ARRAY_LENGTH(v_missing_ids, 1) > 0 THEN
        RAISE EXCEPTION 'MIGRATION V23 PREFLIGHT ABORTED: Missing required reward UUIDs in public.rewards_catalog: %', v_missing_ids;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2.1 PURCHASABLE ITEMS (48 ITEMS)
UPDATE public.rewards_catalog SET price_coins = 25, price_points = 25, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000003'; -- 10 популярности (reward-pop-10)
UPDATE public.rewards_catalog SET price_coins = 60, price_points = 60, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000004'; -- 25 популярности (reward-pop-25)
UPDATE public.rewards_catalog SET price_coins = 160, price_points = 160, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000005'; -- 50 популярности (reward-pop-50)
UPDATE public.rewards_catalog SET price_coins = 480, price_points = 480, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000006'; -- 100 популярности (reward-pop-100)
UPDATE public.rewards_catalog SET price_coins = 20, price_points = 20, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000007'; -- Одна роза (reward-rose-1)
UPDATE public.rewards_catalog SET price_coins = 120, price_points = 120, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000008'; -- Букет роз (reward-rose-bouquet)
UPDATE public.rewards_catalog SET price_coins = 550, price_points = 550, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000009'; -- Большой букет роз (reward-rose-big-bouquet)
UPDATE public.rewards_catalog SET price_coins = 250, price_points = 250, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000012'; -- СОСУН (title-sosun)
UPDATE public.rewards_catalog SET price_coins = 350, price_points = 350, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000013'; -- ВОЗДУХАН (title-vozduhan)
UPDATE public.rewards_catalog SET price_coins = 750, price_points = 750, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000014'; -- КОРОЛЬ (title-korol)
UPDATE public.rewards_catalog SET price_coins = 750, price_points = 750, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000015'; -- КОРОЛЕВА (title-koroleva)
UPDATE public.rewards_catalog SET price_coins = 1200, price_points = 1200, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000061'; -- ФЕНИКС (title-phoenix)
UPDATE public.rewards_catalog SET price_coins = 1350, price_points = 1350, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000062'; -- ПРИЗРАК (title-phantom)
UPDATE public.rewards_catalog SET price_coins = 1500, price_points = 1500, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000063'; -- ДОМИНАТОР (title-dominator)
UPDATE public.rewards_catalog SET price_coins = 1650, price_points = 1650, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000064'; -- ТИТАН (title-titan)
UPDATE public.rewards_catalog SET price_coins = 2800, price_points = 2800, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000065'; -- ОВЕРЛОРД (title-overlord)
UPDATE public.rewards_catalog SET price_coins = 300, price_points = 300, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000071'; -- ТЕРПИЛЛА (title-terpilla)
UPDATE public.rewards_catalog SET price_coins = 350, price_points = 350, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000072'; -- ПОДСОС (title-podsos)
UPDATE public.rewards_catalog SET price_coins = 3000, price_points = 3000, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000073'; -- САНТА (title-santa)
UPDATE public.rewards_catalog SET price_coins = 800, price_points = 800, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000074'; -- FEMBOY (title-femboy)
UPDATE public.rewards_catalog SET price_coins = 450, price_points = 450, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000075'; -- NEFOR (title-nefor)
UPDATE public.rewards_catalog SET price_coins = 150, price_points = 150, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000076'; -- BALBIBOL (title-balbibol)
UPDATE public.rewards_catalog SET price_coins = 2200, price_points = 2200, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000077'; -- ИМПЕРАТОР (title-imperator)
UPDATE public.rewards_catalog SET price_coins = 5500, price_points = 5500, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000078'; -- ДЕМИУРГ (title-demiurge)
UPDATE public.rewards_catalog SET price_coins = 5000, price_points = 5000, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000016'; -- КИБОРГ (title-cyborg)
UPDATE public.rewards_catalog SET price_coins = 2600, price_points = 2600, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000018'; -- Золотая соска (reward-pacifier-gold)
UPDATE public.rewards_catalog SET price_coins = 500, price_points = 500, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000019'; -- Серебряная соска (reward-pacifier-silver)
UPDATE public.rewards_catalog SET price_coins = 200, price_points = 200, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000020'; -- Бронзовая соска (reward-pacifier-bronze)
UPDATE public.rewards_catalog SET price_coins = 600, price_points = 600, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000021'; -- Кубок (reward-cup)
UPDATE public.rewards_catalog SET price_coins = 70, price_points = 70, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000022'; -- Трусы деда (reward-boxers-grandpa)
UPDATE public.rewards_catalog SET price_coins = 85, price_points = 85, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000023'; -- Трусы Андрея (reward-boxers-andrey)
UPDATE public.rewards_catalog SET price_coins = 180, price_points = 180, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000024'; -- Соска Зама (reward-pacifier-deputy)
UPDATE public.rewards_catalog SET price_coins = 15, price_points = 15, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000025'; -- Позор дня (reward-shame-of-the-day)
UPDATE public.rewards_catalog SET price_coins = 30, price_points = 30, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000031'; -- Новогодний стикер (reward-xmas-sticker)
UPDATE public.rewards_catalog SET price_coins = 40, price_points = 40, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000032'; -- Значок Снежинка (reward-xmas-snowflake-badge)
UPDATE public.rewards_catalog SET price_coins = 50, price_points = 50, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000033'; -- Леденец-Трость (reward-xmas-candy-cane)
UPDATE public.rewards_catalog SET price_coins = 90, price_points = 90, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000034'; -- Новогодняя аватарка (reward-xmas-avatar)
UPDATE public.rewards_catalog SET price_coins = 110, price_points = 110, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000035'; -- Зимняя рамка профиля (reward-xmas-frame)
UPDATE public.rewards_catalog SET price_coins = 130, price_points = 130, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000038'; -- Значок Оленёнок (reward-xmas-reindeer-badge)
UPDATE public.rewards_catalog SET price_coins = 220, price_points = 220, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000036'; -- Снежный шар (reward-xmas-snow-globe)
UPDATE public.rewards_catalog SET price_coins = 280, price_points = 280, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000037'; -- Подарок Санты (reward-xmas-santas-gift)
UPDATE public.rewards_catalog SET price_coins = 340, price_points = 340, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000039'; -- Золотой колокольчик (reward-xmas-golden-bell)
UPDATE public.rewards_catalog SET price_coins = 420, price_points = 420, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000040'; -- Рождественский сундук (reward-xmas-chest)
UPDATE public.rewards_catalog SET price_coins = 680, price_points = 680, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000041'; -- Волшебная снежинка (reward-xmas-magic-snowflake)
UPDATE public.rewards_catalog SET price_coins = 800, price_points = 800, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000042'; -- Золотая ёлочка (reward-xmas-golden-tree)
UPDATE public.rewards_catalog SET price_coins = 950, price_points = 950, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000043'; -- Аватар Ледяного дракона (reward-xmas-ice-dragon-avatar)
UPDATE public.rewards_catalog SET price_coins = 2800, price_points = 2800, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000044'; -- Золотые сани Санты (reward-xmas-santas-sleigh)
UPDATE public.rewards_catalog SET price_coins = 5500, price_points = 5500, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000045'; -- Шкатулка Рождественского чуда (reward-xmas-miracle-box)

-- 2.2 EXCLUDED ITEMS (9 ITEMS - NOT PURCHASABLE IN SHOP)
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000051'; -- 25 Монет (reward-coins-25)
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000052'; -- 50 Монет (reward-coins-50)
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000053'; -- 75 Монет (reward-coins-75)
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000054'; -- 125 Монет (reward-coins-125)
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000001'; -- 30 UC (reward-uc-30)
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000002'; -- 60 UC (reward-uc-60)
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000017'; -- VIP (title-vip)
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000010'; -- 1 вращение (reward-spin-1)
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000011'; -- 2 вращения (reward-spin-2)

-- 2.8 STRICT PREFLIGHT/POST-UPDATE INTEGRITY VERIFICATION
-- Validates every single expected UUID and price. If ANY item is missing or price is incorrect,
-- raises an EXCEPTION and aborts/rolls back the entire transaction.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_expected RECORD;
    v_actual RECORD;
    v_items_checked INTEGER := 0;
BEGIN
    FOR v_expected IN
        SELECT * FROM (VALUES
        -- Verify all 48 purchasable items have matching price_coins
            ('10000000-0000-0000-0000-000000000003'::UUID, 25, TRUE), -- 10 популярности
            ('10000000-0000-0000-0000-000000000004'::UUID, 60, TRUE), -- 25 популярности
            ('10000000-0000-0000-0000-000000000005'::UUID, 160, TRUE), -- 50 популярности
            ('10000000-0000-0000-0000-000000000006'::UUID, 480, TRUE), -- 100 популярности
            ('10000000-0000-0000-0000-000000000007'::UUID, 20, TRUE), -- Одна роза
            ('10000000-0000-0000-0000-000000000008'::UUID, 120, TRUE), -- Букет роз
            ('10000000-0000-0000-0000-000000000009'::UUID, 550, TRUE), -- Большой букет роз
            ('10000000-0000-0000-0000-000000000012'::UUID, 250, TRUE), -- СОСУН
            ('10000000-0000-0000-0000-000000000013'::UUID, 350, TRUE), -- ВОЗДУХАН
            ('10000000-0000-0000-0000-000000000014'::UUID, 750, TRUE), -- КОРОЛЬ
            ('10000000-0000-0000-0000-000000000015'::UUID, 750, TRUE), -- КОРОЛЕВА
            ('10000000-0000-0000-0000-000000000061'::UUID, 1200, TRUE), -- ФЕНИКС
            ('10000000-0000-0000-0000-000000000062'::UUID, 1350, TRUE), -- ПРИЗРАК
            ('10000000-0000-0000-0000-000000000063'::UUID, 1500, TRUE), -- ДОМИНАТОР
            ('10000000-0000-0000-0000-000000000064'::UUID, 1650, TRUE), -- ТИТАН
            ('10000000-0000-0000-0000-000000000065'::UUID, 2800, TRUE), -- ОВЕРЛОРД
            ('10000000-0000-0000-0000-000000000071'::UUID, 300, TRUE), -- ТЕРПИЛЛА
            ('10000000-0000-0000-0000-000000000072'::UUID, 350, TRUE), -- ПОДСОС
            ('10000000-0000-0000-0000-000000000073'::UUID, 3000, TRUE), -- САНТА
            ('10000000-0000-0000-0000-000000000074'::UUID, 800, TRUE), -- FEMBOY
            ('10000000-0000-0000-0000-000000000075'::UUID, 450, TRUE), -- NEFOR
            ('10000000-0000-0000-0000-000000000076'::UUID, 150, TRUE), -- BALBIBOL
            ('10000000-0000-0000-0000-000000000077'::UUID, 2200, TRUE), -- ИМПЕРАТОР
            ('10000000-0000-0000-0000-000000000078'::UUID, 5500, TRUE), -- ДЕМИУРГ
            ('10000000-0000-0000-0000-000000000016'::UUID, 5000, TRUE), -- КИБОРГ
            ('10000000-0000-0000-0000-000000000018'::UUID, 2600, TRUE), -- Золотая соска
            ('10000000-0000-0000-0000-000000000019'::UUID, 500, TRUE), -- Серебряная соска
            ('10000000-0000-0000-0000-000000000020'::UUID, 200, TRUE), -- Бронзовая соска
            ('10000000-0000-0000-0000-000000000021'::UUID, 600, TRUE), -- Кубок
            ('10000000-0000-0000-0000-000000000022'::UUID, 70, TRUE), -- Трусы деда
            ('10000000-0000-0000-0000-000000000023'::UUID, 85, TRUE), -- Трусы Андрея
            ('10000000-0000-0000-0000-000000000024'::UUID, 180, TRUE), -- Соска Зама
            ('10000000-0000-0000-0000-000000000025'::UUID, 15, TRUE), -- Позор дня
            ('10000000-0000-0000-0000-000000000031'::UUID, 30, TRUE), -- Новогодний стикер
            ('10000000-0000-0000-0000-000000000032'::UUID, 40, TRUE), -- Значок Снежинка
            ('10000000-0000-0000-0000-000000000033'::UUID, 50, TRUE), -- Леденец-Трость
            ('10000000-0000-0000-0000-000000000034'::UUID, 90, TRUE), -- Новогодняя аватарка
            ('10000000-0000-0000-0000-000000000035'::UUID, 110, TRUE), -- Зимняя рамка профиля
            ('10000000-0000-0000-0000-000000000038'::UUID, 130, TRUE), -- Значок Оленёнок
            ('10000000-0000-0000-0000-000000000036'::UUID, 220, TRUE), -- Снежный шар
            ('10000000-0000-0000-0000-000000000037'::UUID, 280, TRUE), -- Подарок Санты
            ('10000000-0000-0000-0000-000000000039'::UUID, 340, TRUE), -- Золотой колокольчик
            ('10000000-0000-0000-0000-000000000040'::UUID, 420, TRUE), -- Рождественский сундук
            ('10000000-0000-0000-0000-000000000041'::UUID, 680, TRUE), -- Волшебная снежинка
            ('10000000-0000-0000-0000-000000000042'::UUID, 800, TRUE), -- Золотая ёлочка
            ('10000000-0000-0000-0000-000000000043'::UUID, 950, TRUE), -- Аватар Ледяного дракона
            ('10000000-0000-0000-0000-000000000044'::UUID, 2800, TRUE), -- Золотые сани Санты
            ('10000000-0000-0000-0000-000000000045'::UUID, 5500, TRUE) -- Шкатулка Рождественского чуда
        ) AS t(id, price_coins, is_active)
    LOOP
        SELECT id, price_coins, is_active INTO v_actual
        FROM public.rewards_catalog
        WHERE id = v_expected.id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'MIGRATION V23 ABORTED: Missing required reward item % in public.rewards_catalog!', v_expected.id;
        END IF;

        IF v_actual.price_coins <> v_expected.price_coins THEN
            RAISE EXCEPTION 'MIGRATION V23 ABORTED: Price mismatch for item %! Expected: %, Got: %', 
                v_expected.id, v_expected.price_coins, v_actual.price_coins;
        END IF;

        IF v_actual.is_active <> v_expected.is_active THEN
            RAISE EXCEPTION 'MIGRATION V23 ABORTED: is_active mismatch for item %! Expected: %, Got: %',
                v_expected.id, v_expected.is_active, v_actual.is_active;
        END IF;

        v_items_checked := v_items_checked + 1;
    END LOOP;

    -- Validate excluded items (spins, uc, vip) have price_coins IS NULL
    PERFORM 1 FROM public.rewards_catalog 
    WHERE id IN (
        '10000000-0000-0000-0000-000000000010', -- Spin 1
        '10000000-0000-0000-0000-000000000011', -- Spin 2
        '10000000-0000-0000-0000-000000000001', -- 30 UC
        '10000000-0000-0000-0000-000000000002', -- 60 UC
        '10000000-0000-0000-0000-000000000017', -- VIP Title
        '10000000-0000-0000-0000-000000000051', -- 25 Coins
        '10000000-0000-0000-0000-000000000052', -- 50 Coins
        '10000000-0000-0000-0000-000000000053', -- 75 Coins
        '10000000-0000-0000-0000-000000000054'  -- 125 Coins
    ) AND price_coins IS NOT NULL;

    IF FOUND THEN
        RAISE EXCEPTION 'MIGRATION V23 ABORTED: Non-purchasable items (Spins/UC/VIP/Roulette) must not have price_coins set!';
    END IF;

    RAISE NOTICE '✅ [MIGRATION V23] Verified % catalog items and pricing successfully.', v_items_checked;
END $$;

-- ------------------------------------------------------------------------------
-- 3. HARDENED ATOMIC PURCHASE RPC FUNCTION
-- Replaces old purchase_item_atomic with strict price_coins deduction and
-- no fallback to "value".
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
    v_is_admin BOOLEAN := FALSE;
    v_current_coins INTEGER;
    v_new_coins INTEGER;
    v_current_qty INTEGER;
    v_final_quantity INTEGER := 0;
    v_final_quantity_bigint BIGINT;
    v_clean_slug TEXT;
    v_stripped_slug TEXT;
    v_match_count INTEGER := 0;
    v_inv_exists BOOLEAN := FALSE;
BEGIN
    -- 1. Security: Block anonymous callers. Authenticated callers restricted to own user ID.
    -- Trusted service_role execution allowed for backend processes.
    -- Direct superuser bypass is strictly disallowed.
    IF auth.role() = 'authenticated' THEN
        IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'Вы можете совершать покупки только для своего аккаунта');
        END IF;
    ELSIF (auth.role() = 'service_role') OR ((auth.jwt() ->> 'role') = 'service_role') THEN
        -- Allowed: Server-side execution via trusted service role
        NULL;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Требуется авторизация для совершения покупок');
    END IF;

    -- 2. Input validation: quantity limit 1 to 100
    IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 100 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Недопустимое количество предметов для покупки (разрешено от 1 до 100)');
    END IF;

    IF p_item_slug IS NULL OR TRIM(p_item_slug) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Укажите идентификатор товара');
    END IF;

    v_clean_slug := TRIM(p_item_slug);
    v_stripped_slug := REGEXP_REPLACE(v_clean_slug, '^(title-|reward-|gift-)', '', 'i');

    -- 3. Lock user record
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

    -- Admin status strictly from verified database user record
    v_is_admin := COALESCE(v_user.is_admin, FALSE);

    -- 4. Exclude specific items from being purchased in shop
    IF LOWER(v_clean_slug) IN (
        'reward-spin-1', 'reward-spin-2', 'spin-1', 'spin-2',
        'reward-uc-30', 'reward-uc-60', 'uc-30', 'uc-60',
        'title-vip', 'vip'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Данный предмет нельзя приобрести в магазине');
    END IF;

    -- 5. Locate item in rewards_catalog with AMBIGUITY CHECKS
    -- 5.1: Direct UUID match
    IF v_clean_slug ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT * INTO v_reward 
        FROM public.rewards_catalog 
        WHERE id = v_clean_slug::UUID 
          AND is_active = TRUE;
    END IF;

    -- 5.2: Try slug / title_slug with AMBIGUITY CHECK
    IF v_reward.id IS NULL THEN
        SELECT COUNT(*) INTO v_match_count
        FROM public.rewards_catalog 
        WHERE (
            (title_slug IS NOT NULL AND TRIM(title_slug) <> '' AND (
                LOWER(title_slug) = LOWER(v_clean_slug)
                OR LOWER(title_slug) = LOWER(v_stripped_slug)
                OR LOWER('title-' || title_slug) = LOWER(v_clean_slug)
                OR LOWER('reward-' || title_slug) = LOWER(v_clean_slug)
            ))
            OR
            (slug IS NOT NULL AND TRIM(slug) <> '' AND (
                LOWER(slug) = LOWER(v_clean_slug)
                OR LOWER(slug) = LOWER(v_stripped_slug)
            ))
        )
        AND is_active = TRUE;

        IF v_match_count > 1 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Неоднозначный идентификатор товара в каталоге (укажите точный UUID)');
        ELSIF v_match_count = 1 THEN
            SELECT * INTO v_reward 
            FROM public.rewards_catalog 
            WHERE (
                (title_slug IS NOT NULL AND TRIM(title_slug) <> '' AND (
                    LOWER(title_slug) = LOWER(v_clean_slug)
                    OR LOWER(title_slug) = LOWER(v_stripped_slug)
                    OR LOWER('title-' || title_slug) = LOWER(v_clean_slug)
                    OR LOWER('reward-' || title_slug) = LOWER(v_clean_slug)
                ))
                OR
                (slug IS NOT NULL AND TRIM(slug) <> '' AND (
                    LOWER(slug) = LOWER(v_clean_slug)
                    OR LOWER(slug) = LOWER(v_stripped_slug)
                ))
            )
            AND is_active = TRUE;
        END IF;
    END IF;

    -- 5.3: If not found by slug, try exact name with AMBIGUITY CHECK
    IF v_reward.id IS NULL THEN
        SELECT COUNT(*) INTO v_match_count
        FROM public.rewards_catalog 
        WHERE (
            LOWER(name) = LOWER(v_clean_slug)
            OR LOWER(name) = LOWER(v_stripped_slug)
        )
        AND is_active = TRUE;

        IF v_match_count > 1 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Найдено несколько товаров с одинаковым названием, укажите точный UUID');
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
        RETURN jsonb_build_object('success', false, 'error', 'Товар не найден или недоступен в магазине');
    END IF;

    -- 6. AUTHORITATIVE PRICE DETERMINATION (NO FALLBACK TO VALUE!)
    -- We strictly use price_coins. If price_coins is NULL or <= 0, item is NOT purchasable!
    v_unit_cost := v_reward.price_coins;

    IF v_unit_cost IS NULL OR v_unit_cost <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Товар недоступен для покупки за Монеты');
    END IF;

    -- 7. Calculate total cost with BIGINT integer overflow protection
    IF v_is_admin THEN
        v_total_cost := 0;
    ELSE
        v_total_cost_bigint := (v_unit_cost::BIGINT) * (p_quantity::BIGINT);
        IF v_total_cost_bigint > 2147483647 OR v_total_cost_bigint < 0 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Превышен максимальный лимит стоимости операции');
        END IF;
        v_total_cost := v_total_cost_bigint::INTEGER;
    END IF;

    -- 8. Balance check (coins_balance ONLY, NO fallback to points_balance!)
    IF v_user.coins_balance IS NULL OR v_user.coins_balance < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Баланс Монет не инициализирован или поврежден');
    END IF;
    v_current_coins := v_user.coins_balance;

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

    -- 9. CRITICAL: Validate inventory quantity and overflow BEFORE deducting Coins (Requirements 1 & 2)
    -- Safely lock inventory row if it exists
    SELECT quantity INTO v_current_qty
    FROM public.user_inventory
    WHERE user_id = p_user_id AND reward_id = v_reward.id
    FOR UPDATE;

    v_inv_exists := FOUND;

    IF v_inv_exists THEN
        -- Handle NULL inventory quantity safely with COALESCE
        v_final_quantity_bigint := (COALESCE(v_current_qty, 0)::BIGINT) + (p_quantity::BIGINT);
        IF v_final_quantity_bigint > 2147483647 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Превышен максимальный лимит предметов в инвентаре');
        END IF;
        v_final_quantity := v_final_quantity_bigint::INTEGER;
    ELSE
        v_final_quantity := p_quantity;
    END IF;

    -- 10. Balance deduction (coins_balance ONLY, points_balance is strictly untouched)
    IF v_is_admin THEN
        v_new_coins := v_current_coins;
    ELSE
        v_new_coins := v_current_coins - v_total_cost;
    END IF;

    -- Deduct coins_balance ONLY, points_balance is strictly untouched
    UPDATE public.users 
    SET 
        coins_balance = v_new_coins,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- 11. Add/Update Item in User Inventory
    IF v_inv_exists THEN
        UPDATE public.user_inventory
        SET quantity = v_final_quantity,
            updated_at = NOW()
        WHERE user_id = p_user_id AND reward_id = v_reward.id;
    ELSE
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
            v_final_quantity,
            NOW(),
            NOW()
        );
    END IF;

    -- 12. Record purchase history directly (non-swallowing, atomic with purchase)
    INSERT INTO public.purchases_history (
        user_id,
        item_id,
        reward_id,
        item_name,
        item_type,
        quantity,
        cost_coins,
        cost_points,
        is_admin,
        is_admin_purchase,
        purchased_at,
        created_at
    )
    VALUES (
        p_user_id,
        v_reward.id,
        v_reward.id,
        v_reward.name,
        CASE WHEN v_reward.is_title OR v_reward.category = 'titles' THEN 'title' ELSE 'gift' END,
        p_quantity,
        v_total_cost,
        0,
        v_is_admin,
        v_is_admin,
        NOW(),
        NOW()
    );

    -- 11. Return detailed result
    RETURN jsonb_build_object(
        'success', true,
        'item', jsonb_build_object(
            'id', v_reward.id,
            'name', v_reward.name,
            'category', v_reward.category,
            'rarity', v_reward.rarity,
            'icon_name', v_reward.icon_name,
            'value', v_reward.value,
            'quantity', v_final_quantity,
            'total_quantity', v_final_quantity
        ),
        'quantity', p_quantity,
        'cost_coins', v_total_cost,
        'cost_points', 0,
        'costCoins', v_total_cost,
        'costPoints', 0,
        'coins_balance', v_new_coins,
        'coinsBalance', v_new_coins,
        'points_balance', v_user.points_balance,
        'pointsBalance', v_user.points_balance,
        'is_admin', v_is_admin,
        'isAdmin', v_is_admin,
        'message', format('Успешно куплено: %s (%s шт.) за %s Монет', v_reward.name, p_quantity, v_total_cost)
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. PERMISSIONS & SECURITY
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) FROM anon;

GRANT EXECUTE ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) TO service_role;

COMMIT;
