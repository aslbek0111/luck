import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';
import { toDbUuid } from '@/lib/catalog-data';

export async function POST(request) {
  try {
    const session = await getSessionUser(request);

    if (!session || !session.userId) {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация для продажи предметов' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { rewardId } = body;

    if (!rewardId) {
      return NextResponse.json(
        { success: false, error: 'Укажите идентификатор предмета для продажи' },
        { status: 400 }
      );
    }

    const userId = session.userId;

    if (isServerSupabaseConfigured && supabaseServer) {
      const cleanRewardIdentifier = String(toDbUuid(rewardId) || rewardId).trim();
      const cleanUserId = String(userId).trim();

      console.log('[SELL_DUPLICATE_RPC_DISPATCH]', {
        function: 'public.sell_duplicate_atomic(p_reward_identifier text, p_user_id uuid)',
        p_reward_identifier: {
          value: cleanRewardIdentifier,
          type: typeof cleanRewardIdentifier,
        },
        p_user_id: {
          value: cleanUserId,
          type: typeof cleanUserId,
        },
      });

      const { data: result, error } = await supabaseServer.rpc('sell_duplicate_atomic', {
        p_reward_identifier: cleanRewardIdentifier,
        p_user_id: cleanUserId,
      });

      if (error) {
        console.error('[SELL_DUPLICATE_RPC_ERROR]', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        return NextResponse.json(
          { success: false, error: error.message || 'Ошибка базы данных при продаже предмета' },
          { status: 500 }
        );
      }

      if (!result || !result.success) {
        return NextResponse.json(
          { success: false, error: result?.error || 'Не удалось продать предмет' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ...result,
        rewardName: result.item?.name || result.rewardName,
        earnedCoins: result.coins_earned ?? result.coinsEarned ?? result.earnedCoins,
        coinsEarned: result.coins_earned ?? result.coinsEarned ?? result.earnedCoins,
        coinsBalance: result.coins_balance ?? result.coinsBalance,
        remainingQuantity: result.item?.remaining_quantity ?? result.remainingQuantity ?? result.remaining_quantity,
      });
    } else {
      // Development / Mock-store mode
      const result = mockStore.sellDuplicate(userId, rewardId);

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      return NextResponse.json(result);
    }
  } catch (err) {
    console.error('API /inventory/sell error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const session = await getSessionUser(request);
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
    }

    const userId = session.userId;

    if (isServerSupabaseConfigured && supabaseServer) {
      const { data, error } = await supabaseServer
        .from('sales_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Fetch sales_history error:', error);
        return NextResponse.json({ success: true, history: [] });
      }

      return NextResponse.json({ success: true, history: data || [] });
    } else {
      const history = mockStore.getSalesHistory(userId);
      return NextResponse.json({ success: true, history });
    }
  } catch (err) {
    console.error('API GET /inventory/sell error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
