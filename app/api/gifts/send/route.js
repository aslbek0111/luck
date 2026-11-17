import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';
import { REWARDS_CATALOG, toDbUuid } from '@/lib/catalog-data';

export async function POST(request) {
  try {
    const session = await getSessionUser(request);
    
    // Strict authentication enforcement
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
    }

    const senderId = session.userId;

    const body = await request.json();
    const { recipientUsername, rewardId, quantity = 1, message = '' } = body;

    if (!recipientUsername || !recipientUsername.trim()) {
      return NextResponse.json({ success: false, error: 'Укажите никнейм получателя' }, { status: 400 });
    }
    if (!rewardId) {
      return NextResponse.json({ success: false, error: 'Выберите предмет для подарка' }, { status: 400 });
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1 || qty > 1000) {
      return NextResponse.json({ success: false, error: 'Количество должно быть от 1 до 1000' }, { status: 400 });
    }

    const rewardMeta = REWARDS_CATALOG.find((r) => r.id === rewardId || r.uuid === rewardId);
    if (!rewardMeta) {
      return NextResponse.json({ success: false, error: 'Предмет не найден в каталоге' }, { status: 400 });
    }

    const dbRewardId = toDbUuid(rewardMeta.id) || rewardId;
    const cleanUsername = recipientUsername.replace('@', '').trim().toLowerCase();

    if (isServerSupabaseConfigured && supabaseServer && senderId) {
      // 1. Try atomic RPC first
      const { data: rpcData, error: rpcErr } = await supabaseServer.rpc('send_player_gift_with_message_atomic', {
        p_sender_id: senderId,
        p_recipient_username: cleanUsername,
        p_reward_id: dbRewardId,
        p_quantity: qty,
        p_message: message || null,
      });

      if (!rpcErr && rpcData) {
        if (!rpcData.success) {
          return NextResponse.json({ success: false, error: rpcData.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, ...rpcData });
      }

      // If RPC not configured, execute transaction logic directly
      const { data: recipient, error: recipErr } = await supabaseServer
        .from('users')
        .select('id, username')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (recipErr || !recipient) {
        return NextResponse.json({ success: false, error: `Игрок @${cleanUsername} не найден` }, { status: 404 });
      }

      if (recipient.id === senderId) {
        return NextResponse.json({ success: false, error: 'Нельзя отправить подарок самому себе' }, { status: 400 });
      }

      const { data: sender } = await supabaseServer
        .from('users')
        .select('id, username, active_title_id, is_blocked')
        .eq('id', senderId)
        .single();

      if (sender?.is_blocked) {
        return NextResponse.json({ success: false, error: 'Ваш аккаунт заблокирован' }, { status: 403 });
      }

      // Check sender inventory (Quantity > 0 rule)
      const { data: senderItem, error: itemErr } = await supabaseServer
        .from('user_inventory')
        .select('*')
        .eq('user_id', senderId)
        .eq('reward_id', dbRewardId)
        .maybeSingle();

      if (itemErr || !senderItem || senderItem.quantity < qty) {
        return NextResponse.json({
          success: false,
          error: `Недостаточно предметов в вашем инвентаре (в наличии: ${senderItem?.quantity || 0})`,
        }, { status: 400 });
      }

      const newSenderQty = senderItem.quantity - qty;
      if (newSenderQty === 0) {
        await supabaseServer.from('user_inventory').delete().eq('id', senderItem.id);
      } else {
        await supabaseServer
          .from('user_inventory')
          .update({ quantity: newSenderQty, updated_at: new Date().toISOString() })
          .eq('id', senderItem.id);
      }

      // Add to recipient
      const { data: recipItem } = await supabaseServer
        .from('user_inventory')
        .select('*')
        .eq('user_id', recipient.id)
        .eq('reward_id', dbRewardId)
        .maybeSingle();

      if (recipItem) {
        await supabaseServer
          .from('user_inventory')
          .update({ quantity: recipItem.quantity + qty, updated_at: new Date().toISOString() })
          .eq('id', recipItem.id);
      } else {
        await supabaseServer.from('user_inventory').insert({
          user_id: recipient.id,
          reward_id: dbRewardId,
          quantity: qty,
        });
      }

      // Record gift in history with message
      await supabaseServer.from('gifts_history').insert({
        sender_id: senderId,
        recipient_id: recipient.id,
        reward_id: dbRewardId,
        quantity: qty,
        status: 'completed',
        message: message || null,
      });

      // Create notification for recipient
      try {
        await supabaseServer.from('notifications').insert({
          user_id: recipient.id,
          type: 'gift_received',
          title: 'Вам пришел подарок! 🎁',
          message: `Игрок @${sender?.username || 'Игрок'} подарил вам «${rewardMeta.name}» (${qty} шт.)!${message ? `\nСообщение: «${message}»` : ''}`,
          data: {
            senderUsername: sender?.username,
            rewardName: rewardMeta.name,
            rewardRarity: rewardMeta.rarity,
            quantity: qty,
            message,
          },
        });
      } catch {
        // Non-critical
      }

      return NextResponse.json({
        success: true,
        recipient: recipient.username,
        item: rewardMeta.name,
        remaining_quantity: newSenderQty,
        message,
      });
    } else {
      if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_STORE) {
        return NextResponse.json({ success: false, error: 'База данных Supabase не настроена на сервере' }, { status: 503 });
      }

      // Fallback local store
      const result = mockStore.sendGift({
        senderId,
        recipientUsername: cleanUsername,
        rewardId,
        quantity: qty,
        message,
      });

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      return NextResponse.json(result);
    }
  } catch (err) {
    console.error('API /gifts/send error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
