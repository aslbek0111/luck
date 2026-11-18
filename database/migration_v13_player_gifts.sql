-- Migration v13: Player-to-Player Gifting System (Inventory & Shop gifting)
-- Support for source ('inventory' | 'shop'), coin deductions, atomic transfers and notifications

ALTER TABLE IF EXISTS gifts_history 
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'inventory',
  ADD COLUMN IF NOT EXISTS cost_coins INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_gifts_history_recipient ON gifts_history(recipient_id);
CREATE INDEX IF NOT EXISTS idx_gifts_history_sender ON gifts_history(sender_id);
CREATE INDEX IF NOT EXISTS idx_gifts_history_created_at ON gifts_history(created_at DESC);

-- Atomic RPC function for sending inventory gifts safely
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

  SELECT * INTO v_sender_inv 
  FROM user_inventory 
  WHERE user_id = p_sender_id AND reward_id = p_reward_id
  FOR UPDATE;

  IF NOT FOUND OR v_sender_inv.quantity < p_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Недостаточно предметов в вашем инвентаре');
  END IF;

  v_new_qty := v_sender_inv.quantity - p_quantity;
  IF v_new_qty = 0 THEN
    DELETE FROM user_inventory WHERE id = v_sender_inv.id;
  ELSE
    UPDATE user_inventory 
    SET quantity = v_new_qty, updated_at = NOW() 
    WHERE id = v_sender_inv.id;
  END IF;

  INSERT INTO user_inventory (user_id, reward_id, quantity, updated_at)
  VALUES (v_recipient.id, p_reward_id, p_quantity, NOW())
  ON CONFLICT (user_id, reward_id)
  DO UPDATE SET quantity = user_inventory.quantity + p_quantity, updated_at = NOW();

  INSERT INTO gifts_history (sender_id, recipient_id, reward_id, quantity, status, message, source, cost_coins, created_at)
  VALUES (p_sender_id, v_recipient.id, p_reward_id, p_quantity, 'completed', p_message, 'inventory', 0, NOW());

  INSERT INTO notifications (user_id, type, title, message, data, created_at)
  VALUES (
    v_recipient.id,
    'gift_received',
    'Вы получили новый подарок! 🎁',
    'Игрок @' || v_sender.username || ' подарил вам «' || v_reward.name || '» (' || p_quantity || ' шт.)!' ||
      CASE WHEN p_message IS NOT NULL AND length(p_message) > 0 THEN E'\nСообщение: «' || p_message || '»' ELSE '' END,
    jsonb_build_object(
      'senderUsername', v_sender.username,
      'rewardName', v_reward.name,
      'rewardRarity', v_reward.rarity,
      'quantity', p_quantity,
      'message', p_message,
      'source', 'inventory'
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'recipient', v_recipient.username,
    'item', v_reward.name,
    'remaining_quantity', v_new_qty,
    'source', 'inventory',
    'message', p_message
  );
END;
$$;
