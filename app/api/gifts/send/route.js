import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';
import { REWARDS_CATALOG, toDbUuid, isItemAvailableInShop, resolveReward } from '@/lib/catalog-data';

export async function POST(request) {
  try {
    const session = await getSessionUser(request);
    
    // Strict authentication enforcement
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
    }

    const senderId = session.userId;

    const body = await request.json();
    const { recipientUsername, rewardId, quantity = 1, message = '', source = 'inventory' } = body;

    if (message && typeof message === 'string' && message.length > 500) {
      return NextResponse.json({ success: false, error: 'Длина сообщения к подарку не может превышать 500 символов' }, { status: 400 });
    }

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

    const rewardMeta = resolveReward(rewardId) || REWARDS_CATALOG.find((r) => r.id === rewardId || r.uuid === rewardId);
    if (!rewardMeta) {
      return NextResponse.json({ success: false, error: 'Предмет не найден в каталоге' }, { status: 400 });
    }

    if (source === 'shop' && !isItemAvailableInShop(rewardMeta)) {
      return NextResponse.json({ success: false, error: 'Этот предмет недоступен для покупки в магазине' }, { status: 400 });
    }

    const dbRewardId = toDbUuid(rewardMeta.id) || rewardId;
    const cleanUsername = recipientUsername.replace('@', '').trim().toLowerCase();

    if (isServerSupabaseConfigured && supabaseServer && senderId) {
      // 1. Try atomic RPC if inventory transfer
      if (source !== 'shop') {
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
      }

      // If RPC not configured or shop gifting, execute logic directly
      const { data: recipient, error: recipErr } = await supabaseServer
        .from('users')
        .select('id, username, is_blocked, free_spins_balance, total_uc, coins_balance, points_balance')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (recipErr || !recipient) {
        return NextResponse.json({ success: false, error: `Игрок @${cleanUsername} не найден` }, { status: 404 });
      }

      if (recipient.id === senderId) {
        return NextResponse.json({ success: false, error: 'Нельзя отправить подарок самому себе' }, { status: 400 });
      }

      if (recipient.is_blocked) {
        return NextResponse.json({ success: false, error: 'Получатель заблокирован и не может принимать подарки' }, { status: 400 });
      }

      const { data: sender } = await supabaseServer
        .from('users')
        .select('id, username, active_title_id, is_blocked, is_admin, coins_balance, points_balance')
        .eq('id', senderId)
        .single();

      if (sender?.is_blocked) {
        return NextResponse.json({ success: false, error: 'Ваш аккаунт заблокирован' }, { status: 403 });
      }

      let totalCost = 0;
      let newSenderQty = undefined;

      if (source === 'shop') {
        if (!isItemAvailableInShop(rewardMeta) || rewardMeta.category === 'spins' || String(rewardId).startsWith('reward-spin-')) {
          return NextResponse.json({ success: false, error: 'Этот предмет недоступен для покупки в магазине' }, { status: 400 });
        }
        const unitCost = Number(rewardMeta.priceCoins || 0);
        if (unitCost <= 0) {
          return NextResponse.json({ success: false, error: 'Этот предмет недоступен для покупки в магазине (цена не установлена)' }, { status: 400 });
        }
        const isAdmin = Boolean(sender.is_admin);
        totalCost = isAdmin ? 0 : unitCost * qty;

        const senderCoins = typeof sender.coins_balance === 'number' ? sender.coins_balance : 0;
        if (!isAdmin && senderCoins < totalCost) {
          return NextResponse.json({
            success: false,
            error: `Недостаточно монет для покупки подарка (требуется ${totalCost}, у вас ${senderCoins})`,
          }, { status: 400 });
        }

        if (!isAdmin && totalCost > 0) {
          const newBalance = senderCoins - totalCost;
          await supabaseServer
            .from('users')
            .update({
              coins_balance: newBalance,
              points_balance: newBalance,
              updated_at: new Date().toISOString(),
            })
            .eq('id', senderId);
        }
      } else {
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

        newSenderQty = senderItem.quantity - qty;
        if (newSenderQty === 0) {
          await supabaseServer.from('user_inventory').delete().eq('id', senderItem.id);
        } else {
          await supabaseServer
            .from('user_inventory')
            .update({ quantity: newSenderQty, updated_at: new Date().toISOString() })
            .eq('id', senderItem.id);
        }
      }

      // Determine functional item category vs decorative gifts
      const isSpin = rewardMeta.category === 'spins' || String(rewardId).startsWith('reward-spin-');
      const isUc = rewardMeta.category === 'uc' || String(rewardId).startsWith('reward-uc-');
      const isCoins = rewardMeta.category === 'coins' || String(rewardId).startsWith('reward-coins-');

      if (isSpin) {
        // Credit real functional spins to free_spins_balance
        const perUnitSpins = rewardMeta.value && rewardMeta.value > 0 ? rewardMeta.value : 1;
        const spinsToAdd = perUnitSpins * qty;
        await supabaseServer
          .from('users')
          .update({
            free_spins_balance: (recipient.free_spins_balance || 0) + spinsToAdd,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipient.id);
      } else if (isUc) {
        // Credit real UC to total_uc balance
        const perUnitUc = rewardMeta.value && rewardMeta.value > 0 ? rewardMeta.value : 0;
        const ucToAdd = perUnitUc * qty;
        await supabaseServer
          .from('users')
          .update({
            total_uc: (recipient.total_uc || 0) + ucToAdd,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipient.id);
      } else if (isCoins) {
        // Credit real coins to coins_balance and points_balance
        const perUnitCoins = rewardMeta.value && rewardMeta.value > 0 ? rewardMeta.value : 0;
        const coinsToAdd = perUnitCoins * qty;
        await supabaseServer
          .from('users')
          .update({
            coins_balance: (recipient.coins_balance || 0) + coinsToAdd,
            points_balance: (recipient.points_balance || recipient.coins_balance || 0) + coinsToAdd,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipient.id);
      } else {
        // Add to recipient inventory
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
      }

      // Record gift in history with message and source
      await supabaseServer.from('gifts_history').insert({
        sender_id: senderId,
        recipient_id: recipient.id,
        reward_id: dbRewardId,
        quantity: qty,
        status: 'completed',
        message: message || null,
        source: source || 'inventory',
        cost_coins: totalCost,
      });

      // Create notification for recipient
      let notifTitle = 'Вы получили новый подарок! 🎁';
      let notifMsg = `Игрок @${sender?.username || 'Игрок'} подарил вам «${rewardMeta.name}» (${qty} шт.)!${message ? `\nСообщение: «${message}»` : ''}`;

      if (isSpin) {
        const spinsCount = (rewardMeta.value && rewardMeta.value > 0 ? rewardMeta.value : 1) * qty;
        notifTitle = 'Вы получили новые вращения! 🎰';
        notifMsg = `Игрок @${sender?.username || 'Игрок'} подарил вам +${spinsCount} вращений на Колесе Фортуны! Они уже начислены на ваш баланс.${message ? `\nСообщение: «${message}»` : ''}`;
      } else if (isUc) {
        const ucCount = (rewardMeta.value && rewardMeta.value > 0 ? rewardMeta.value : 0) * qty;
        notifTitle = 'Вам начислено UC! 🪙';
        notifMsg = `Игрок @${sender?.username || 'Игрок'} подарил вам +${ucCount} UC! Они зачислены на ваш баланс.${message ? `\nСообщение: «${message}»` : ''}`;
      } else if (isCoins) {
        const coinsCount = (rewardMeta.value && rewardMeta.value > 0 ? rewardMeta.value : 0) * qty;
        notifTitle = 'Вам подарили монеты! 💰';
        notifMsg = `Игрок @${sender?.username || 'Игрок'} подарил вам +${coinsCount} монет! Они зачислены на ваш баланс.${message ? `\nСообщение: «${message}»` : ''}`;
      }

      try {
        await supabaseServer.from('notifications').insert({
          user_id: recipient.id,
          type: 'gift_received',
          title: notifTitle,
          message: notifMsg,
          data: {
            senderUsername: sender?.username,
            rewardName: rewardMeta.name,
            rewardRarity: rewardMeta.rarity,
            quantity: qty,
            message,
            source: source || 'inventory',
            costCoins: totalCost,
            isSpin,
            isUc,
            isCoins,
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
        source,
        cost: totalCost,
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
        source: source || 'inventory',
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
