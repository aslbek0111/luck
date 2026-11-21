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
      const dbRewardId = toDbUuid(rewardId) || rewardId;

      const { data: result, error } = await supabaseServer.rpc('sell_duplicate_atomic', {
        p_user_id: userId,
        p_reward_identifier: dbRewardId,
      });

      if (error) {
        console.error('Supabase sell_duplicate_atomic error:', error);
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

      return NextResponse.json(result);
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
