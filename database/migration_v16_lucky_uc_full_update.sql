-- ==============================================================================
-- LUCKY UC - Migration V16: Full Platform Update
-- 1. Sales history table & Atomic Duplicate Selling (sell_duplicate_atomic RPC)
-- 2. New titles insertion: Терпилла, Подсос, Санта (Legendary), Femboy, Nefor, Balbibol, Император, Демиург
-- 3. Update OVERLORD price: 1800 -> 2800 Coins (+1000 Coins)
-- 4. Expand Standard account capacity: from 14 to 104 slots (100 Standard + 4 VIP)
-- 5. Seed Standard accounts (Standard11 to Standard100)
-- 6. Update play_spin_atomic RPC: 4% Legendary, unchanged UC (1.3%), 100% total sum, title drops
-- ==============================================================================

-- ------------------------------------------------------------------------------
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
-- 2. SALES HISTORY TABLE (DUPLICATES SELLING)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES public.rewards_catalog(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    item_rarity reward_rarity NOT NULL,
    coins_earned INTEGER NOT NULL CHECK (coins_earned > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_history_user ON public.sales_history(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_history_created ON public.sales_history(created_at DESC);

ALTER TABLE public.sales_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sales history" ON public.sales_history;
CREATE POLICY "Users can view own sales history" 
    ON public.sales_history FOR SELECT 
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access sales" ON public.sales_history;
CREATE POLICY "Service role full access sales" 
    ON public.sales_history FOR ALL 
    USING (auth.role() = 'service_role');

-- ------------------------------------------------------------------------------
-- 3. ATOMIC RPC FUNCTION: sell_duplicate_atomic
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sell_duplicate_atomic(
    p_user_id UUID,
    p_reward_identifier TEXT
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
    v_new_points INTEGER;
    v_new_qty INTEGER;
    v_min_price INTEGER;
    v_max_price INTEGER;
    v_is_equipped BOOLEAN := FALSE;
BEGIN
    -- Security: Authenticated caller can only sell from their own inventory
    IF auth.uid() IS NOT NULL AND auth.role() = 'authenticated' AND auth.uid() <> p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Вы можете продавать предметы только со своего аккаунта');
    END IF;

    IF p_reward_identifier IS NULL OR TRIM(p_reward_identifier) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Укажите идентификатор предмета');
    END IF;

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
    WHERE (LOWER(COALESCE(title_slug, '')) = LOWER(p_reward_identifier)
       OR LOWER(COALESCE(title_slug, '')) = LOWER(REPLACE(p_reward_identifier, 'title-', ''))
       OR LOWER(id::text) = LOWER(p_reward_identifier)
       OR LOWER(name) = LOWER(p_reward_identifier))
      AND is_active = TRUE
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
        RETURN jsonb_build_object('success', false, 'error', 'Нельзя продать единственный экземпляр предмета. Доступна продажа только дубликатов.');
    END IF;

    -- Rule: Cannot sell only equipped title
    IF (v_reward.is_title OR v_reward.category = 'titles') AND v_user.active_title_id = v_reward.id THEN
        v_is_equipped := TRUE;
    END IF;

    -- 4. Server-Side Random Price Calculation based on verified rarity
    -- Common: 5–10 Coins
    -- Uncommon: 10–20 Coins
    -- Rare: 20–35 Coins
    -- Epic: 40–55 Coins
    -- Pro-Epic: 80–100 Coins
    -- Mythic: 150–200 Coins
    -- Legendary: 250–350 Coins
    CASE v_reward.rarity
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

    -- 6. Credit coins to user balance (and sync points)
    v_new_coins := COALESCE(v_user.coins_balance, v_user.points_balance, 0) + v_coins_earned;
    v_new_points := v_new_coins;

    UPDATE public.users 
    SET coins_balance = v_new_coins,
        points_balance = v_new_points,
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

    -- 8. Add system notification
    INSERT INTO public.notifications (user_id, type, title, message, data, created_at)
    VALUES (
        p_user_id,
        'system',
        'Дубликат успешно продан! 🪙',
        'Вы продали дубликат «' || v_reward.name || '» за +' || v_coins_earned || ' Coins! Монеты зачислены на ваш баланс.',
        jsonb_build_object(
            'rewardName', v_reward.name,
            'rewardRarity', v_reward.rarity,
            'coinsEarned', v_coins_earned,
            'remainingQuantity', v_new_qty
        ),
        NOW()
    );

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
        'coins_balance', v_new_coins,
        'points_balance', v_new_points,
        'message', 'Дубликат «' || v_reward.name || '» успешно продан за ' || v_coins_earned || ' Coins!'
    );
END;
$$;

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
-- 6. EXPAND SYSTEM CONFIG TO 104 SLOTS (100 STANDARD + 4 VIP)
-- ------------------------------------------------------------------------------
INSERT INTO public.system_config (key, value)
VALUES ('max_player_slots', '{"max": 104, "standard_max": 100, "vip_max": 4}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = '{"max": 104, "standard_max": 100, "vip_max": 4}'::jsonb;

-- ------------------------------------------------------------------------------
-- 7. SEED 90 ADDITIONAL STANDARD ACCOUNTS (Standard11 to Standard100)
-- ------------------------------------------------------------------------------
INSERT INTO public.users (
    username, first_name, password_hash, recovery_key_hash, avatar_url,
    total_uc, spins_count, total_popularity, free_spins_balance,
    is_vip, is_admin, is_approved, is_blocked, profile_frame, vip_badge, coins_balance, points_balance
)
SELECT 
    'Standard' || lpad(s::text, 2, '0'),
    'Standard' || lpad(s::text, 2, '0'),
    NULL,
    NULL,
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    0, 0, 0, 2,
    FALSE, FALSE, TRUE, FALSE, 'default', NULL, 0, 0
FROM generate_series(11, 100) s
ON CONFLICT (username) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 8. UPGRADE play_spin_atomic (ROVNO 4% LEGENDARY, UNCHANGED UC, 100% TOTAL)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.play_spin_atomic(
    p_user_id UUID,
    p_reward_id UUID DEFAULT NULL
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
    v_new_coins INTEGER;
    v_new_points INTEGER;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Security: Authenticated caller can only spin for their own account
    IF auth.uid() IS NOT NULL AND auth.role() = 'authenticated' AND auth.uid() <> p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Вы можете вращать колесо только со своего аккаунта');
    END IF;

    -- Security: If invoked directly by authenticated user (bypassing backend), ignore client-chosen reward
    IF auth.role() = 'authenticated' THEN
        p_reward_id := NULL;
    END IF;

    -- 1. Fetch user for update
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Пользователь не найден');
    END IF;

    IF v_user.is_blocked THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ваш аккаунт заблокирован');
    END IF;

    v_is_vip_admin := (v_user.is_vip = TRUE OR v_user.is_admin = TRUE);

    -- 2. Verify spin balance (unlimited for VIP/Admin)
    IF NOT v_is_vip_admin THEN
        IF COALESCE(v_user.free_spins_balance, 0) <= 0 THEN
            RETURN jsonb_build_object('success', false, 'error', 'У вас закончились бесплатные вращения на сегодня!');
        END IF;
    END IF;

    -- 3. Resolve reward: exact probabilities adding up to 100%
    IF p_reward_id IS NOT NULL THEN
        SELECT * INTO v_reward FROM public.rewards_catalog WHERE id = p_reward_id AND is_active = TRUE;
    END IF;

    IF v_reward.id IS NULL THEN
        v_rand := random() * 100.0;
        
        -- 1. Coins (46.0% total)
        IF v_rand < 46.0 THEN
            IF v_rand < 24.0 THEN
                SELECT * INTO v_reward FROM public.rewards_catalog WHERE id = '10000000-0000-0000-0000-000000000051' AND is_active = TRUE;
            ELSIF v_rand < 37.0 THEN
                SELECT * INTO v_reward FROM public.rewards_catalog WHERE id = '10000000-0000-0000-0000-000000000052' AND is_active = TRUE;
            ELSIF v_rand < 43.0 THEN
                SELECT * INTO v_reward FROM public.rewards_catalog WHERE id = '10000000-0000-0000-0000-000000000053' AND is_active = TRUE;
            ELSE
                SELECT * INTO v_reward FROM public.rewards_catalog WHERE id = '10000000-0000-0000-0000-000000000054' AND is_active = TRUE;
            END IF;
        
        -- 2. UC - Unchanged current probability (1.3% total)
        ELSIF v_rand < 47.3 THEN
            IF v_rand < 46.8 THEN
                SELECT * INTO v_reward FROM public.rewards_catalog WHERE id = '10000000-0000-0000-0000-000000000001' AND is_active = TRUE;
            ELSE
                SELECT * INTO v_reward FROM public.rewards_catalog WHERE id = '10000000-0000-0000-0000-000000000002' AND is_active = TRUE;
            END IF;
        
        -- 3. Common items & titles (22.3%)
        ELSIF v_rand < 69.6 THEN
            SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity = 'common' AND category <> 'coins' AND category <> 'uc' AND is_active = TRUE ORDER BY random() LIMIT 1;
        
        -- 4. Uncommon items & titles (13.0%)
        ELSIF v_rand < 82.6 THEN
            SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity = 'uncommon' AND category <> 'coins' AND category <> 'uc' AND is_active = TRUE ORDER BY random() LIMIT 1;
        
        -- 5. Rare items & titles (8.2%)
        ELSIF v_rand < 90.8 THEN
            SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity = 'rare' AND category <> 'coins' AND category <> 'uc' AND is_active = TRUE ORDER BY random() LIMIT 1;
        
        -- 6. Epic items & titles (4.5%)
        ELSIF v_rand < 95.3 THEN
            SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity = 'epic' AND category <> 'coins' AND category <> 'uc' AND is_active = TRUE ORDER BY random() LIMIT 1;
        
        -- 7. Mythic items & titles (0.7%)
        ELSIF v_rand < 96.0 THEN
            SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity = 'mythic' AND category <> 'coins' AND category <> 'uc' AND is_active = TRUE ORDER BY random() LIMIT 1;
        
        -- 8. Legendary items & titles (EXACTLY 4.0%: 96.0 to 100.0)
        ELSE
            SELECT * INTO v_reward FROM public.rewards_catalog 
            WHERE rarity = 'legendary' AND category <> 'coins' AND category <> 'uc' 
              AND COALESCE(title_slug, '') <> 'vip' AND is_active = TRUE 
            ORDER BY random() LIMIT 1;
        END IF;
    END IF;

    -- Ultimate fallback: any active non-VIP reward
    IF v_reward.id IS NULL THEN
        SELECT * INTO v_reward FROM public.rewards_catalog 
        WHERE is_active = TRUE AND COALESCE(title_slug, '') <> 'vip' 
        ORDER BY random() LIMIT 1;
    END IF;

    IF v_reward.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Каталог наград пуст или недоступен');
    END IF;

    -- 4. Apply balances safely
    v_new_uc := COALESCE(v_user.total_uc, 0);
    v_new_pop := COALESCE(v_user.total_popularity, 0);
    v_new_coins := COALESCE(v_user.coins_balance, v_user.points_balance, 0);
    v_new_points := v_new_coins;

    IF v_is_vip_admin THEN
        v_new_spins := COALESCE(v_user.free_spins_balance, 999999);
    ELSE
        v_new_spins := v_user.free_spins_balance - 1;
    END IF;

    IF v_reward.category = 'spins' OR COALESCE(v_reward.title_slug, '') LIKE '%spin%' THEN
        IF NOT v_is_vip_admin THEN
            v_new_spins := v_new_spins + COALESCE(v_reward.value, 1);
        END IF;
    ELSIF v_reward.category = 'coins' OR COALESCE(v_reward.title_slug, '') LIKE '%coins%' THEN
        v_new_coins := v_new_coins + COALESCE(v_reward.value, 0);
        v_new_points := v_new_coins;
    ELSIF v_reward.category = 'uc' OR COALESCE(v_reward.title_slug, '') LIKE '%uc%' THEN
        v_new_uc := v_new_uc + COALESCE(v_reward.value, 0);
    ELSIF v_reward.category = 'popularity' OR COALESCE(v_reward.title_slug, '') LIKE '%pop%' THEN
        v_new_pop := v_new_pop + COALESCE(v_reward.value, 0);
        INSERT INTO public.popularity_transactions (user_id, amount, source, description, reference_id, created_at)
        VALUES (p_user_id, COALESCE(v_reward.value, 0), 'spin', 'Выигрыш на Колесе: ' || v_reward.name, 'spin-' || gen_random_uuid()::text, v_now);
    ELSE
        -- Inventory item or title: insert with quantity increment
        INSERT INTO public.user_inventory (user_id, reward_id, quantity, acquired_at, updated_at)
        VALUES (v_user.id, v_reward.id, 1, v_now, v_now)
        ON CONFLICT (user_id, reward_id)
        DO UPDATE SET quantity = user_inventory.quantity + 1, updated_at = v_now;
    END IF;

    -- Update user state
    UPDATE public.users
    SET free_spins_balance = v_new_spins,
        total_uc = v_new_uc,
        total_popularity = v_new_pop,
        coins_balance = v_new_coins,
        points_balance = v_new_points,
        spins_count = COALESCE(spins_count, 0) + 1,
        popularity_updated_at = CASE WHEN v_reward.category = 'popularity' THEN v_now ELSE popularity_updated_at END,
        updated_at = v_now
    WHERE id = v_user.id;

    -- Add spin history record
    INSERT INTO public.spins_history (user_id, reward_id, reward_name, reward_rarity, reward_value, created_at)
    VALUES (v_user.id, v_reward.id, v_reward.name, v_reward.rarity, COALESCE(v_reward.value, 0), v_now);

    -- Public event & notification
    IF v_reward.rarity IN ('rare', 'epic', 'mythic', 'legendary', 'pro-epic') OR v_reward.category IN ('coins', 'popularity') THEN
        INSERT INTO public.public_events (user_id, username, reward_id, reward_name, reward_rarity, reward_category, event_type, created_at)
        VALUES (
            v_user.id,
            COALESCE('@' || v_user.username, 'Игрок'),
            v_reward.id,
            v_reward.name,
            v_reward.rarity,
            v_reward.category,
            'reward_received',
            v_now
        );

        INSERT INTO public.notifications (user_id, type, title, message, data, created_at)
        VALUES (
            v_user.id,
            'spin_win',
            CASE 
                WHEN v_reward.category = 'coins' THEN 'Выигрыш ' || v_reward.name || '! 🪙'
                WHEN v_reward.category = 'popularity' THEN 'Выигрыш ' || v_reward.name || '! 🔥'
                ELSE 'Новогодний выигрыш! 🎄'
            END,
            'Поздравляем! Вы выиграли «' || v_reward.name || '» на Колесе Фортуны!',
            jsonb_build_object(
                'rewardId', v_reward.id,
                'rewardName', v_reward.name,
                'rewardRarity', v_reward.rarity,
                'category', v_reward.category,
                'value', v_reward.value
            ),
            v_now
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'reward', jsonb_build_object(
            'id', v_reward.id,
            'slug', COALESCE(v_reward.title_slug, v_reward.id::text),
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
        'total_spins', COALESCE(v_user.spins_count, 0) + 1,
        'total_uc', v_new_uc,
        'total_popularity', v_new_pop,
        'coins_balance', v_new_coins,
        'points_balance', v_new_points,
        'is_vip_admin', v_is_vip_admin
    );
END;
$$;
