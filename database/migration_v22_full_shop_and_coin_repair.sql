-- ==============================================================================
-- LUCKY UC - Migration V22: Full Shop & Coin System Audit and Repair
--
-- Fixes:
-- 1. ROOT CAUSE FIX: Replaces purchase_item_atomic to strictly use
--    v_reward.price_coins instead of v_reward.value.
-- 2. Sets authoritative, exact server-side price_coins & price_points for ALL
--    purchasable items in rewards_catalog.
-- 3. Deactivates Free Spins (+1 and +2) from shop purchases (is_active = FALSE,
--    price_coins = NULL) while preserving Lucky Spin and 24h daily timer.
-- 4. Ensures UC VIP, direct UC, and Roulette coin drops are excluded from purchases.
-- 5. Canonical atomic Duplicate Selling function (sell_duplicate_atomic) with
--    safe balance mutation, duplicate check (qty > 1), and rarity pricing tiers.
-- 6. Synchronizes coins_balance and points_balance atomically across transactions.
-- 7. Zero arbitrary fallback prices. Non-destructive to user balances & histories.
-- ==============================================================================

BEGIN;

-- 1. Ensure required schema columns exist on public.rewards_catalog
ALTER TABLE public.rewards_catalog ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.rewards_catalog ADD COLUMN IF NOT EXISTS price_coins INTEGER;
ALTER TABLE public.rewards_catalog ADD COLUMN IF NOT EXISTS price_points INTEGER;
ALTER TABLE public.rewards_catalog ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.rewards_catalog ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.rewards_catalog ADD COLUMN IF NOT EXISTS conditions TEXT;

