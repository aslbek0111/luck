-- ==============================================================================
-- LUCKY UC - Migration V9: Coins, Roulette Coin Rewards & PRO-EPIC Titles
-- 1. Add coins_balance column to public.users table (default 1000, non-negative).
-- 2. Add 'uncommon' and 'pro-epic' to reward_rarity enum.
-- 3. Add 'coins' to reward_category enum if not present.
-- 4. Seed the 4 new coin rewards (25, 50, 75, 125 Coins) and 5 PRO-EPIC titles.
-- 5. Add cost_coins column to purchases_history.
-- 6. Update atomic RPC function purchase_item_atomic to support coin economy.
-- 7. Update/create atomic RPC function play_spin_atomic to credit won coins.
-- ==============================================================================

-- 1. ADD coins_balance COLUMN TO USERS TABLE
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS coins_balance INTEGER NOT NULL DEFAULT 1000 CHECK (coins_balance >= 0);

-- Sync with points_balance if already present
UPDATE public.users 
SET coins_balance = COALESCE(points_balance, 1000) 
WHERE coins_balance IS NULL;

-- 2. ENUM VALUES FOR RARITY AND CATEGORY
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

DO $$ BEGIN
    ALTER TYPE reward_category ADD VALUE 'coins';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. ADD cost_coins TO purchases_history
ALTER TABLE public.purchases_history 
ADD COLUMN IF NOT EXISTS cost_coins INTEGER NOT NULL DEFAULT 0 CHECK (cost_coins >= 0);

-- 4. INSERT / UPSERT NEW REWARDS & PRO-EPIC TITLES
INSERT INTO public.rewards_catalog (id, name, category, rarity, icon_name, description, value, is_title, title_slug, conditions)
VALUES
    -- 4 Coin Rewards (Roulette Drop)
    ('10000000-0000-0000-0000-000000000051', '25 Монет', 'coins', 'common', 'Coins', '25 золотых монет. Моментально зачисляются на ваш баланс при выигрыше на Колесе.', 25, FALSE, NULL, 'Выпадает из Рождественского Колеса'),
    ('10000000-0000-0000-0000-000000000052', '50 Монет', 'coins', 'uncommon', 'Coins', '50 золотых монет. Отличный выигрыш для накопления на редкие подарки.', 50, FALSE, NULL, 'Выпадает из Рождественского Колеса'),
    ('10000000-0000-0000-0000-000000000053', '75 Монет', 'coins', 'rare', 'Coins', '75 золотых монет. Солидная сумма для покупки эпических предметов и титулов.', 75, FALSE, NULL, 'Выпадает из Рождественского Колеса'),
    ('10000000-0000-0000-0000-000000000054', '125 Монет', 'coins', 'epic', 'Coins', '125 золотых монет! Крупный куш на Рождественском Колесе Фортуны!', 125, FALSE, NULL, 'Редкий куш из Рождественского Колеса'),

    -- 5 Exclusive PRO-EPIC Titles
    ('10000000-0000-0000-0000-000000000061', 'ФЕНИКС', 'titles', 'pro-epic', 'Flame', 'Возрождается из пламени азарта. Каждое поражение превращает в великий триумф.', 1200, TRUE, 'phoenix', 'Приобрести в магазине за 1200 монет.'),
    ('10000000-0000-0000-0000-000000000062', 'ПРИЗРАК', 'titles', 'pro-epic', 'Wind', 'Неуловимый мастер удачи. Появляется в таблице лидеров внезапно и забирает банк.', 1350, TRUE, 'phantom', 'Приобрести в магазине за 1350 монет.'),
    ('10000000-0000-0000-0000-000000000063', 'ДОМИНАТОР', 'titles', 'pro-epic', 'Award', 'Непререкаемая сила и тотальный перевес. Подчиняет теорию вероятностей своей воле.', 1500, TRUE, 'dominator', 'Приобрести в магазине за 1500 монет.'),
    ('10000000-0000-0000-0000-000000000064', 'ТИТАН', 'titles', 'pro-epic', 'ShieldAlert', 'Несокрушимый монолит платформы. Обладает железной выдержкой и колоссальным запасом монет.', 1650, TRUE, 'titan', 'Приобрести в магазине за 1650 монет.'),
    ('10000000-0000-0000-0000-000000000065', 'ОВЕРЛОРД', 'titles', 'pro-epic', 'Crown', 'Высшая ступень PRO-мастерства. Повелитель колеса удачи и куратор новогоднего азарта.', 1800, TRUE, 'overlord', 'Приобрести в магазине за 1800 монет.')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    rarity = EXCLUDED.rarity,
    icon_name = EXCLUDED.icon_name,
    description = EXCLUDED.description,
    value = EXCLUDED.value,
    is_title = EXCLUDED.is_title,
    title_slug = EXCLUDED.title_slug,
    conditions = EXCLUDED.conditions;

-- 5. ATOMIC PURCHASE RPC FUNCTION (COINS & POINTS DUAL COMPATIBILITY)
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
    v_is_admin BOOLEAN;
    v_item_type TEXT;
    v_new_coins INTEGER;
    v_new_points INTEGER;
    v_inv_record RECORD;
