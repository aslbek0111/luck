import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';

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

export async function GET() {
  try {
    let isEnabled = true;

    if (isServerSupabaseConfigured && supabaseServer) {
      const { data } = await supabaseServer
        .from('system_config')
        .select('value')
        .eq('key', 'spin_wheel_enabled')
        .maybeSingle();
      if (data?.value?.enabled !== undefined) {
        isEnabled = Boolean(data.value.enabled);
      }
    } else {
      const config = mockStore.getSystemConfig('spin_wheel_enabled');
      if (config !== undefined) isEnabled = Boolean(config);
    }

    return NextResponse.json({ success: true, spin_wheel_enabled: isEnabled });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const admin = await checkAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Доступ разрешен только администраторам' }, { status: 403 });
    }

    const body = await request.json();
    const { action, targetUserId, amount, allUsers = false, enabled } = body;

    // Toggle global spin wheel availability
    if (action === 'toggle_spin_feature') {
      const newEnabled = Boolean(enabled);
      if (isServerSupabaseConfigured && supabaseServer) {
        await supabaseServer.from('system_config').upsert({
          key: 'spin_wheel_enabled',
          value: { enabled: newEnabled },
          updated_at: new Date().toISOString(),
        });
        await supabaseServer.from('admin_audit_logs').insert({
          admin_id: admin.id,
          action_type: 'toggle_spin_feature',
          details: { enabled: newEnabled },
        });
      } else {
        mockStore.setSystemConfig('spin_wheel_enabled', newEnabled);
        mockStore.addAdminAuditLog({
          adminId: admin.id,
          actionType: 'toggle_spin_feature',
          details: { enabled: newEnabled },
        });
      }

      return NextResponse.json({ success: true, spin_wheel_enabled: newEnabled });
    }

    // Grant or remove spins
    if (action === 'grant_spins') {
      const qty = parseInt(amount, 10);
      if (isNaN(qty) || qty === 0) {
        return NextResponse.json({ success: false, error: 'Укажите количество спинов (не 0)' }, { status: 400 });
      }

      if (isServerSupabaseConfigured && supabaseServer) {
        if (allUsers) {
          // Grant to all non-admin players
          const { data: nonAdminUsers } = await supabaseServer
            .from('users')
            .select('id, username, free_spins_balance')
            .eq('is_admin', false);

          for (const u of nonAdminUsers || []) {
            const newBalance = Math.max(0, (u.free_spins_balance || 0) + qty);
            await supabaseServer.from('users').update({ free_spins_balance: newBalance }).eq('id', u.id);

            await supabaseServer.from('notifications').insert({
              user_id: u.id,
              type: 'admin_bonus',
              title: 'Подарок от Администратора! 🎄',
              message: `Вам начислено ${qty} бесплатных спинов на Рождественском Колесе!`,
            });
          }

          await supabaseServer.from('admin_audit_logs').insert({
            admin_id: admin.id,
            action_type: 'grant_spins_all',
            details: { amount: qty, allUsers: true, count: nonAdminUsers?.length || 0 },
          });

          return NextResponse.json({ success: true, amount: qty, allUsers: true });
        } else {
          if (!targetUserId) {
            return NextResponse.json({ success: false, error: 'Укажите targetUserId' }, { status: 400 });
          }

          const { data: targetUser } = await supabaseServer
            .from('users')
            .select('id, username, free_spins_balance')
            .eq('id', targetUserId)
            .single();

          if (!targetUser) {
            return NextResponse.json({ success: false, error: 'Игрок не найден' }, { status: 404 });
          }

          const newBalance = Math.max(0, (targetUser.free_spins_balance || 0) + qty);
          await supabaseServer.from('users').update({ free_spins_balance: newBalance }).eq('id', targetUserId);

          await supabaseServer.from('notifications').insert({
            user_id: targetUserId,
            type: 'admin_bonus',
            title: 'Спины от Администратора! 🎄',
            message: `Вам начислено ${qty} бесплатных спинов на Рождественском Колесе!`,
          });

          await supabaseServer.from('admin_audit_logs').insert({
            admin_id: admin.id,
            action_type: 'grant_spins',
            target_user_id: targetUserId,
            details: { username: targetUser.username, amount: qty, newBalance },
          });

          return NextResponse.json({
            success: true,
            target: targetUser.username,
            amount: qty,
            newBalance,
          });
        }
      } else {
        const result = mockStore.adminGrantSpins({
          adminId: admin.id,
          targetUserId,
          amount: qty,
          allUsers,
        });

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }

        return NextResponse.json(result);
      }
    }

    return NextResponse.json({ success: false, error: 'Неизвестное действие' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
