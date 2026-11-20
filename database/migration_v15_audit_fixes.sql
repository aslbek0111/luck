-- ==============================================================================
-- LUCKY UC - Migration V15: Production Audit Fixes & Atomic Inventory Operations
-- 1. Populate missing title_slug in rewards_catalog for PRO-EPIC titles
-- 2. Fix gift RPC table reference: rewards -> public.rewards_catalog
-- 3. Fix purchase_item_atomic title_slug, UUID & name lookup
-- 4. Implement use_inventory_item_atomic RPC for using consumable items
-- 5. Upgrade play_spin_atomic to support coin economy and atomic spin consumption
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. POPULATE MISSING TITLE_SLUGS IN rewards_catalog FOR PRO-EPIC TITLES
-- ------------------------------------------------------------------------------
UPDATE public.rewards_catalog SET title_slug = 'phoenix' WHERE id = '10000000-0000-0000-0000-000000000061' AND (title_slug IS NULL OR title_slug = '');
UPDATE public.rewards_catalog SET title_slug = 'phantom' WHERE id = '10000000-0000-0000-0000-000000000062' AND (title_slug IS NULL OR title_slug = '');
UPDATE public.rewards_catalog SET title_slug = 'dominator' WHERE id = '10000000-0000-0000-0000-000000000063' AND (title_slug IS NULL OR title_slug = '');
UPDATE public.rewards_catalog SET title_slug = 'titan' WHERE id = '10000000-0000-0000-0000-000000000064' AND (title_slug IS NULL OR title_slug = '');
UPDATE public.rewards_catalog SET title_slug = 'overlord' WHERE id = '10000000-0000-0000-0000-000000000065' AND (title_slug IS NULL OR title_slug = '');

