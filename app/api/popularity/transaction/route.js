import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';
export async function POST(request) {
  try {
    const session = await getSessionUser(request);
    if (!session || !session.userId) {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация для начисления очков популярности' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawAmount = body.amount ?? body.pp;
    const amount = parseInt(rawAmount, 10);
    const source = (body.source || 'achievement').trim();
    const description = (body.description || 'Начисление очков популярности (PP)').trim();
    const referenceId = body.referenceId ? String(body.referenceId).trim() : null;

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Количество очков популярности должно быть положительным числом' },
        { status: 400 }
      );
    }

    // Determine target user (allow admin to credit another user if specified)
    let targetUserId = session.userId;
    if (body.targetUserId && body.targetUserId !== session.userId) {
      let isAdmin = false;
      if (isServerSupabaseConfigured && supabaseServer) {
        const { data: adminUser } = await supabaseServer
          .from('users')
          .select('is_admin')
          .eq('id', session.userId)
          .maybeSingle();
        isAdmin = Boolean(adminUser?.is_admin);
      } else {
        const adminUser = mockStore.getUserById(session.userId);
        isAdmin = Boolean(adminUser?.is_admin);
      }

      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: 'Только администратор может начислять PP другим игрокам' },
          { status: 403 }
        );
      }
      targetUserId = body.targetUserId;
    }

    if (isServerSupabaseConfigured && supabaseServer) {
      // 1. Try atomic RPC in Supabase
      const { data: rpcData, error: rpcErr } = await supabaseServer.rpc('record_popularity_transaction_atomic', {
        p_user_id: targetUserId,
        p_amount: amount,
        p_source: source,
        p_description: description,
        p_reference_id: referenceId,
      });

      if (!rpcErr && rpcData) {
        if (!rpcData.success) {
          return NextResponse.json({ success: false, error: rpcData.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, ...rpcData });
      }

      // Fallback direct transaction query in Supabase
      if (referenceId) {
        const { data: existingTx } = await supabaseServer
          .from('popularity_transactions')
          .select('*')
          .eq('reference_id', referenceId)
          .maybeSingle();

        if (existingTx) {
          const { data: u } = await supabaseServer
            .from('users')
            .select('total_popularity')
            .eq('id', targetUserId)
            .single();
          return NextResponse.json({
            success: true,
            alreadyProcessed: true,
            total_popularity: u?.total_popularity || 0,
            message: 'Транзакция уже обработана ранее (защита от дублирования)',
          });
        }
      }

      const { data: user, error: userErr } = await supabaseServer
        .from('users')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (userErr || !user) {
        return NextResponse.json({ success: false, error: 'Пользователь не найден' }, { status: 404 });
      }

      const newPopularity = (user.total_popularity || 0) + amount;
      const nowIso = new Date().toISOString();

      await supabaseServer
        .from('users')
        .update({
          total_popularity: newPopularity,
          popularity_updated_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', user.id);

      await supabaseServer.from('popularity_transactions').insert({
        user_id: user.id,
        amount,
        source,
        description,
        reference_id: referenceId,
      });

      return NextResponse.json({
        success: true,
        user_id: user.id,
        username: user.username,
        added_amount: amount,
        total_popularity: newPopularity,
        popularity_updated_at: nowIso,
      });
    }

    // Dev store / mockStore execution
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_STORE) {
      return NextResponse.json(
        { success: false, error: 'База данных Supabase не настроена на сервере' },
        { status: 503 }
      );
    }

    const result = mockStore.recordPopularityTransaction({
      userId: targetUserId,
      amount,
      source,
      description,
      referenceId,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('API /popularity/transaction error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