-- Ensure purchases_history and sales_history tables exist
CREATE TABLE IF NOT EXISTS public.purchases_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reward_id UUID REFERENCES public.rewards_catalog(id) ON DELETE SET NULL,
    item_type TEXT DEFAULT 'gift',
    item_name TEXT NOT NULL,
    item_slug TEXT,
    cost_coins INTEGER DEFAULT 0,
    cost_points INTEGER DEFAULT 0,
    quantity INTEGER DEFAULT 1,
    is_admin_purchase BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sales_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reward_id UUID REFERENCES public.rewards_catalog(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    item_rarity TEXT NOT NULL DEFAULT 'common',
    coins_earned INTEGER NOT NULL CHECK (coins_earned > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_history_user ON public.purchases_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_history_user ON public.sales_history(user_id, created_at DESC);

-- Enable RLS on history tables
ALTER TABLE public.purchases_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own purchases" ON public.purchases_history;
CREATE POLICY "Users can view own purchases"
    ON public.purchases_history FOR SELECT
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access purchases" ON public.purchases_history;
CREATE POLICY "Service role full access purchases"
    ON public.purchases_history FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can view own sales history" ON public.sales_history;
CREATE POLICY "Users can view own sales history"
    ON public.sales_history FOR SELECT
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access sales" ON public.sales_history;
CREATE POLICY "Service role full access sales"
    ON public.sales_history FOR ALL
    USING (auth.role() = 'service_role');

-- ------------------------------------------------------------------------------
-- 2. SET AUTHORITATIVE SERVER-SIDE PRICES FOR ALL CATALOG ITEMS
-- ------------------------------------------------------------------------------

-- 2.1 POPULARITY ITEMS
UPDATE public.rewards_catalog
SET price_coins = 25, price_points = 25, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000003'; -- 10 популярности

UPDATE public.rewards_catalog
SET price_coins = 60, price_points = 60, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000004'; -- 25 популярности

UPDATE public.rewards_catalog
SET price_coins = 160, price_points = 160, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000005'; -- 50 популярности

UPDATE public.rewards_catalog
SET price_coins = 480, price_points = 480, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000006'; -- 100 популярности

-- 2.2 ROSES & BOUQUETS
UPDATE public.rewards_catalog
SET price_coins = 20, price_points = 20, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000007'; -- Одна роза

UPDATE public.rewards_catalog
SET price_coins = 120, price_points = 120, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000008'; -- Букет роз

UPDATE public.rewards_catalog
SET price_coins = 550, price_points = 550, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000009'; -- Большой букет роз

-- 2.3 SOUVENIRS & JOKES
UPDATE public.rewards_catalog
SET price_coins = 2600, price_points = 2600, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000018'; -- Золотая соска

UPDATE public.rewards_catalog
SET price_coins = 500, price_points = 500, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000019'; -- Серебряная соска

UPDATE public.rewards_catalog
SET price_coins = 200, price_points = 200, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000020'; -- Бронзовая соска

UPDATE public.rewards_catalog
SET price_coins = 600, price_points = 600, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000021'; -- Кубок

UPDATE public.rewards_catalog
SET price_coins = 70, price_points = 70, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000022'; -- Трусы деда

UPDATE public.rewards_catalog
SET price_coins = 85, price_points = 85, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000023'; -- Трусы Андрея

UPDATE public.rewards_catalog
SET price_coins = 180, price_points = 180, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000024'; -- Соска Зама

UPDATE public.rewards_catalog
SET price_coins = 15, price_points = 15, is_active = TRUE
WHERE id = '10000000-0000-0000-0000-000000000025'; -- Позор дня

-- 2.4 CHRISTMAS CATALOG (15 ITEMS)
UPDATE public.rewards_catalog SET price_coins = 30, price_points = 30, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000031'; -- Новогодний стикер
UPDATE public.rewards_catalog SET price_coins = 40, price_points = 40, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000032'; -- Значок Снежинка
UPDATE public.rewards_catalog SET price_coins = 50, price_points = 50, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000033'; -- Леденец-Трость
UPDATE public.rewards_catalog SET price_coins = 90, price_points = 90, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000034'; -- Новогодняя аватарка
UPDATE public.rewards_catalog SET price_coins = 110, price_points = 110, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000035'; -- Зимняя рамка профиля
UPDATE public.rewards_catalog SET price_coins = 130, price_points = 130, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000038'; -- Значок Оленёнок
UPDATE public.rewards_catalog SET price_coins = 220, price_points = 220, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000036'; -- Снежный шар
UPDATE public.rewards_catalog SET price_coins = 280, price_points = 280, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000037'; -- Подарок Санты
UPDATE public.rewards_catalog SET price_coins = 340, price_points = 340, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000039'; -- Золотой колокольчик
UPDATE public.rewards_catalog SET price_coins = 420, price_points = 420, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000040'; -- Рождественский сундук
UPDATE public.rewards_catalog SET price_coins = 680, price_points = 680, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000041'; -- Волшебная снежинка
UPDATE public.rewards_catalog SET price_coins = 800, price_points = 800, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000042'; -- Золотая ёлочка
UPDATE public.rewards_catalog SET price_coins = 950, price_points = 950, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000043'; -- Аватар Ледяного дракона
UPDATE public.rewards_catalog SET price_coins = 2800, price_points = 2800, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000044'; -- Золотые сани Санты
UPDATE public.rewards_catalog SET price_coins = 5500, price_points = 5500, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000045'; -- Шкатулка Рождественского чуда

-- 2.5 ALL 18 PURCHASABLE TITLES
UPDATE public.rewards_catalog SET price_coins = 150, price_points = 150, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000076'; -- BALBIBOL
UPDATE public.rewards_catalog SET price_coins = 250, price_points = 250, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000012'; -- СОСУН
UPDATE public.rewards_catalog SET price_coins = 300, price_points = 300, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000071'; -- ТЕРПИЛЛА
UPDATE public.rewards_catalog SET price_coins = 350, price_points = 350, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000013'; -- ВОЗДУХАН
UPDATE public.rewards_catalog SET price_coins = 350, price_points = 350, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000072'; -- ПОДСОС
UPDATE public.rewards_catalog SET price_coins = 450, price_points = 450, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000075'; -- NEFOR
UPDATE public.rewards_catalog SET price_coins = 750, price_points = 750, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000014'; -- КОРОЛЬ
UPDATE public.rewards_catalog SET price_coins = 750, price_points = 750, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000015'; -- КОРОЛЕВА
UPDATE public.rewards_catalog SET price_coins = 800, price_points = 800, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000074'; -- FEMBOY
UPDATE public.rewards_catalog SET price_coins = 1200, price_points = 1200, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000061'; -- ФЕНИКС
UPDATE public.rewards_catalog SET price_coins = 1350, price_points = 1350, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000062'; -- ПРИЗРАК
UPDATE public.rewards_catalog SET price_coins = 1500, price_points = 1500, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000063'; -- ДОМИНАТОР
UPDATE public.rewards_catalog SET price_coins = 1650, price_points = 1650, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000064'; -- ТИТАН
UPDATE public.rewards_catalog SET price_coins = 2200, price_points = 2200, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000077'; -- ИМПЕРАТОР
UPDATE public.rewards_catalog SET price_coins = 2800, price_points = 2800, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000065'; -- ОВЕРЛОРД
UPDATE public.rewards_catalog SET price_coins = 3000, price_points = 3000, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000073'; -- САНТА
UPDATE public.rewards_catalog SET price_coins = 5000, price_points = 5000, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000016'; -- КИБОРГ
UPDATE public.rewards_catalog SET price_coins = 5500, price_points = 5500, is_active = TRUE WHERE id = '10000000-0000-0000-0000-000000000078'; -- ДЕМИУРГ

-- 2.6 DEACTIVATE FREE SPINS FROM SHOP (PER USER REQUIREMENT 4)
UPDATE public.rewards_catalog
SET is_active = FALSE, price_coins = NULL, price_points = NULL
WHERE id IN ('10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000011');

-- 2.7 STRICTLY EXCLUDE UC, ROULETTE COINS & VIP TITLE FROM PURCHASES
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000001'; -- 30 UC
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000002'; -- 60 UC
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000017'; -- Титул VIP
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000051'; -- 25 Монет (Рулетка)
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000052'; -- 50 Монет (Рулетка)
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000053'; -- 75 Монет (Рулетка)
UPDATE public.rewards_catalog SET price_coins = NULL, price_points = NULL WHERE id = '10000000-0000-0000-0000-000000000054'; -- 125 Монет (Рулетка)

-- ------------------------------------------------------------------------------
-- 3. CANONICAL ATOMIC RPC FUNCTION: purchase_item_atomic
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
    -- 1. Security: Block unauthenticated or anon callers
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

    -- 4. STRICT EXCLUSION CHECK: UC, VIP, and spins cannot be bought in shop
    IF LOWER(v_clean_slug) IN ('reward-uc-30', 'reward-uc-60', 'title-vip', 'vip', 'reward-spin-1', 'reward-spin-2')
       OR LOWER(v_clean_slug) LIKE '%uc%vip%'
       OR LOWER(v_clean_slug) LIKE '%vip%uc%'
       OR LOWER(v_clean_slug) LIKE '%spin%' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Данный товар недоступен для покупки за монеты');
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

    -- 5.2: If not found by UUID, try exact title_slug / slug match
    IF v_reward.id IS NULL THEN
        SELECT COUNT(*) INTO v_match_count
        FROM public.rewards_catalog 
        WHERE (
            LOWER(COALESCE(title_slug, '')) = LOWER(v_clean_slug)
            OR LOWER(COALESCE(title_slug, '')) = LOWER(v_stripped_slug)
            OR LOWER(CONCAT('title-', COALESCE(title_slug, ''))) = LOWER(v_clean_slug)
            OR LOWER(CONCAT('reward-', COALESCE(title_slug, ''))) = LOWER(v_clean_slug)
            OR LOWER(COALESCE(slug, '')) = LOWER(v_clean_slug)
            OR LOWER(COALESCE(slug, '')) = LOWER(v_stripped_slug)
        )
        AND is_active = TRUE;

        IF v_match_count > 1 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Неоднозначность поиска: найдено несколько товаров с данным slug');
        ELSIF v_match_count = 1 THEN
            SELECT * INTO v_reward 
            FROM public.rewards_catalog 
            WHERE (
                LOWER(COALESCE(title_slug, '')) = LOWER(v_clean_slug)
                OR LOWER(COALESCE(title_slug, '')) = LOWER(v_stripped_slug)
                OR LOWER(CONCAT('title-', COALESCE(title_slug, ''))) = LOWER(v_clean_slug)
                OR LOWER(CONCAT('reward-', COALESCE(title_slug, ''))) = LOWER(v_clean_slug)
                OR LOWER(COALESCE(slug, '')) = LOWER(v_clean_slug)
                OR LOWER(COALESCE(slug, '')) = LOWER(v_stripped_slug)
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

    -- Exclude UC and spins category
    IF COALESCE(v_reward.category::text, '') IN ('uc', 'spins') 
       OR LOWER(v_reward.name) = 'vip' 
       OR LOWER(v_reward.name) LIKE '%uc vip%'
       OR LOWER(v_reward.name) LIKE '%бесплатное вращение%' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Данный товар недоступен для покупки в магазине');
    END IF;

    -- Determine item type (title or gift)
    IF v_reward.is_title IS TRUE OR LOWER(COALESCE(v_reward.category::text, '')) = 'titles' THEN
        v_item_type := 'title';
    ELSE
        v_item_type := 'gift';
    END IF;

    -- 6. AUTHORITATIVE PRICE DETERMINATION: price_coins MUST be strictly > 0
    -- ROOT CAUSE FIX: Never fallback to v_reward.value!
    IF v_reward.price_coins IS NULL OR v_reward.price_coins <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Данный товар недоступен для покупки в магазине (цена не установлена)');
    END IF;

    v_unit_cost := v_reward.price_coins;

    -- 7. Cost Calculation: Admin is 0 cost, standard user pays unit_cost * p_quantity
    IF v_is_admin THEN
        v_total_cost := 0;
    ELSE
        v_total_cost_bigint := (v_unit_cost::BIGINT) * (p_quantity::BIGINT);
        IF v_total_cost_bigint > 2147483647 OR v_total_cost_bigint < 0 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Превышен максимальный лимит стоимости операции');
        END IF;
        v_total_cost := v_total_cost_bigint::INTEGER;
    END IF;

    -- 8. Balance Verification & Safe Deduction
    v_current_coins := COALESCE(v_user.coins_balance, v_user.points_balance, 0);

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

    -- Atomically update coins_balance and synchronize points_balance
    UPDATE public.users 
    SET 
        coins_balance = v_new_coins,
        points_balance = v_new_coins,
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

    -- 10. Record Purchase History
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
        v_total_cost,
        p_quantity,
        v_is_admin,
        NOW()
    );

    -- 11. Record Public Feed Event (if public_events table exists)
    BEGIN
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
            p_user_id,
            COALESCE('@' || v_user.username, 'Игрок'),
            v_reward.id,
            v_reward.name,
            v_reward.rarity,
            v_reward.category,
            'item_purchased',
            NOW()
        );
    EXCEPTION
        WHEN undefined_table THEN
            NULL;
    END;

    -- 12. Return structured success payload
    RETURN jsonb_build_object(
        'success', true,
        'item', jsonb_build_object(
            'id', v_reward.id,
            'slug', COALESCE(v_reward.title_slug, v_reward.id::text),
            'title_slug', v_reward.title_slug,
            'name', v_reward.name,
            'category', v_reward.category,
            'rarity', v_reward.rarity,
            'is_title', v_reward.is_title,
            'quantity', v_final_quantity
        ),
        'cost_coins', v_total_cost,
        'cost_points', v_total_cost,
        'coins_balance', v_new_coins,
        'points_balance', v_new_coins,
        'is_admin', v_is_admin,
        'message', format('Товар «%s» успешно приобретен и добавлен в ваш Инвентарь!', v_reward.name)
    );
END;
$$;

-- Permissions for purchase_item_atomic: anon cannot execute
REVOKE ALL ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. CANONICAL ATOMIC RPC FUNCTION: sell_duplicate_atomic
-- ------------------------------------------------------------------------------
-- Ensure no legacy reverse-signature function exists
DROP FUNCTION IF EXISTS public.sell_duplicate_atomic(UUID, TEXT);

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
    v_new_qty INTEGER;
    v_min_price INTEGER;
    v_max_price INTEGER;
    v_clean_identifier TEXT;
    v_rarity_clean TEXT;
BEGIN
    -- Security: Block anon callers
    IF (auth.role() IS NULL) OR (auth.role() = 'anon') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Требуется авторизация для продажи предметов');
    END IF;

    -- Security: Authenticated caller can only sell from their own inventory
    IF auth.role() = 'authenticated' THEN
        IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'Вы можете продавать предметы только со своего аккаунта');
        END IF;
    ELSIF (auth.jwt() ->> 'role') IS NOT DISTINCT FROM 'service_role' OR current_user = 'postgres' THEN
        NULL;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Неавторизованный вызов функции продажи дубликатов');
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

    -- 2. Locate reward in catalog
    SELECT * INTO v_reward 
    FROM public.rewards_catalog 
    WHERE (
        (v_clean_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id = v_clean_identifier::UUID)
        OR LOWER(COALESCE(title_slug, '')) = LOWER(v_clean_identifier)
        OR LOWER(COALESCE(title_slug, '')) = LOWER(REPLACE(v_clean_identifier, 'title-', ''))
        OR LOWER(COALESCE('title-' || title_slug, '')) = LOWER(v_clean_identifier)
        OR LOWER(COALESCE(slug, '')) = LOWER(v_clean_identifier)
        OR LOWER(id::text) = LOWER(v_clean_identifier)
        OR LOWER(name) = LOWER(v_clean_identifier)
    )
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
        RETURN jsonb_build_object('success', false, 'error', 'Нельзя продать единственный экземпляр предмета. Доступна продажа только дубликатов (x2 и более).');
    END IF;

    -- Rule: Cannot sell equipped title without duplicates
    IF (v_reward.is_title OR v_reward.category = 'titles') AND v_user.active_title_id = v_reward.id AND v_inv.quantity <= 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Нельзя продать единственный надетый титул.');
    END IF;

    -- 4. Server-Side Random Price Calculation based on verified rarity
    v_rarity_clean := LOWER(REPLACE(COALESCE(v_reward.rarity::text, 'common'), '_', '-'));
    CASE v_rarity_clean
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

    -- 6. Credit coins to user balance and synchronize points_balance
    v_new_coins := COALESCE(v_user.coins_balance, v_user.points_balance, 0) + v_coins_earned;

    UPDATE public.users 
    SET coins_balance = v_new_coins,
        points_balance = v_new_coins,
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
            format('Вы продали дубликат «%s» за +%s Coins! Монеты зачислены на ваш баланс.', v_reward.name, v_coins_earned),
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
        'coinsEarned', v_coins_earned,
        'earnedCoins', v_coins_earned,
        'coins_balance', v_new_coins,
        'coinsBalance', v_new_coins,
        'points_balance', v_new_coins,
        'pointsBalance', v_new_coins,
        'remaining_quantity', v_new_qty,
        'remainingQuantity', v_new_qty,
        'rewardName', v_reward.name,
        'message', format('Дубликат «%s» успешно продан за %s Coins!', v_reward.name, v_coins_earned)
    );
END;
$$;

-- Permissions for sell_duplicate_atomic
REVOKE ALL ON FUNCTION public.sell_duplicate_atomic(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sell_duplicate_atomic(TEXT, UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. RELOAD POSTGREST SCHEMA CACHE
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;
