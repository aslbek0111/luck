import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';
import { TITLES_LIST, REWARDS_CATALOG, toSlugId } from '@/lib/catalog-data';

export async function GET(request) {
  try {
    const session = await getSessionUser(request);

    // Strict authentication enforcement
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
    }

    const userId = session.userId;

    let user = null;
    let rawInventory = [];
    let giftsHistory = [];
    let lastWins = [];

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
            slug,
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
          const slugId = cat.slug || toSlugId(it.reward_id);
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
    } else {
      if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_STORE) {
        return NextResponse.json({ success: false, error: 'База данных Supabase не настроена на сервере' }, { status: 503 });
      }

      // Fallback mockStore - look up user specifically by session userId (dev only)
      user = mockStore.getUserById(userId);
      if (!user) {
        return NextResponse.json({ success: false, error: 'Пользователь не найден' }, { status: 404 });
      }

      const localInv = mockStore.getUserInventory(user.id);
      rawInventory = localInv
        .map((it) => {
          const itemMeta = REWARDS_CATALOG.find((r) => r.id === (it.id || it.rewardId));
          if (!itemMeta) return null;
          return {
            ...itemMeta,
            quantity: it.quantity,
            acquiredAt: it.acquiredAt,
          };
        })
        .filter(Boolean);

      giftsHistory = mockStore.getGiftsHistory(user.id);

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

    const activeTitle = TITLES_LIST.find((t) => t.id === user?.active_title_id) || null;

    const sanitizedUser = user ? { ...user } : null;
    if (sanitizedUser) {
      delete sanitizedUser.password_hash;
      delete sanitizedUser.browser_pin;
      delete sanitizedUser.auth_token;
    }

    return NextResponse.json({
      success: true,
      user: sanitizedUser,
      activeTitle,
      inventory: rawInventory,
      giftsHistory,
      lastWins,
      stats: {
        totalRewardsCount: rawInventory.reduce((acc, curr) => acc + (curr.quantity || 1), 0),
        uniqueRewardsCount: rawInventory.length,
        achievementsCount: Math.min(15, Math.floor((user?.spins_count || 0) / 10) + rawInventory.length),
        spinsCount: user?.spins_count || 0,
        totalUc: user?.total_uc || 0,
        popularity: user?.total_popularity || 0,
        freeSpins: user?.free_spins_balance || 0,
      },
    });
  } catch (err) {
    if (err?.digest?.startsWith('NEXT_PRERENDER') || err?.message?.includes('bail out of prerendering')) {
      throw err;
    }
    console.error('API /user/profile error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
