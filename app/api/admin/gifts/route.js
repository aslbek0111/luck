import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';
import { REWARDS_CATALOG, toDbUuid } from '@/lib/catalog-data';

async function checkAdmin(request) {
  const session = await getSessionUser(request);
  if (!session || !session.userId) return null;

  if (isServerSupabaseConfigured && supabaseServer) {
    const { data: user } = await supabaseServer
      .from('users')
      .select('id, is_admin')
      .eq('id', session.userId)
      .maybeSingle();
    return user?.is_admin ? user : null;
  } else {
    const user = mockStore.getUserById(session.userId);
    return user?.is_admin ? user : null;
  }
}

export async function POST(request) {
  try {
    const admin = await checkAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Доступ разрешен только администраторам' }, { status: 403 });
    }

    const body = await request.json();
    const { targetUserId, rewardId, quantity = 1, message = '' } = body;

    if (!targetUserId || !rewardId) {
      return NextResponse.json({ success: false, error: 'Укажите targetUserId и rewardId' }, { status: 400 });
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ success: false, error: 'Количество должно быть больше 0' }, { status: 400 });
    }

    const reward = REWARDS_CATALOG.find((r) => r.id === rewardId || r.uuid === rewardId);
    if (!reward) {
      return NextResponse.json({ success: false, error: 'Награда не найдена в каталоге' }, { status: 404 });
    }

    const dbRewardId = toDbUuid(reward.id) || rewardId;

    if (isServerSupabaseConfigured && supabaseServer) {
      // 1. Fetch target user
      const { data: targetUser } = await supabaseServer
        .from('users')
        .select('id, username')
        .eq('id', targetUserId)
        .single();

      if (!targetUser) {
        return NextResponse.json({ success: false, error: 'Игрок не найден' }, { status: 404 });
      }

      // 2. Add item to user inventory with DB UUID
      const { data: existingInv } = await supabaseServer
        .from('user_inventory')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('reward_id', dbRewardId)
        .maybeSingle();

      if (existingInv) {
        await supabaseServer
          .from('user_inventory')
          .update({ quantity: existingInv.quantity + qty, updated_at: new Date().toISOString() })
          .eq('id', existingInv.id);
      } else {
        await supabaseServer.from('user_inventory').insert({
          user_id: targetUserId,
          reward_id: dbRewardId,
          quantity: qty,
        });
      }

      // 3. Create in-app notification
      await supabaseServer.from('notifications').insert({
        user_id: targetUserId,
        type: 'admin_bonus',
        title: 'Награда от Администрации! 🎁',
        message: `Вам начислена награда «${reward.name}» (${qty} шт.)! ${message ? `\nСообщение: «${message}»` : ''}`,
        data: { rewardId, rewardName: reward.name, quantity: qty, message },
      });

      // 4. Log admin audit
      await supabaseServer.from('admin_audit_logs').insert({
        admin_id: admin.id,
        action_type: 'grant_reward',
        target_user_id: targetUserId,
        details: { rewardId, rewardName: reward.name, quantity: qty, message },
      });

      return NextResponse.json({
        success: true,
        target: targetUser.username,
        rewardName: reward.name,
        quantity: qty,
      });
    } else {
      const result = mockStore.adminGrantReward({
        adminId: admin.id,
        targetUserId,
        rewardId,
        quantity: qty,
        message,
      });

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      return NextResponse.json(result);
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
