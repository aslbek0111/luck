import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';
async function handleDailySpins(request) {
  try {
    const session = await getSessionUser(request);
    if (!session || !session.userId) {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация' },
        { status: 401 }
      );
    }

    const userId = session.userId;

    if (isServerSupabaseConfigured && supabaseServer) {
      // 1. Atomic RPC in Supabase
      const { data: rpcData, error: rpcErr } = await supabaseServer.rpc('check_and_grant_daily_spins_atomic', {
        p_user_id: userId,
      });

      if (rpcErr) {
        console.error('Supabase check_and_grant_daily_spins_atomic error:', rpcErr);
        return NextResponse.json(
          { success: false, error: rpcErr.message || 'Ошибка базы данных при начислении ежедневных вращений' },
          { status: 500 }
        );
      }

      if (!rpcData) {
        return NextResponse.json(
          { success: false, error: 'Ответ от базы данных отсутствует' },
          { status: 500 }
        );
      }

      if (!rpcData.success) {
        const errorMsg = rpcData.error || 'Не удалось начислить ежедневные вращения';
        const isBlocked =
          typeof errorMsg === 'string' &&
          (errorMsg.toLowerCase().includes('blocked') || errorMsg.toLowerCase().includes('заблокирован'));

        return NextResponse.json(
          { success: false, error: errorMsg },
          { status: isBlocked ? 403 : 400 }
        );
      }

      return NextResponse.json(rpcData);
    }

    // Dev store / mockStore execution
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_STORE) {
      return NextResponse.json(
        { success: false, error: 'База данных Supabase не настроена на сервере' },
        { status: 503 }
      );
    }

    const result = mockStore.checkAndGrantDailySpins(userId);
    if (!result.success) {
      const isBlocked = result.error && (result.error.includes('заблокирован') || result.error.includes('blocked'));
      return NextResponse.json({ success: false, error: result.error }, { status: isBlocked ? 403 : 400 });
    }

    return NextResponse.json({
      success: true,
      granted: result.granted,
      free_spins: result.freeSpins,
      freeSpins: result.freeSpins,
      last_daily_spins_at: result.lastDailySpinsAt,
      next_daily_spins_at: result.nextDailySpinsAt,
      seconds_remaining: result.secondsRemaining,
      is_vip: Boolean(result.isVip),
    });
  } catch (err) {
    console.error('API /spin/daily error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  return handleDailySpins(request);
}

export async function POST(request) {
  return handleDailySpins(request);
}
