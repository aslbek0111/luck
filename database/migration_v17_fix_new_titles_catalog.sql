-- ==============================================================================
-- LUCKY UC - Migration V17: Fix New Titles Catalog Registration
-- Fixes error: «Товар не найден в каталоге наград»
-- 1. Verifies reward_rarity and reward_category enums
-- 2. Inserts / Updates all 8 new titles in public.rewards_catalog with deterministic UUIDs
-- 3. Updates purchase_item_atomic RPC to resolve UUIDs, title-* slugs, bare slugs, and names
-- 4. Ensures title pricing respects rewards_catalog.value (Coins)
-- ==============================================================================

-- 1. ENUMS VERIFICATION
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------

-- 4. UPDATE OVERLORD PRICE (1800 + 1000 = 2800 COINS)
-- ------------------------------------------------------------------------------
UPDATE public.rewards_catalog
SET value = 2800,
    conditions = 'Приобрести в магазине за 2800 монет.'
WHERE id = '10000000-0000-0000-0000-000000000065' 
   OR LOWER(title_slug) = 'overlord';

-- ------------------------------------------------------------------------------
-- 5. INSERT NEW TITLES INTO REWARDS CATALOG
-- ------------------------------------------------------------------------------
INSERT INTO public.rewards_catalog (id, name, category, rarity, icon_name, description, value, is_title, title_slug, conditions, is_active)
VALUES
    -- 1. Терпилла (Rare)
    ('10000000-0000-0000-0000-000000000071', 'ТЕРПИЛЛА', 'titles', 'rare', 'Shield', 'Терпит любые капризы фортуны, промахи и серии неудач, чтобы в итоге забрать самый жирный куш.', 300, TRUE, 'terpilla', 'Выпадает из Lucky Spin или приобретается за 300 монет.', TRUE),
    -- 2. Подсос (Rare)
    ('10000000-0000-0000-0000-000000000072', 'ПОДСОС', 'titles', 'rare', 'Smile', 'Мастерски находит богатых друзей и всегда оказывается рядом в момент щедрой раздачи подарков.', 350, TRUE, 'podsos', 'Выпадает из Lucky Spin или приобретается за 350 монет.', TRUE),
    -- 3. Санта (Legendary)
    ('10000000-0000-0000-0000-000000000073', 'САНТА', 'titles', 'legendary', 'TreePine', 'Главный символ новогоднего триумфа! Рассылает подарки, дарит золотой блеск и приносит новогоднее чудо.', 3000, TRUE, 'santa', 'Легендарный дроп из Lucky Spin или 3000 монет в магазине.', TRUE),
    -- 4. FEMBOY (Epic)
    ('10000000-0000-0000-0000-000000000074', 'FEMBOY', 'titles', 'epic', 'Sparkles', 'Особый эстетичный титул! При экипировке рядом с вашим никнеймом появляется уникальная иллюстрация персонажа.', 800, TRUE, 'femboy', 'Приобрести в магазине за 800 монет или выиграть в Lucky Spin.', TRUE),
    -- 5. NEFOR (Rare)
    ('10000000-0000-0000-0000-000000000075', 'NEFOR', 'titles', 'rare', 'Flame', 'Бунтарский стиль, альтернативный кибер-вайб и полная независимость от чужих ожиданий.', 450, TRUE, 'nefor', 'Приобрести в магазине за 450 монет или выиграть в Lucky Spin.', TRUE),
    -- 6. BALBIBOL (Uncommon)
    ('10000000-0000-0000-0000-000000000076', 'BALBIBOL', 'titles', 'uncommon', 'Award', 'Задорный уличный вайб, бесконечный позитив, надутая жвачка и лёгкость на каждом спине.', 150, TRUE, 'balbibol', 'Приобрести в магазине за 150 монет или выиграть в Lucky Spin.', TRUE),
    -- 7. ИМПЕРАТОР (Pro-Epic)
    ('10000000-0000-0000-0000-000000000077', 'ИМПЕРАТОР', 'titles', 'pro-epic', 'Crown', 'Абсолютный триумфатор платформы. Вершина PRO-мастерства, безграничные амбиции и непоколебимый авторитет.', 2200, TRUE, 'imperator', 'Приобрести в магазине за 2200 монет.', TRUE),
    -- 8. ДЕМИУРГ (Mythic)
    ('10000000-0000-0000-0000-000000000078', 'ДЕМИУРГ', 'titles', 'mythic', 'Zap', 'Создатель собственной игровой реальности. Управляет вероятностями и направляет колесо фортуны силой мысли.', 5500, TRUE, 'demiurge', 'Мифический статус или покупка в магазине за 5500 монет.', TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    rarity = EXCLUDED.rarity,
    icon_name = EXCLUDED.icon_name,
    description = EXCLUDED.description,
    value = EXCLUDED.value,
    is_title = EXCLUDED.is_title,
    title_slug = EXCLUDED.title_slug,
    conditions = EXCLUDED.conditions,
    is_active = EXCLUDED.is_active;

-- ------------------------------------------------------------------------------
-- 5.1. ATOMIC RPC FUNCTION: purchase_item_atomic (Robust title & reward purchase)
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
    v_is_admin BOOLEAN;
    v_item_type TEXT;
    v_current_balance INTEGER;
    v_new_coins INTEGER;
    v_new_points INTEGER;
    v_final_quantity INTEGER := 0;
    v_clean_slug TEXT;
    v_stripped_slug TEXT;
BEGIN
    -- Security: Authenticated caller can only purchase items for their own account
    IF auth.uid() IS NOT NULL AND auth.role() = 'authenticated' AND auth.uid() <> p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Вы можете совершать покупки только для своего аккаунта');
    END IF;

    -- 1. Input validation
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Недопустимое количество предметов для покупки');
    END IF;

    IF p_item_slug IS NULL OR TRIM(p_item_slug) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Укажите идентификатор товара');
    END IF;

    v_clean_slug := TRIM(p_item_slug);
    v_stripped_slug := REGEXP_REPLACE(v_clean_slug, '^(title-|reward-|gift-)', '', 'i');

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
    IF LOWER(v_clean_slug) = 'reward-uc-30' 
       OR LOWER(v_clean_slug) = 'reward-uc-60' 
       OR LOWER(v_clean_slug) = 'title-vip'
       OR LOWER(v_clean_slug) = 'vip'
       OR LOWER(v_clean_slug) LIKE '%uc%vip%'
       OR LOWER(v_clean_slug) LIKE '%vip%uc%' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Товар UC VIP полностью исключен из покупок за монеты');
    END IF;

    -- 4. Locate reward in rewards_catalog with complete fallback hierarchy
    SELECT * INTO v_reward 
    FROM public.rewards_catalog 
    WHERE (
        id::text = v_clean_slug
        OR LOWER(title_slug) = LOWER(v_clean_slug)
        OR LOWER(title_slug) = LOWER(v_stripped_slug)
        OR LOWER(CONCAT('title-', title_slug)) = LOWER(v_clean_slug)
        OR LOWER(name) = LOWER(v_clean_slug)
        OR LOWER(name) = LOWER(v_stripped_slug)
    )
    AND is_active = TRUE
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Товар не найден в каталоге наград');
    END IF;

    -- Check if item is categorized under 'uc' or named 'VIP'
    IF v_reward.category = 'uc' OR LOWER(v_reward.name) = 'vip' OR LOWER(v_reward.name) LIKE '%uc vip%' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Данный товар (UC VIP) недоступен для покупки в магазине');
    END IF;

    -- Determine item type (title or gift)
    IF v_reward.is_title OR v_reward.category = 'titles' THEN
        v_item_type := 'title';
    ELSE
        v_item_type := 'gift';
    END IF;

    -- 5. Calculate Server-Side Unit Cost in Coins
    IF v_item_type = 'title' THEN
        IF v_reward.value IS NOT NULL AND v_reward.value > 0 THEN
            v_unit_cost := v_reward.value;
        ELSE
            CASE v_reward.rarity
                WHEN 'uncommon' THEN v_unit_cost := 150;
                WHEN 'rare' THEN v_unit_cost := 300;
                WHEN 'epic' THEN v_unit_cost := 750;
                WHEN 'pro-epic' THEN v_unit_cost := 1500;
                WHEN 'legendary' THEN v_unit_cost := 2800;
                WHEN 'mythic' THEN v_unit_cost := 5000;
                ELSE v_unit_cost := 500;
            END CASE;
        END IF;
    ELSE
        IF v_reward.value IS NOT NULL AND v_reward.value > 0 THEN
            v_unit_cost := v_reward.value;
        ELSE
            CASE v_reward.rarity
                WHEN 'common' THEN v_unit_cost := 50;
                WHEN 'uncommon' THEN v_unit_cost := 100;
                WHEN 'rare' THEN v_unit_cost := 200;
                WHEN 'epic' THEN v_unit_cost := 600;
                WHEN 'pro-epic' THEN v_unit_cost := 1500;
                WHEN 'legendary' THEN v_unit_cost := 2800;
                WHEN 'mythic' THEN v_unit_cost := 5500;
                ELSE v_unit_cost := 100;
            END CASE;
        END IF;
    END IF;

    -- If user is ADMIN: UNLIMITED COINS AND POINTS!
    IF v_is_admin THEN
        v_total_cost := 0;
        v_new_coins := COALESCE(v_user.coins_balance, 999999);
        v_new_points := COALESCE(v_user.points_balance, 999999);
    ELSE
        v_total_cost := v_unit_cost * p_quantity;
        v_current_balance := COALESCE(v_user.coins_balance, v_user.points_balance, 0);

        IF v_current_balance < v_total_cost THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Недостаточно Монет для покупки. Требуется: ' || v_total_cost || ', доступно: ' || v_current_balance,
                'required_coins', v_total_cost,
                'required_points', v_total_cost,
                'current_coins', v_current_balance,
                'current_points', v_current_balance
            );
        END IF;

        v_new_coins := v_current_balance - v_total_cost;
        v_new_points := v_new_coins;
    END IF;

    -- 6. Add to user inventory atomically
    INSERT INTO public.user_inventory (user_id, reward_id, quantity, acquired_at, updated_at)
    VALUES (v_user.id, v_reward.id, p_quantity, NOW(), NOW())
    ON CONFLICT (user_id, reward_id)
    DO UPDATE SET 
        quantity = user_inventory.quantity + p_quantity,
        updated_at = NOW()
    RETURNING quantity INTO v_final_quantity;

    -- Fallback safety check: ensure v_final_quantity is properly resolved
    IF v_final_quantity IS NULL OR v_final_quantity = 0 THEN
        SELECT quantity INTO v_final_quantity
        FROM public.user_inventory
        WHERE user_id = v_user.id AND reward_id = v_reward.id;

        IF v_final_quantity IS NULL THEN
            v_final_quantity := p_quantity;
        END IF;
    END IF;

    -- 7. Deduct coins and update user record
    UPDATE public.users 
    SET coins_balance = v_new_coins,
        points_balance = v_new_points,
        updated_at = NOW()
    WHERE id = v_user.id;

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
        COALESCE('@' || v_user.username, 'Игрок'),
        v_reward.id,
        v_reward.name,
        v_reward.rarity,
        v_reward.category,
        'item_purchased',
        NOW()
    );

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
        'points_balance', v_new_points,
        'is_admin', v_is_admin,
        'message', 'Товар «' || v_reward.name || '» успешно приобретен и добавлен в ваш Инвентарь!'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_item_atomic(UUID, TEXT, INTEGER) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
