import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';
import { REWARDS_CATALOG, toDbUuid } from '@/lib/catalog-data';
function selectRouletteReward() {
  const rand = Math.random() * 100;
  // 55% total coins:
  // 25 coins: 28% (rand < 28)
  // 50 coins: 16% (rand < 44)
  // 75 coins: 8%  (rand < 52)
  // 125 coins: 3% (rand < 55)
  if (rand < 28) return REWARDS_CATALOG.find((r) => r.id === 'reward-coins-25') || REWARDS_CATALOG[0];
  if (rand < 44) return REWARDS_CATALOG.find((r) => r.id === 'reward-coins-50') || REWARDS_CATALOG[0];
  if (rand < 52) return REWARDS_CATALOG.find((r) => r.id === 'reward-coins-75') || REWARDS_CATALOG[0];
  if (rand < 55) return REWARDS_CATALOG.find((r) => r.id === 'reward-coins-125') || REWARDS_CATALOG[0];

  // 45% remaining items: common, uncommon, rare, epic, legendary/mythic
  const itemRand = Math.random() * 45;
  let subPool = [];
  if (itemRand < 20) {
    subPool = REWARDS_CATALOG.filter((r) => r.rarity === 'common' && r.category !== 'coins' && !r.isTitle);
  } else if (itemRand < 32) {
    subPool = REWARDS_CATALOG.filter((r) => r.rarity === 'uncommon' && r.category !== 'coins' && !r.isTitle);
  } else if (itemRand < 40) {
    subPool = REWARDS_CATALOG.filter((r) => r.rarity === 'rare' && r.category !== 'coins' && !r.isTitle);
  } else if (itemRand < 44) {
    subPool = REWARDS_CATALOG.filter((r) => r.rarity === 'epic' && r.category !== 'coins' && !r.isTitle);
  } else {
    subPool = REWARDS_CATALOG.filter((r) => (r.rarity === 'legendary' || r.rarity === 'mythic') && !r.isTitle);
  }

  if (!subPool || subPool.length === 0) {
    subPool = REWARDS_CATALOG.filter((r) => r.category !== 'coins' && !r.isTitle);
  }

  return subPool[Math.floor(Math.random() * subPool.length)] || REWARDS_CATALOG[0];
}

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
      // 1. Fetch user to check daily 24h spin grant and calculate timer
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

      const isVipAdmin = Boolean(user.is_vip || user.is_admin);

      // Check and grant daily spins if 24 hours elapsed (for standard accounts)
      const nowMs = Date.now();
      const DAY_MS = 24 * 60 * 60 * 1000;
      let lastGrantMs = user.last_daily_spins_at ? new Date(user.last_daily_spins_at).getTime() : 0;
      let lastDailyAt = user.last_daily_spins_at;

      if (!isVipAdmin && (!user.last_daily_spins_at || nowMs - lastGrantMs >= DAY_MS)) {
        lastDailyAt = new Date(nowMs).toISOString();
        await supabaseServer
          .from('users')
          .update({
            free_spins_balance: (user.free_spins_balance || 0) + 2,
            last_daily_spins_at: lastDailyAt,
            updated_at: lastDailyAt,
          })
          .eq('id', user.id);
      }

      const nextGrantMs = (lastDailyAt ? new Date(lastDailyAt).getTime() : nowMs) + DAY_MS;
      const secondsRemaining = isVipAdmin ? 0 : Math.max(0, Math.ceil((nextGrantMs - nowMs) / 1000));
      const nextDailySpinsAt = isVipAdmin ? null : new Date(nextGrantMs).toISOString();

      // Authoritative roulette reward selection (55% coins, 45% gifts & souvenirs)
      const wonReward = selectRouletteReward();
      const dbRewardId = toDbUuid(wonReward.id) || wonReward.id;

      // Atomic spin execution in Supabase PostgreSQL
      const { data: rpcResult, error: rpcError } = await supabaseServer.rpc('play_spin_atomic', {
        p_user_id: userId,
        p_reward_id: dbRewardId,
      });

      if (rpcError) {
        console.error('Supabase play_spin_atomic error:', rpcError);
        return NextResponse.json(
          { success: false, error: rpcError.message || 'Ошибка базы данных при прокрутке Колеса' },
          { status: 500 }
        );
      }

      if (!rpcResult || !rpcResult.success) {
        return NextResponse.json({
          success: false,
          error: rpcResult?.error || 'У вас закончились бесплатные вращения на сегодня!',
          seconds_until_next_spins: secondsRemaining,
          next_daily_spins_at: nextDailySpinsAt,
        }, { status: 400 });
      }

      const formattedReward = {
        ...wonReward,
        ...(rpcResult.reward || {}),
        id: wonReward.id, // Preserve client slug format
      };

      return NextResponse.json({
        success: true,
        reward: formattedReward,
        spins_left: rpcResult.spins_left,
        total_spins: rpcResult.total_spins,
        total_uc: rpcResult.total_uc,
        total_popularity: rpcResult.total_popularity,
        coins_balance: rpcResult.coins_balance,
        coinsBalance: rpcResult.coins_balance,
        points_balance: rpcResult.points_balance,
        pointsBalance: rpcResult.points_balance,
        is_vip_admin: rpcResult.is_vip_admin,
        seconds_until_next_spins: secondsRemaining,
        next_daily_spins_at: nextDailySpinsAt,
      });
    } else {
      if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_STORE) {
        return NextResponse.json({ success: false, error: 'База данных Supabase не настроена на сервере' }, { status: 503 });
      }

      // Check and grant 24-hour daily spins first
      const dailyRes = mockStore.checkAndGrantDailySpins(userId);
      const user = mockStore.getUserById(userId);
      if (!user) {
        return NextResponse.json({ success: false, error: 'Пользователь не найден' }, { status: 404 });
      }

      if (user.is_blocked) {
        return NextResponse.json({ success: false, error: 'Ваш аккаунт заблокирован' }, { status: 403 });
      }

      const isVipAdmin = Boolean(user.is_vip || user.is_admin);

      if (!isVipAdmin && (user.free_spins_balance || 0) <= 0) {
        return NextResponse.json({
          success: false,
          error: 'У вас закончились бесплатные вращения на сегодня! Следующие 2 бесплатных спина будут доступны через 24 часа.',
          seconds_until_next_spins: dailyRes.secondsRemaining,
          next_daily_spins_at: dailyRes.nextDailySpinsAt,
        }, { status: 400 });
      }

      const wonReward = selectRouletteReward();

      let newSpins = user.free_spins_balance || 0;
      if (!isVipAdmin) {
        newSpins = Math.max(0, newSpins - 1);
        if (wonReward.category === 'spins') newSpins += wonReward.value;
      }

      let newUc = user.total_uc || 0;
      let newCoins = typeof user.coins_balance === 'number' ? user.coins_balance : 0;
      let newPoints = typeof user.points_balance === 'number' ? user.points_balance : newCoins;

      if (wonReward.category === 'uc') newUc += wonReward.value;
      if (wonReward.category === 'coins' || wonReward.id.startsWith('reward-coins-')) {
        newCoins += wonReward.value;
        newPoints += wonReward.value;
      }

      // Record Popularity Points permanently if won
      let newPop = user.total_popularity || 0;
      if (wonReward.category === 'popularity') {
        const spinTxRef = `spin-${user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        mockStore.recordPopularityTransaction({
          userId: user.id,
          amount: wonReward.value,
          source: 'spin',
          description: `Выигрыш на Колесе: ${wonReward.name}`,
          referenceId: spinTxRef,
        });
        const reloaded = mockStore.getUserById(user.id);
        newPop = reloaded ? reloaded.total_popularity : (newPop + wonReward.value);
      }

      mockStore.updateUser(user.id, {
        free_spins_balance: isVipAdmin ? 999999 : newSpins,
        spins_count: (user.spins_count || 0) + 1,
        total_uc: newUc,
        coins_balance: newCoins,
        points_balance: newPoints,
      });

      mockStore.addItemToInventory(user.id, wonReward.id, 1);

      mockStore.addSpinHistory({
        userId: user.id,
        reward_name: wonReward.name,
        reward_rarity: wonReward.rarity,
        reward_value: wonReward.value || 0,
      });

      if (['rare', 'epic', 'mythic', 'legendary', 'pro-epic'].includes(wonReward.rarity) || wonReward.category === 'coins' || wonReward.category === 'popularity') {
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
          title: wonReward.category === 'coins'
            ? `Выигрыш ${wonReward.name}! 🪙`
            : wonReward.category === 'popularity'
            ? `Выигрыш ${wonReward.name}! 🔥`
            : 'Новогодний выигрыш! 🎄',
          message: wonReward.category === 'coins'
            ? `Поздравляем! Вы выиграли «${wonReward.name}» на Колесе! Монеты зачислены на ваш баланс.`
            : wonReward.category === 'popularity'
            ? `Поздравляем! Вы выиграли «${wonReward.name}»! Очки популярности моментально зачислены в таблицу лидеров.`
            : `Поздравляем! Вы выиграли «${wonReward.name}» на Рождественском Колесе!`,
        });
      }

      return NextResponse.json({
        success: true,
        reward: wonReward,
        spins_left: isVipAdmin ? 999999 : newSpins,
        total_spins: (user.spins_count || 0) + 1,
        total_uc: newUc,
        total_popularity: newPop,
        coins_balance: newCoins,
        coinsBalance: newCoins,
        points_balance: newPoints,
        pointsBalance: newPoints,
        is_vip_admin: isVipAdmin,
        seconds_until_next_spins: dailyRes.secondsRemaining,
        next_daily_spins_at: dailyRes.nextDailySpinsAt,
      });
    }
  } catch (err) {
    console.error('API /spin/play error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
