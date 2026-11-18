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
      // 1. Try atomic RPC in Supabase
      const { data: rpcData, error: rpcErr } = await supabaseServer.rpc('check_and_grant_daily_spins_atomic', {
        p_user_id: userId,
      });

      if (!rpcErr && rpcData) {
        if (!rpcData.success) {
          return NextResponse.json({ success: false, error: rpcData.error }, { status: 400 });
        }
        return NextResponse.json(rpcData);
      }

      // Fallback direct server computation
      const { data: user, error: userErr } = await supabaseServer
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userErr || !user) {
        return NextResponse.json({ success: false, error: 'Пользователь не найден' }, { status: 404 });
      }

      if (user.is_vip || user.is_admin) {
        return NextResponse.json({
          success: true,
          is_vip: true,
          is_admin: true,
          free_spins: 999999,
          seconds_remaining: 0,
          next_daily_spins_at: null,
        });
      }

      const now = Date.now();
      const DAY_MS = 24 * 60 * 60 * 1000;
      const lastGrant = user.last_daily_spins_at ? new Date(user.last_daily_spins_at).getTime() : 0;
      let freeSpins = user.free_spins_balance || 0;
      let lastDailySpinsAt = user.last_daily_spins_at;
      let granted = false;

      if (!lastDailySpinsAt || now - lastGrant >= DAY_MS) {
        freeSpins = (user.free_spins_balance || 0) + 2;
        lastDailySpinsAt = new Date(now).toISOString();
        granted = true;

        await supabaseServer
          .from('users')
          .update({
            free_spins_balance: freeSpins,
            last_daily_spins_at: lastDailySpinsAt,
            updated_at: lastDailySpinsAt,
          })
          .eq('id', user.id);
      }

      const nextGrantTime = new Date(lastDailySpinsAt).getTime() + DAY_MS;
      const secondsRemaining = Math.max(0, Math.ceil((nextGrantTime - now) / 1000));

      return NextResponse.json({
        success: true,
        granted,
        free_spins: freeSpins,
        last_daily_spins_at: lastDailySpinsAt,
        next_daily_spins_at: new Date(nextGrantTime).toISOString(),
        seconds_remaining: secondsRemaining,
      });
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
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
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
