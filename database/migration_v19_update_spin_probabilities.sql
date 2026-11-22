-- ==============================================================================
-- LUCKY UC - Migration V19: Update Lucky Spin Drop Probabilities
-- Total sum of probabilities: EXACTLY 100.0%
--
-- Distribution:
-- 1. Coins: 46.0% total
--    - 25 Coins:  24.0%
--    - 50 Coins:  13.0%
--    - 75 Coins:   6.0%
--    - 125 Coins:  3.0%
-- 2. UC: 0.05% total
--    - 30 UC: 0.03%
--    - 60 UC: 0.02%
-- 3. Common (items & titles): 22.05%
-- 4. Uncommon (items & titles): 13.0%
-- 5. Rare (items & titles without UC): 8.2%
-- 6. Epic (items & titles without UC): 5.5%
-- 7. Mythic (items & titles): 3.7%
-- 8. Legendary (items & titles): 1.5%
-- ==============================================================================

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
        
        -- 2. UC - Updated probability (0.05% total)
        ELSIF v_rand < 46.05 THEN
            IF v_rand < 46.03 THEN
                SELECT * INTO v_reward FROM public.rewards_catalog WHERE id = '10000000-0000-0000-0000-000000000001' AND is_active = TRUE;
            ELSE
                SELECT * INTO v_reward FROM public.rewards_catalog WHERE id = '10000000-0000-0000-0000-000000000002' AND is_active = TRUE;
            END IF;
        
        -- 3. Common items & titles: 22.05% (46.05 to 68.10)
        ELSIF v_rand < 68.10 THEN
            SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity = 'common' AND category <> 'coins' AND category <> 'uc' AND is_active = TRUE ORDER BY random() LIMIT 1;
        
        -- 4. Uncommon items & titles: 13.0% (68.10 to 81.10)
        ELSIF v_rand < 81.10 THEN
            SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity = 'uncommon' AND category <> 'coins' AND category <> 'uc' AND is_active = TRUE ORDER BY random() LIMIT 1;
        
        -- 5. Rare items & titles: 8.2% (81.10 to 89.30)
        ELSIF v_rand < 89.30 THEN
            SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity = 'rare' AND category <> 'coins' AND category <> 'uc' AND is_active = TRUE ORDER BY random() LIMIT 1;
        
        -- 6. Epic items & titles: 5.5% (89.30 to 94.80)
        ELSIF v_rand < 94.80 THEN
            SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity = 'epic' AND category <> 'coins' AND category <> 'uc' AND is_active = TRUE ORDER BY random() LIMIT 1;
        
        -- 7. Mythic items & titles: 3.7% (94.80 to 98.50)
        ELSIF v_rand < 98.50 THEN
            SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity = 'mythic' AND category <> 'coins' AND category <> 'uc' AND is_active = TRUE ORDER BY random() LIMIT 1;
        
        -- 8. Legendary items & titles (EXACTLY 1.5%: 98.50 to 100.0)
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

GRANT EXECUTE ON FUNCTION public.play_spin_atomic(UUID, UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
