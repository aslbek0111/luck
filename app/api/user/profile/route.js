import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';
import { TITLES_LIST, REWARDS_CATALOG, toSlugId, resolveTitle } from '@/lib/catalog-data';

export async function GET(request) {
  try {
    const session = await getSessionUser(request);

    // Strict authentication enforcement
    if (!session || !session.userId) {
      const unauthRes = NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
      unauthRes.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      return unauthRes;
    }

    const userId = session.userId;

    let user = null;
    let rawInventory = [];
    let giftsHistory = [];
    let lastWins = [];
    let purchasesHistory = [];
    let nextDailySpinsAt = null;
    let secondsUntilNextSpins = 0;

    if (isServerSupabaseConfigured && supabaseServer) {
      // 1. Fetch user from Supabase
      const { data: userData, error: userErr } = await supabaseServer
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (userErr || !userData) {
        return NextResponse.json({ success: false, error: 'Пользователь не найден в Supabase' }, { status: 404 });
      }
      user = userData;

      // Check daily free spins (2 every 24 hours for standard accounts)
      const isVipUser = Boolean(user.is_vip);
      const isUserAdmin = Boolean(user.is_admin);

      if (!isVipUser && !isUserAdmin) {
        const nowMs = Date.now();
        const DAY_MS = 24 * 60 * 60 * 1000;
        const lastGrantMs = user.last_daily_spins_at ? new Date(user.last_daily_spins_at).getTime() : 0;
        let lastDailyAt = user.last_daily_spins_at;

        if (!lastDailyAt || nowMs - lastGrantMs >= DAY_MS) {
          user.free_spins_balance = (user.free_spins_balance || 0) + 2;
          lastDailyAt = new Date(nowMs).toISOString();
          user.last_daily_spins_at = lastDailyAt;
          await supabaseServer
            .from('users')
            .update({
              free_spins_balance: user.free_spins_balance,
              last_daily_spins_at: lastDailyAt,
              updated_at: lastDailyAt,
            })
            .eq('id', user.id);
        }

        user.total_uc = typeof user.total_uc === 'number' ? user.total_uc : 0;
        user.coins_balance = typeof user.coins_balance === 'number' ? user.coins_balance : 0;
        user.points_balance = user.coins_balance;

        const nextGrantMs = (lastDailyAt ? new Date(lastDailyAt).getTime() : nowMs) + DAY_MS;
        secondsUntilNextSpins = Math.max(0, Math.ceil((nextGrantMs - nowMs) / 1000));
        nextDailySpinsAt = new Date(nextGrantMs).toISOString();
      }

      // 2. Fetch inventory
      const { data: invData } = await supabaseServer
        .from('user_inventory')
        .select(`
          id,
          quantity,
          acquired_at,
          reward_id,
          rewards_catalog (
            id,
            name,
            category,
            rarity,
            icon_name,
            description,
            value,
            is_title,
            title_slug,
            conditions
          )
        `)
        .eq('user_id', user.id);

      if (invData) {
        rawInventory = invData.map((it) => {
          const cat = it.rewards_catalog || {};
          const slugId = toSlugId(it.reward_id) || cat.title_slug;
          return {
            id: slugId,
            rewardId: slugId,
            uuid: it.reward_id,
            inventoryId: it.id,
            name: cat.name || 'Награда',
            category: cat.category || 'jokes',
            rarity: cat.rarity || 'common',
            icon: cat.icon_name || 'Gift',
            description: cat.description || '',
            value: cat.value || 0,
            isTitle: Boolean(cat.is_title),
            titleSlug: cat.title_slug,
            conditions: cat.conditions,
            quantity: it.quantity,
            acquiredAt: it.acquired_at,
          };
        });
      }

      // 3. Fetch gifts history
      const { data: giftsData } = await supabaseServer
        .from('gifts_history')
        .select(`
          id,
          sender_id,
          recipient_id,
          reward_id,
          quantity,
          status,
          message,
          created_at,
          sender:users!gifts_history_sender_id_fkey (username),
          recipient:users!gifts_history_recipient_id_fkey (username),
          reward:rewards_catalog!gifts_history_reward_id_fkey (name, rarity)
        `)
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (giftsData) {
        giftsHistory = giftsData.map((g) => ({
          id: g.id,
          senderId: g.sender_id,
          senderUsername: g.sender?.username || 'Игрок',
          recipientId: g.recipient_id,
          recipientUsername: g.recipient?.username || 'Игрок',
          rewardId: g.reward_id,
          rewardName: g.reward?.name || 'Предмет',
          rewardRarity: g.reward?.rarity || 'common',
          quantity: g.quantity,
          message: g.message || '',
          createdAt: new Date(g.created_at).toLocaleDateString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        }));
      }

      // 4. Fetch recent spins / wins
      const { data: spinsData } = await supabaseServer
        .from('spins_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (spinsData) {
        lastWins = spinsData.map((s) => ({
          id: s.id,
          name: s.reward_name,
          rarity: s.reward_rarity,
          value: s.reward_value,
          acquiredAt: s.created_at,
          quantity: 1,
        }));
      }

      // 5. Fetch purchases history
      const { data: purData } = await supabaseServer
        .from('purchases_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (purData) {
        purchasesHistory = purData;
      }
    } else {
      if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_STORE) {
        return NextResponse.json({ success: false, error: 'База данных Supabase не настроена на сервере' }, { status: 503 });
      }

      // Fallback mockStore - look up user specifically by session userId (dev only)
      const dailyRes = mockStore.checkAndGrantDailySpins(userId);
      user = mockStore.getUserById(userId);
      if (!user) {
        return NextResponse.json({ success: false, error: 'Пользователь не найден' }, { status: 404 });
      }

      nextDailySpinsAt = dailyRes.nextDailySpinsAt;
      secondsUntilNextSpins = dailyRes.secondsRemaining;

      const localInv = mockStore.getUserInventory(user.id);
      rawInventory = localInv
        .map((it) => {
          const itemMeta = REWARDS_CATALOG.find((r) => r.id === (it.rewardId || it.id));
          if (!itemMeta) return null;
          return {
            ...itemMeta,
            quantity: it.quantity,
            acquiredAt: it.acquiredAt,
          };
        })
        .filter(Boolean);

      giftsHistory = mockStore.getGiftsHistory(user.id);
      purchasesHistory = mockStore.getPurchasesHistory(user.id);

      const userSpinsHistory = mockStore.getSpinsHistory(user.id);
      if (userSpinsHistory.length > 0) {
        lastWins = userSpinsHistory.map((s) => ({
          id: s.id,
          name: s.reward_name,
          rarity: s.reward_rarity,
          value: s.reward_value,
          acquiredAt: s.created_at,
          quantity: 1,
        }));
      } else {
        lastWins = [...rawInventory].sort((a, b) => new Date(b.acquiredAt) - new Date(a.acquiredAt));
      }
    }

    const isVip = Boolean(user?.is_vip);
    const isAdmin = Boolean(user?.is_admin);
    const activeTitle = resolveTitle(user?.active_title_id || (isVip ? 'title-vip' : null)) || null;

    const sanitizedUser = user ? { ...user } : null;
    if (sanitizedUser) {
      delete sanitizedUser.password_hash;
      delete sanitizedUser.browser_pin;
      delete sanitizedUser.auth_token;
      if (isVip) {
        sanitizedUser.is_vip = true;
        sanitizedUser.is_admin = true;
        sanitizedUser.profile_frame = 'vip_gold';
        sanitizedUser.vip_badge = 'VIP_ADMIN';
        if (!sanitizedUser.active_title_id) sanitizedUser.active_title_id = 'title-vip';
        sanitizedUser.total_uc = Math.max(sanitizedUser.total_uc || 0, 5000);
        sanitizedUser.free_spins_balance = Math.max(sanitizedUser.free_spins_balance || 0, 999999);
        sanitizedUser.coins_balance = Math.max(sanitizedUser.coins_balance || 0, 1000);
        sanitizedUser.points_balance = Math.max(sanitizedUser.points_balance || 0, 1000);
      } else if (isAdmin) {
        sanitizedUser.is_admin = true;
        sanitizedUser.is_vip = false;
        sanitizedUser.profile_frame = sanitizedUser.profile_frame || 'admin_shield';
        sanitizedUser.total_uc = Math.max(sanitizedUser.total_uc || 0, 5000);
        sanitizedUser.free_spins_balance = Math.max(sanitizedUser.free_spins_balance || 0, 999999);
        sanitizedUser.coins_balance = Math.max(sanitizedUser.coins_balance || 0, 999999);
        sanitizedUser.points_balance = Math.max(sanitizedUser.points_balance || 0, 999999);
      } else {
        sanitizedUser.total_uc = typeof sanitizedUser.total_uc === 'number' ? sanitizedUser.total_uc : 0;
        sanitizedUser.coins_balance = typeof sanitizedUser.coins_balance === 'number' ? sanitizedUser.coins_balance : 0;
        sanitizedUser.points_balance = sanitizedUser.coins_balance;
      }
      sanitizedUser.next_daily_spins_at = nextDailySpinsAt;
      sanitizedUser.seconds_until_next_spins = secondsUntilNextSpins;
    }

    const response = NextResponse.json({
      success: true,
      user: sanitizedUser,
      activeTitle,
      inventory: rawInventory,
      giftsHistory,
      purchasesHistory: purchasesHistory || [],
      lastWins,
      stats: {
        totalRewardsCount: rawInventory.reduce((acc, curr) => acc + (curr.quantity || 1), 0),
        uniqueRewardsCount: rawInventory.length,
        achievementsCount: Math.min(15, Math.floor((user?.spins_count || 0) / 10) + rawInventory.length),
        spinsCount: user?.spins_count || 0,
        totalUc: (isVip || isAdmin) ? Math.max(user?.total_uc || 0, 5000) : (user?.total_uc || 0),
        popularity: user?.total_popularity || 0,
        pp: user?.total_popularity || 0,
        freeSpins: isVip || isAdmin ? 999999 : (user?.free_spins_balance || 0),
        coinsBalance: isAdmin ? Math.max(user?.coins_balance ?? 999999, 999999) : (isVip ? Math.max(user?.coins_balance ?? 1000, 1000) : (user?.coins_balance || 0)),
        pointsBalance: isAdmin ? Math.max(user?.points_balance ?? 999999, 999999) : (isVip ? Math.max(user?.points_balance ?? 1000, 1000) : (user?.points_balance || 0)),
        nextDailySpinsAt,
        secondsUntilNextSpins,
      },
    });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return response;
  } catch (err) {
    if (err?.digest?.startsWith('NEXT_PRERENDER') || err?.message?.includes('bail out of prerendering')) {
      throw err;
    }
    console.error('API /user/profile error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
