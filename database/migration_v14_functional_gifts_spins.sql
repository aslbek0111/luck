-- Migration v14: Functional Player-to-Player Gifts (Spins, UC, Coins & Items)
-- Separates functional rewards from decorative inventory items:
-- 1. 'spins' (reward-spin-1, reward-spin-2) -> directly credited to recipient's free_spins_balance
-- 2. 'uc' (reward-uc-30, reward-uc-60) -> directly credited to recipient's total_uc
-- 3. 'coins' (reward-coins-*) -> directly credited to recipient's coins_balance & points_balance
-- 4. Regular items/souvenirs/titles -> credited to recipient's user_inventory

CREATE OR REPLACE FUNCTION send_player_gift_with_message_atomic(
  p_sender_id UUID,
  p_recipient_username TEXT,
  p_reward_id UUID,
  p_quantity INTEGER DEFAULT 1,
  p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

  SELECT * INTO v_sender FROM users WHERE id = p_sender_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Отправитель не найден');
  END IF;

  IF v_sender.is_blocked THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ваш аккаунт заблокирован');
  END IF;

  SELECT * INTO v_recipient FROM users WHERE LOWER(username) = LOWER(TRIM(p_recipient_username));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Игрок @' || p_recipient_username || ' не найден');
  END IF;

  IF v_recipient.id = p_sender_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Нельзя отправить подарок самому себе');
  END IF;

  SELECT * INTO v_reward FROM rewards WHERE id = p_reward_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Предмет не найден в каталоге');
  END IF;

  -- Verify sender has item in inventory
  SELECT * INTO v_sender_inv 
  FROM user_inventory 
  WHERE user_id = p_sender_id AND reward_id = p_reward_id
  FOR UPDATE;

  IF NOT FOUND OR v_sender_inv.quantity < p_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Недостаточно предметов в вашем инвентаре');
  END IF;

  -- Deduct from sender inventory
  v_new_qty := v_sender_inv.quantity - p_quantity;
  IF v_new_qty = 0 THEN
    DELETE FROM user_inventory WHERE id = v_sender_inv.id;
  ELSE
    UPDATE user_inventory 
    SET quantity = v_new_qty, updated_at = NOW() 
    WHERE id = v_sender_inv.id;
  END IF;

  -- Determine item type: functional vs decorative
  v_is_spin := (v_reward.category = 'spins' OR v_reward.slug LIKE '%spin%');
  v_is_uc := (v_reward.category = 'uc' OR v_reward.slug LIKE '%uc%');
  v_is_coins := (v_reward.category = 'coins' OR v_reward.slug LIKE '%coins%');

  IF v_is_spin THEN
    v_spins_to_add := COALESCE(NULLIF(v_reward.value, 0), 1) * p_quantity;
    UPDATE users 
    SET free_spins_balance = COALESCE(free_spins_balance, 0) + v_spins_to_add, updated_at = NOW()
    WHERE id = v_recipient.id;

    v_notif_title := 'Вы получили новые вращения! 🎰';
    v_notif_msg := 'Игрок @' || v_sender.username || ' подарил вам +' || v_spins_to_add || ' вращений на Колесе Фортуны! Они уже начислены на ваш баланс.' ||
      CASE WHEN p_message IS NOT NULL AND length(p_message) > 0 THEN E'\nСообщение: «' || p_message || '»' ELSE '' END;
  ELSIF v_is_uc THEN
    v_uc_to_add := COALESCE(v_reward.value, 0) * p_quantity;
    UPDATE users 
    SET total_uc = COALESCE(total_uc, 0) + v_uc_to_add, updated_at = NOW()
    WHERE id = v_recipient.id;

    v_notif_title := 'Вам начислено UC! 🪙';
    v_notif_msg := 'Игрок @' || v_sender.username || ' подарил вам +' || v_uc_to_add || ' UC! Они зачислены на ваш баланс.' ||
      CASE WHEN p_message IS NOT NULL AND length(p_message) > 0 THEN E'\nСообщение: «' || p_message || '»' ELSE '' END;
  ELSIF v_is_coins THEN
    v_coins_to_add := COALESCE(v_reward.value, 0) * p_quantity;
    UPDATE users 
    SET coins_balance = COALESCE(coins_balance, 0) + v_coins_to_add,
        points_balance = COALESCE(points_balance, coins_balance, 0) + v_coins_to_add,
        updated_at = NOW()
    WHERE id = v_recipient.id;

    v_notif_title := 'Вам подарили монеты! 💰';
    v_notif_msg := 'Игрок @' || v_sender.username || ' подарил вам +' || v_coins_to_add || ' монет! Они зачислены на ваш баланс.' ||
      CASE WHEN p_message IS NOT NULL AND length(p_message) > 0 THEN E'\nСообщение: «' || p_message || '»' ELSE '' END;
  ELSE
    -- Regular decorative gift / title / souvenir
    INSERT INTO user_inventory (user_id, reward_id, quantity, updated_at)
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