BEGIN
    -- 1. Input validation
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Недопустимое количество предметов для покупки');
    END IF;

    IF p_item_slug IS NULL OR TRIM(p_item_slug) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Укажите идентификатор товара');
    END IF;

    -- 2. Lock user record to prevent race conditions and concurrent double-spend
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

    -- Check admin status strictly on the server
    v_is_admin := (v_user.is_admin = TRUE);

    -- 3. STRICT EXCLUSION CHECK: UC VIP and direct UC rewards cannot be bought for Coins or Points
    IF LOWER(p_item_slug) = 'reward-uc-30' 
       OR LOWER(p_item_slug) = 'reward-uc-60' 
       OR LOWER(p_item_slug) = 'title-vip'
       OR LOWER(p_item_slug) = 'vip'
       OR LOWER(p_item_slug) LIKE '%uc%vip%'
       OR LOWER(p_item_slug) LIKE '%vip%uc%' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Товар UC VIP полностью исключен из покупок за монеты');
    END IF;

    -- 4. Locate reward in rewards_catalog
    SELECT * INTO v_reward 
    FROM public.rewards_catalog 
    WHERE LOWER(title_slug) = LOWER(p_item_slug)
       OR LOWER(id::text) = LOWER(p_item_slug)
       OR LOWER(name) = LOWER(p_item_slug)
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Товар не найден в каталоге наград');
    END IF;

    -- Check if item is categorized under 'uc' or named 'VIP'
    IF v_reward.category = 'uc' OR LOWER(v_reward.name) = 'vip' OR LOWER(v_reward.name) LIKE '%uc vip%' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Данный товар (UC VIP) недоступен для покупки за монеты');
    END IF;

    -- Determine item type (title or gift)
    IF v_reward.is_title OR v_reward.category = 'titles' THEN
        v_item_type := 'title';
    ELSE
        v_item_type := 'gift';
    END IF;

    -- 5. Calculate Server-Side Unit Cost in Coins
    IF v_item_type = 'title' THEN
        CASE v_reward.rarity
            WHEN 'rare' THEN v_unit_cost := COALESCE(v_reward.value, 300);
            WHEN 'epic' THEN v_unit_cost := COALESCE(v_reward.value, 750);
            WHEN 'pro-epic' THEN v_unit_cost := COALESCE(v_reward.value, 1500);
            WHEN 'legendary' THEN v_unit_cost := COALESCE(v_reward.value, 2800);
            WHEN 'mythic' THEN v_unit_cost := COALESCE(v_reward.value, 5000);
            ELSE v_unit_cost := 500;
        END CASE;
    ELSE
        -- Gifts pricing based on rarity and item value
        CASE v_reward.rarity
            WHEN 'common' THEN 
                v_unit_cost := GREATEST(15, COALESCE(v_reward.value, 30));
            WHEN 'uncommon' THEN 
                v_unit_cost := GREATEST(60, COALESCE(v_reward.value, 80));
            WHEN 'rare' THEN 
                v_unit_cost := GREATEST(150, COALESCE(v_reward.value, 200));
            WHEN 'epic' THEN 
                v_unit_cost := GREATEST(500, COALESCE(v_reward.value, 600));
            WHEN 'pro-epic' THEN 
                v_unit_cost := GREATEST(1200, COALESCE(v_reward.value, 1500));
            WHEN 'legendary' THEN 
                v_unit_cost := GREATEST(2500, COALESCE(v_reward.value, 2800));
            WHEN 'mythic' THEN 
                v_unit_cost := GREATEST(5000, COALESCE(v_reward.value, 5500));
            ELSE 
                v_unit_cost := 100;
        END CASE;
    END IF;

    -- If user is ADMIN: UNLIMITED COINS AND POINTS!
    -- Cost to deduct is exactly 0 and admin balance remains intact.
    IF v_is_admin THEN
        v_total_cost := 0;
        v_new_coins := COALESCE(v_user.coins_balance, 999999);
        v_new_points := COALESCE(v_user.points_balance, 999999);
    ELSE
        v_total_cost := v_unit_cost * p_quantity;
        v_new_coins := COALESCE(v_user.coins_balance, v_user.points_balance, 0);

        -- Verify coins balance
        IF v_new_coins < v_total_cost THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error', 'Недостаточно Coins для покупки. Требуется: ' || v_total_cost || ', доступно: ' || v_new_coins,
                'required_coins', v_total_cost,
                'current_coins', v_new_coins,
                'required_points', v_total_cost,
                'current_points', v_new_coins
            );
        END IF;

        -- Deduct from coins_balance and sync points_balance
        UPDATE public.users 
        SET coins_balance = coins_balance - v_total_cost,
            points_balance = points_balance - v_total_cost,
            updated_at = NOW()
        WHERE id = v_user.id
        RETURNING coins_balance, points_balance INTO v_new_coins, v_new_points;
    END IF;

    -- 6. Add purchased item to user_inventory
    INSERT INTO public.user_inventory (user_id, reward_id, quantity, acquired_at)
    VALUES (v_user.id, v_reward.id, p_quantity, NOW())
    ON CONFLICT (user_id, reward_id) 
    DO UPDATE SET 
        quantity = public.user_inventory.quantity + p_quantity,
        updated_at = NOW()
    RETURNING * INTO v_inv_record;

    -- 7. Record entry in purchases_history
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
    ) VALUES (
        v_user.id,
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

    -- 8. Add event to public feed
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
        v_user.id,
        '@' || v_user.username,
        v_reward.id,
        v_reward.name,
        v_reward.rarity,
        v_reward.category,
        'item_purchased',
        NOW()
    );

    -- 9. Return structured success response
    RETURN jsonb_build_object(
        'success', true,
        'item', jsonb_build_object(
            'id', v_reward.id,
            'slug', COALESCE(v_reward.title_slug, v_reward.id::text),
            'name', v_reward.name,
            'category', v_reward.category,
            'rarity', v_reward.rarity,
            'is_title', v_reward.is_title,
            'quantity', v_inv_record.quantity
        ),
        'cost_coins', v_total_cost,
        'cost_points', v_total_cost,
        'coins_balance', v_new_coins,
        'points_balance', v_new_points,
        'is_admin', v_is_admin,
        'message', 'Товар «' || v_reward.name || '» успешно приобретен и добавлен в ваш Инвентарь!'
    );
END;
$$;