-- ------------------------------------------------------------------------------
-- 2. FIX send_player_gift_with_message_atomic (rewards -> public.rewards_catalog)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_player_gift_with_message_atomic(
  p_sender_id UUID,
  p_recipient_username TEXT,
  p_reward_id UUID,
  p_quantity INTEGER DEFAULT 1,
  p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recipient RECORD;
  v_sender RECORD;
  v_reward RECORD;
  v_sender_inv RECORD;
  v_new_qty INTEGER;
  v_spins_to_add INTEGER;
  v_uc_to_add INTEGER;
  v_coins_to_add INTEGER;
  v_notif_title TEXT;
  v_notif_msg TEXT;
  v_is_spin BOOLEAN := FALSE;
  v_is_uc BOOLEAN := FALSE;
  v_is_coins BOOLEAN := FALSE;
BEGIN
  IF p_quantity < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Количество должно быть не менее 1');
  END IF;

  SELECT * INTO v_sender FROM public.users WHERE id = p_sender_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Отправитель не найден');
  END IF;

  IF v_sender.is_blocked THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ваш аккаунт заблокирован');
  END IF;

  SELECT * INTO v_recipient FROM public.users WHERE LOWER(username) = LOWER(TRIM(p_recipient_username));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Игрок @' || p_recipient_username || ' не найден');
  END IF;

  IF v_recipient.id = p_sender_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Нельзя отправить подарок самому себе');
  END IF;

  -- Fixed table reference: public.rewards_catalog instead of rewards
  SELECT * INTO v_reward FROM public.rewards_catalog WHERE id = p_reward_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Предмет не найден в каталоге');
  END IF;

  -- Verify sender has item in inventory
  SELECT * INTO v_sender_inv 
  FROM public.user_inventory 
  WHERE user_id = p_sender_id AND reward_id = p_reward_id
  FOR UPDATE;

  IF NOT FOUND OR v_sender_inv.quantity < p_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Недостаточно предметов в вашем инвентаре');
  END IF;

  -- Deduct from sender inventory
  v_new_qty := v_sender_inv.quantity - p_quantity;
  IF v_new_qty = 0 THEN
    DELETE FROM public.user_inventory WHERE id = v_sender_inv.id;
  ELSE
    UPDATE public.user_inventory 
    SET quantity = v_new_qty, updated_at = NOW() 
    WHERE id = v_sender_inv.id;
  END IF;

  -- Determine item type: functional vs decorative
  v_is_spin := (v_reward.category = 'spins' OR COALESCE(v_reward.title_slug, '') LIKE '%spin%');
  v_is_uc := (v_reward.category = 'uc' OR COALESCE(v_reward.title_slug, '') LIKE '%uc%');
  v_is_coins := (v_reward.category = 'coins' OR COALESCE(v_reward.title_slug, '') LIKE '%coins%');

  IF v_is_spin THEN
    v_spins_to_add := COALESCE(NULLIF(v_reward.value, 0), 1) * p_quantity;
    UPDATE public.users 
    SET free_spins_balance = COALESCE(free_spins_balance, 0) + v_spins_to_add, updated_at = NOW()
    WHERE id = v_recipient.id;

    v_notif_title := 'Вы получили новые вращения! 🎰';
    v_notif_msg := 'Игрок @' || v_sender.username || ' подарил вам +' || v_spins_to_add || ' вращений на Колесе Фортуны! Они уже начислены на ваш баланс.' ||
      CASE WHEN p_message IS NOT NULL AND length(p_message) > 0 THEN E'\nСообщение: «' || p_message || '»' ELSE '' END;
  ELSIF v_is_uc THEN
    v_uc_to_add := COALESCE(v_reward.value, 0) * p_quantity;
    UPDATE public.users 
    SET total_uc = COALESCE(total_uc, 0) + v_uc_to_add, updated_at = NOW()
    WHERE id = v_recipient.id;

    v_notif_title := 'Вам начислено UC! 🪙';
    v_notif_msg := 'Игрок @' || v_sender.username || ' подарил вам +' || v_uc_to_add || ' UC! Они зачислены на ваш баланс.' ||
      CASE WHEN p_message IS NOT NULL AND length(p_message) > 0 THEN E'\nСообщение: «' || p_message || '»' ELSE '' END;
  ELSIF v_is_coins THEN
    v_coins_to_add := COALESCE(v_reward.value, 0) * p_quantity;
    UPDATE public.users 
    SET coins_balance = COALESCE(coins_balance, 0) + v_coins_to_add,
        points_balance = COALESCE(points_balance, coins_balance, 0) + v_coins_to_add,
        updated_at = NOW()
    WHERE id = v_recipient.id;

    v_notif_title := 'Вам подарили монеты! 💰';
    v_notif_msg := 'Игрок @' || v_sender.username || ' подарил вам +' || v_coins_to_add || ' монет! Они зачислены на ваш баланс.' ||
      CASE WHEN p_message IS NOT NULL AND length(p_message) > 0 THEN E'\nСообщение: «' || p_message || '»' ELSE '' END;
  ELSE
    -- Regular decorative gift / title / souvenir
    INSERT INTO public.user_inventory (user_id, reward_id, quantity, updated_at)
    VALUES (v_recipient.id, p_reward_id, p_quantity, NOW())
    ON CONFLICT (user_id, reward_id)
    DO UPDATE SET quantity = user_inventory.quantity + p_quantity, updated_at = NOW();

    v_notif_title := 'Вы получили новый подарок! 🎁';
    v_notif_msg := 'Игрок @' || v_sender.username || ' подарил вам «' || v_reward.name || '» (' || p_quantity || ' шт.)!' ||
      CASE WHEN p_message IS NOT NULL AND length(p_message) > 0 THEN E'\nСообщение: «' || p_message || '»' ELSE '' END;
  END IF;

  -- Record gift in history
  INSERT INTO gifts_history (sender_id, recipient_id, reward_id, quantity, status, message, source, cost_coins, created_at)
  VALUES (p_sender_id, v_recipient.id, p_reward_id, p_quantity, 'completed', p_message, 'inventory', 0, NOW());

  -- Create notification for recipient
  INSERT INTO notifications (user_id, type, title, message, data, created_at)
  VALUES (
    v_recipient.id,
    'gift_received',
    v_notif_title,
    v_notif_msg,
    jsonb_build_object(
      'senderUsername', v_sender.username,
      'rewardName', v_reward.name,
      'rewardRarity', v_reward.rarity,
      'quantity', p_quantity,
      'message', p_message,
      'isSpin', v_is_spin,
      'isUc', v_is_uc,
      'isCoins', v_is_coins
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'recipient', v_recipient.username,
    'item', v_reward.name,
    'remaining_quantity', v_new_qty,
    'source', 'inventory',
    'isSpin', v_is_spin,
    'message', p_message
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. FIX purchase_item_atomic (Robust slug, title_slug, UUID & name lookup)
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

    -- 4. Locate reward in rewards_catalog with complete fallback hierarchy
    SELECT * INTO v_reward 
    FROM public.rewards_catalog 
    WHERE LOWER(COALESCE(title_slug, '')) = LOWER(p_item_slug)
       OR LOWER(COALESCE(title_slug, '')) = LOWER(REPLACE(p_item_slug, 'title-', ''))
       OR LOWER(id::text) = LOWER(p_item_slug)
       OR LOWER(name) = LOWER(p_item_slug)
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
        CASE v_reward.rarity
            WHEN 'rare' THEN v_unit_cost := 300;
            WHEN 'epic' THEN v_unit_cost := 750;
            WHEN 'pro-epic' THEN v_unit_cost := GREATEST(1200, COALESCE(v_reward.value, 1200));
            WHEN 'mythic' THEN v_unit_cost := 1500;
            WHEN 'legendary' THEN v_unit_cost := 3000;
            ELSE v_unit_cost := 500;
        END CASE;
    ELSE
        CASE v_reward.rarity
            WHEN 'common' THEN 
                v_unit_cost := GREATEST(50, COALESCE(v_reward.value, 50));
            WHEN 'uncommon' THEN 
                v_unit_cost := GREATEST(100, COALESCE(v_reward.value, 100));
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
    IF v_is_admin THEN
        v_total_cost := 0;
        v_new_coins := COALESCE(v_user.coins_balance, 999999);
        v_new_points := COALESCE(v_user.points_balance, 999999);
    ELSE
        v_total_cost := v_unit_cost * p_quantity;
        v_new_coins := COALESCE(v_user.coins_balance, v_user.points_balance, 0);

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

        UPDATE public.users 
        SET coins_balance = coins_balance - v_total_cost,
            points_balance = points_balance - v_total_cost,
            updated_at = NOW()
        WHERE id = v_user.id
        RETURNING coins_balance, points_balance INTO v_new_coins, v_new_points;
    END IF;

    -- 6. Add purchased item to user_inventory
    INSERT INTO public.user_inventory (user_id, reward_id, quantity, acquired_at, updated_at)
    VALUES (v_user.id, v_reward.id, p_quantity, NOW(), NOW())
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

-- ------------------------------------------------------------------------------
-- 4. IMPLEMENT use_inventory_item_atomic (Atomic Item Consumption)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.use_inventory_item_atomic(
    p_user_id UUID,
    p_item_identifier TEXT,
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
    v_inv RECORD;
    v_new_qty INTEGER;
    v_spins_to_add INTEGER := 0;
    v_uc_to_add INTEGER := 0;
    v_coins_to_add INTEGER := 0;
    v_pop_to_add INTEGER := 0;
    v_granted_desc TEXT := '';
BEGIN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Количество должно быть не менее 1');
    END IF;

    SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Пользователь не найден');
    END IF;

    IF v_user.is_blocked THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ваш аккаунт заблокирован');
    END IF;

    -- Locate reward in catalog
    SELECT * INTO v_reward 
    FROM public.rewards_catalog 
    WHERE LOWER(COALESCE(title_slug, '')) = LOWER(p_item_identifier)
       OR LOWER(COALESCE(title_slug, '')) = LOWER(REPLACE(p_item_identifier, 'title-', ''))
       OR LOWER(id::text) = LOWER(p_item_identifier)
       OR LOWER(name) = LOWER(p_item_identifier)
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Предмет не найден в каталоге');
    END IF;

    IF v_reward.is_title OR v_reward.category = 'titles' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Титулы экипируются в профиле, а не расходуются');
    END IF;

    -- Lock and check user inventory
    SELECT * INTO v_inv 
    FROM public.user_inventory 
    WHERE user_id = p_user_id AND reward_id = v_reward.id 
    FOR UPDATE;

    IF NOT FOUND OR v_inv.quantity < p_quantity THEN
        RETURN jsonb_build_object('success', false, 'error', 'Недостаточно предметов в инвентаре для использования');
    END IF;

    -- Deduct from inventory
    v_new_qty := v_inv.quantity - p_quantity;
    IF v_new_qty = 0 THEN
        DELETE FROM public.user_inventory WHERE id = v_inv.id;
    ELSE
        UPDATE public.user_inventory 
        SET quantity = v_new_qty, updated_at = NOW() 
        WHERE id = v_inv.id;
    END IF;

    -- Apply item effect based on category / title_slug
    IF v_reward.category = 'spins' OR COALESCE(v_reward.title_slug, '') LIKE '%spin%' THEN
        v_spins_to_add := COALESCE(NULLIF(v_reward.value, 0), 1) * p_quantity;
        UPDATE public.users 
        SET free_spins_balance = COALESCE(free_spins_balance, 0) + v_spins_to_add,
            updated_at = NOW()
        WHERE id = p_user_id;
        v_granted_desc := '+' || v_spins_to_add || ' вращений на Колесе';

    ELSIF v_reward.category = 'uc' OR COALESCE(v_reward.title_slug, '') LIKE '%uc%' THEN
        v_uc_to_add := COALESCE(v_reward.value, 0) * p_quantity;
        UPDATE public.users 
        SET total_uc = COALESCE(total_uc, 0) + v_uc_to_add,
            updated_at = NOW()
        WHERE id = p_user_id;
        v_granted_desc := '+' || v_uc_to_add || ' UC';

    ELSIF v_reward.category = 'coins' OR COALESCE(v_reward.title_slug, '') LIKE '%coins%' THEN
        v_coins_to_add := COALESCE(v_reward.value, 0) * p_quantity;
        UPDATE public.users 
        SET coins_balance = COALESCE(coins_balance, 0) + v_coins_to_add,
            points_balance = COALESCE(points_balance, 0) + v_coins_to_add,
            updated_at = NOW()
        WHERE id = p_user_id;
        v_granted_desc := '+' || v_coins_to_add || ' Монет';

    ELSIF v_reward.category = 'popularity' OR COALESCE(v_reward.title_slug, '') LIKE '%pop%' THEN
        v_pop_to_add := COALESCE(v_reward.value, 0) * p_quantity;
        UPDATE public.users 
        SET total_popularity = COALESCE(total_popularity, 0) + v_pop_to_add,
            popularity_updated_at = NOW(),
            updated_at = NOW()
        WHERE id = p_user_id;
        v_granted_desc := '+' || v_pop_to_add || ' очков популярности';

        INSERT INTO public.popularity_transactions (user_id, amount, source, description, reference_id, created_at)
        VALUES (p_user_id, v_pop_to_add, 'inventory_use', 'Использован предмет: ' || v_reward.name, 'use-' || gen_random_uuid()::text, NOW());

    ELSE
        -- Mystery gift box / miracle box / souvenir activation (converts to value in coins or starter coin bonus)
        v_coins_to_add := GREATEST(50, COALESCE(v_reward.value, 50)) * p_quantity;
        UPDATE public.users 
        SET coins_balance = COALESCE(coins_balance, 0) + v_coins_to_add,
            points_balance = COALESCE(points_balance, 0) + v_coins_to_add,
            updated_at = NOW()
        WHERE id = p_user_id;
        v_granted_desc := '+' || v_coins_to_add || ' Монет из подарка';
    END IF;

    -- Record in notifications
    INSERT INTO public.notifications (user_id, type, title, message, data, created_at)
    VALUES (
        p_user_id,
        'system',
        'Предмет использован! ✨',
        'Вы успешно активировали «' || v_reward.name || '» (' || p_quantity || ' шт.). Получено: ' || v_granted_desc || '.',
        jsonb_build_object(
            'rewardName', v_reward.name,
            'quantity', p_quantity,
            'rewardCategory', v_reward.category,
            'spinsAdded', v_spins_to_add,
            'ucAdded', v_uc_to_add,
            'coinsAdded', v_coins_to_add,
            'popAdded', v_pop_to_add
        ),
        NOW()
    );

    -- Fetch refreshed user state
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'item', v_reward.name,
        'quantity_used', p_quantity,
        'remaining_quantity', v_new_qty,
        'granted', v_granted_desc,
        'user', jsonb_build_object(
            'free_spins_balance', v_user.free_spins_balance,
            'total_uc', v_user.total_uc,
            'coins_balance', v_user.coins_balance,
            'points_balance', v_user.points_balance,
            'total_popularity', v_user.total_popularity
        ),
        'message', 'Вы успешно использовали «' || v_reward.name || '»! Получено: ' || v_granted_desc
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. UPGRADE play_spin_atomic (Atomic Roulette Spin & Coin/Item Handling)
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

    -- 3. Resolve reward: either passed as parameter or selected via weighted RNG
    IF p_reward_id IS NOT NULL THEN
        SELECT * INTO v_reward FROM public.rewards_catalog WHERE id = p_reward_id;
    END IF;

    IF v_reward.id IS NULL THEN
        v_rand := random() * 100.0;
        IF v_rand < 55.0 THEN
            -- 55% Coins drop (25, 50, 75, 125 coins)
            IF v_rand < 28.0 THEN
                SELECT * INTO v_reward FROM public.rewards_catalog WHERE id = '10000000-0000-0000-0000-000000000051';
            ELSIF v_rand < 44.0 THEN
                SELECT * INTO v_reward FROM public.rewards_catalog WHERE id = '10000000-0000-0000-0000-000000000052';
            ELSIF v_rand < 52.0 THEN
                SELECT * INTO v_reward FROM public.rewards_catalog WHERE id = '10000000-0000-0000-0000-000000000053';
            ELSE
                SELECT * INTO v_reward FROM public.rewards_catalog WHERE id = '10000000-0000-0000-0000-000000000054';
            END IF;
        ELSE
            -- 45% Other catalog rewards
            IF v_rand < 75.0 THEN
                SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity = 'common' AND category <> 'coins' AND is_title = FALSE ORDER BY random() LIMIT 1;
            ELSIF v_rand < 87.0 THEN
                SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity = 'uncommon' AND category <> 'coins' AND is_title = FALSE ORDER BY random() LIMIT 1;
            ELSIF v_rand < 95.0 THEN
                SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity = 'rare' AND category <> 'coins' AND is_title = FALSE ORDER BY random() LIMIT 1;
            ELSIF v_rand < 99.0 THEN
                SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity = 'epic' AND category <> 'coins' AND is_title = FALSE ORDER BY random() LIMIT 1;
            ELSE
                SELECT * INTO v_reward FROM public.rewards_catalog WHERE rarity IN ('legendary', 'mythic') AND is_title = FALSE ORDER BY random() LIMIT 1;
            END IF;
        END IF;
    END IF;

    -- Ultimate fallback
    IF v_reward.id IS NULL THEN
        SELECT * INTO v_reward FROM public.rewards_catalog WHERE is_active = TRUE ORDER BY random() LIMIT 1;
    END IF;

    -- 4. Calculate new balances
    v_new_uc := COALESCE(v_user.total_uc, 0);
    v_new_pop := COALESCE(v_user.total_popularity, 0);
    v_new_coins := COALESCE(v_user.coins_balance, 0);
    v_new_points := COALESCE(v_user.points_balance, v_new_coins);

    IF v_is_vip_admin THEN
        v_new_spins := COALESCE(v_user.free_spins_balance, 999999);
    ELSE
        v_new_spins := v_user.free_spins_balance - 1;
    END IF;

    -- Apply winnings
    IF v_reward.category = 'spins' OR COALESCE(v_reward.title_slug, '') LIKE '%spin%' THEN
        IF NOT v_is_vip_admin THEN
            v_new_spins := v_new_spins + COALESCE(v_reward.value, 1);
        END IF;
    ELSIF v_reward.category = 'coins' OR COALESCE(v_reward.title_slug, '') LIKE '%coins%' THEN
        v_new_coins := v_new_coins + COALESCE(v_reward.value, 0);
        v_new_points := v_new_points + COALESCE(v_reward.value, 0);
    ELSIF v_reward.category = 'uc' OR COALESCE(v_reward.title_slug, '') LIKE '%uc%' THEN
        v_new_uc := v_new_uc + COALESCE(v_reward.value, 0);
    ELSIF v_reward.category = 'popularity' OR COALESCE(v_reward.title_slug, '') LIKE '%pop%' THEN
        v_new_pop := v_new_pop + COALESCE(v_reward.value, 0);
        INSERT INTO public.popularity_transactions (user_id, amount, source, description, reference_id, created_at)
        VALUES (p_user_id, COALESCE(v_reward.value, 0), 'spin', 'Выигрыш на Колесе: ' || v_reward.name, 'spin-' || gen_random_uuid()::text, v_now);
    ELSE
        -- Collectible / decorative item: insert into inventory
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

    -- Public event & notification for rare items, coins or popularity
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

-- ------------------------------------------------------------------------------
-- 6. PERMISSIONS & GRANTS
-- ------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.send_player_gift_with_message_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purchase_item_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.use_inventory_item_atomic TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.play_spin_atomic(uuid) TO authenticated, service_role;
