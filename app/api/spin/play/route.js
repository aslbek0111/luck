import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';
import { REWARDS_CATALOG, toDbUuid } from '@/lib/catalog-data';

export async function POST(request) {
  try {
    const session = await getSessionUser(request);

    // Strict authentication enforcement - spins must only belong to authenticated users
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: 'Требуется авторизация для вращения' }, { status: 401 });
    }

    const userId = session.userId;

    // Check if spin wheel is enabled globally
    let isSpinEnabled = true;
    if (isServerSupabaseConfigured && supabaseServer) {
      const { data: configData } = await supabaseServer
        .from('system_config')
        .select('value')
        .eq('key', 'spin_wheel_enabled')
        .maybeSingle();
      if (configData?.value?.enabled !== undefined) {
        isSpinEnabled = Boolean(configData.value.enabled);
      }
    } else {
      const cfg = mockStore.getSystemConfig('spin_wheel_enabled');
      if (cfg !== undefined) isSpinEnabled = Boolean(cfg);
    }

    if (!isSpinEnabled) {
      return NextResponse.json(
        { success: false, error: 'Колесо Фортуны временно отключено администратором на техническое обслуживание' },
        { status: 403 }
      );
    }

    if (isServerSupabaseConfigured && supabaseServer) {
      // 1. Try atomic RPC first
      const { data: rpcData, error: rpcErr } = await supabaseServer.rpc('play_spin_atomic', {
        p_user_id: userId,
      });

      if (!rpcErr && rpcData) {
        if (!rpcData.success) {
          return NextResponse.json({ success: false, error: rpcData.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, ...rpcData });
      }

      // Fallback direct server transaction
      const { data: user, error: userErr } = await supabaseServer
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userErr || !user) {
        return NextResponse.json({ success: false, error: 'Пользователь не найден' }, { status: 404 });
      }

      if (user.is_blocked) {
        return NextResponse.json({ success: false, error: 'Ваш аккаунт заблокирован' }, { status: 403 });
      }

      if ((user.free_spins_balance || 0) <= 0) {
        return NextResponse.json({ success: false, error: 'У вас закончились бесплатные вращения!' }, { status: 400 });
      }

      // Atomic decrement
      const { data: deductedUsers, error: deductErr } = await supabaseServer
        .from('users')
        .update({
          free_spins_balance: user.free_spins_balance - 1,
          spins_count: (user.spins_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .gt('free_spins_balance', 0)
        .select();

      if (deductErr || !deductedUsers || deductedUsers.length === 0) {
        return NextResponse.json({ success: false, error: 'У вас закончились бесплатные вращения!' }, { status: 400 });
      }

      const updatedUser = deductedUsers[0];
      const newSpinsLeft = updatedUser.free_spins_balance;
      const newTotalSpins = updatedUser.spins_count;

      // Weighted random drop (prioritizing Christmas items)
      const rand = Math.random() * 100;
      let pool = [];
      if (rand < 40) {
        pool = REWARDS_CATALOG.filter((r) => r.rarity === 'common');
      } else if (rand < 70) {
        pool = REWARDS_CATALOG.filter((r) => r.rarity === 'rare');
      } else if (rand < 90) {
        pool = REWARDS_CATALOG.filter((r) => r.rarity === 'epic');
      } else if (rand < 98) {
        pool = REWARDS_CATALOG.filter((r) => r.rarity === 'legendary');
      } else {
        pool = REWARDS_CATALOG.filter((r) => r.rarity === 'mythic');
      }

      if (pool.length === 0) pool = REWARDS_CATALOG;
      const wonReward = pool[Math.floor(Math.random() * pool.length)];
      const dbRewardId = toDbUuid(wonReward.id) || wonReward.id;

      let newUc = user.total_uc || 0;
      let newPop = user.total_popularity || 0;
      let finalSpinsLeft = newSpinsLeft;

      if (wonReward.category === 'spins') {
        finalSpinsLeft += wonReward.value;
      } else if (wonReward.category === 'popularity') {
        newPop += wonReward.value;
      } else if (wonReward.category === 'uc') {
        newUc += wonReward.value;
      }

      if (wonReward.category === 'spins' || wonReward.category === 'popularity' || wonReward.category === 'uc') {
        await supabaseServer
          .from('users')
          .update({
            free_spins_balance: finalSpinsLeft,
            total_uc: newUc,
            total_popularity: newPop,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
      }

      // Add to inventory
      const { data: existingInv } = await supabaseServer
        .from('user_inventory')
        .select('*')
        .eq('user_id', user.id)
        .eq('reward_id', dbRewardId)
        .maybeSingle();

      if (existingInv) {
        await supabaseServer
          .from('user_inventory')
          .update({ quantity: existingInv.quantity + 1, updated_at: new Date().toISOString() })
          .eq('id', existingInv.id);
      } else {
        await supabaseServer.from('user_inventory').insert({
          user_id: user.id,
          reward_id: dbRewardId,
          quantity: 1,
        });
      }

      // Log spin
      await supabaseServer.from('spins_history').insert({
        user_id: user.id,
        reward_id: dbRewardId,
        reward_name: wonReward.name,
        reward_rarity: wonReward.rarity,
        reward_value: wonReward.value || 0,
      });

      // Public event
      if (['rare', 'epic', 'mythic', 'legendary'].includes(wonReward.rarity)) {
        await supabaseServer.from('public_events').insert({
          user_id: user.id,
          username: '@' + (user.username || 'Игрок'),
          reward_id: dbRewardId,
          reward_name: wonReward.name,
          reward_rarity: wonReward.rarity,
          reward_category: wonReward.category,
          event_type: 'reward_received',
        });

        await supabaseServer.from('notifications').insert({
          user_id: user.id,
          type: 'spin_win',
          title: 'Новогодний выигрыш! 🎄',
          message: `Поздравляем! Вы выиграли «${wonReward.name}» на Рождественском Колесе!`,
        });
      }

      return NextResponse.json({
        success: true,
        reward: wonReward,
        spins_left: finalSpinsLeft,
        total_spins: newTotalSpins,
        total_uc: newUc,
        total_popularity: newPop,
      });
    } else {
      if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_STORE) {
        return NextResponse.json({ success: false, error: 'База данных Supabase не настроена на сервере' }, { status: 503 });
      }

      const user = mockStore.getUserById(userId);
      if (!user) {
        return NextResponse.json({ success: false, error: 'Пользователь не найден' }, { status: 404 });
      }

      if (user.is_blocked) {
        return NextResponse.json({ success: false, error: 'Ваш аккаунт заблокирован' }, { status: 403 });
      }

      if ((user.free_spins_balance || 0) <= 0) {
        return NextResponse.json({ success: false, error: 'У вас закончились бесплатные вращения!' }, { status: 400 });
      }

      const rand = Math.random() * 100;
      let pool = [];
      if (rand < 40) {
        pool = REWARDS_CATALOG.filter((r) => r.rarity === 'common');
      } else if (rand < 70) {
        pool = REWARDS_CATALOG.filter((r) => r.rarity === 'rare');
      } else if (rand < 90) {
        pool = REWARDS_CATALOG.filter((r) => r.rarity === 'epic');
      } else if (rand < 98) {
        pool = REWARDS_CATALOG.filter((r) => r.rarity === 'legendary');
      } else {
        pool = REWARDS_CATALOG.filter((r) => r.rarity === 'mythic');
      }

      if (pool.length === 0) pool = REWARDS_CATALOG;
      const wonReward = pool[Math.floor(Math.random() * pool.length)];

      let newSpins = (user.free_spins_balance || 0) - 1;
      let newUc = user.total_uc || 0;
      let newPop = user.total_popularity || 0;

      if (wonReward.category === 'spins') newSpins += wonReward.value;
      if (wonReward.category === 'popularity') newPop += wonReward.value;
      if (wonReward.category === 'uc') newUc += wonReward.value;

      mockStore.updateUser(user.id, {
        free_spins_balance: newSpins,
        spins_count: (user.spins_count || 0) + 1,
        total_uc: newUc,
        total_popularity: newPop,
      });

      mockStore.addItemToInventory(user.id, wonReward.id, 1);

      mockStore.addSpinHistory({
        userId: user.id,
        reward_name: wonReward.name,
        reward_rarity: wonReward.rarity,
        reward_value: wonReward.value || 0,
      });

      if (['rare', 'epic', 'mythic', 'legendary'].includes(wonReward.rarity)) {
        mockStore.addEvent({
          userId: user.id,
          username: `@${user.username}`,
          rewardName: wonReward.name,
          rewardRarity: wonReward.rarity,
          rewardCategory: wonReward.category,
          icon: wonReward.icon,
        });

        mockStore.addNotification({
          userId: user.id,
          type: 'spin_win',
          title: 'Новогодний выигрыш! 🎄',
          message: `Поздравляем! Вы выиграли «${wonReward.name}» на Рождественском Колесе!`,
        });
      }

      return NextResponse.json({
        success: true,
        reward: wonReward,
        spins_left: newSpins,
        total_spins: (user.spins_count || 0) + 1,
        total_uc: newUc,
        total_popularity: newPop,
      });
    }
  } catch (err) {
    console.error('API /spin/play error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
