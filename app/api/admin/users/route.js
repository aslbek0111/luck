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

export async function GET(request) {
  try {
    const admin = await checkAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Доступ разрешен только администраторам' }, { status: 403 });
    }

    if (isServerSupabaseConfigured && supabaseServer) {
      const { data: users, error } = await supabaseServer
        .from('users')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      const { data: codes } = await supabaseServer.from('registration_codes').select('*');

      const sanitizedUsers = (users || []).map((u) => {
        const copy = { ...u };
        delete copy.password_hash;
        delete copy.browser_pin;
        delete copy.auth_token;
        return copy;
      });

      return NextResponse.json({
        success: true,
        users: sanitizedUsers,
        codes: codes || [],
      });
    } else {
      const users = mockStore.getUsers().map((u) => {
        const copy = { ...u };
        delete copy.password_hash;
        delete copy.browser_pin;
        delete copy.auth_token;
        return copy;
      });
      const codes = mockStore.getRegistrationCodes();

      return NextResponse.json({
        success: true,
        users,
        codes,
      });
    }
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
    const { targetUserId, action, amount, allUsers, rewardId, quantity, operation = 'set', title, message } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: 'Укажите action' }, { status: 400 });
    }

    const PROTECTED_USERNAMES = ['vip5000x', 'vip2026z', 'vip7777m', 'vip9999k', 'admin', 'adminvip', 'lucky_admin'];

    if (isServerSupabaseConfigured && supabaseServer) {
      if (action === 'delete_user') {
        if (!targetUserId) return NextResponse.json({ success: false, error: 'Укажите targetUserId' }, { status: 400 });
        const { data: target } = await supabaseServer
          .from('users')
          .select('id, username, is_vip, is_admin')
          .eq('id', targetUserId)
          .single();

        if (!target) return NextResponse.json({ success: false, error: 'Пользователь не найден' }, { status: 404 });

        if (
          target.is_vip ||
          target.is_admin ||
          PROTECTED_USERNAMES.includes(target.username?.toLowerCase())
        ) {
          return NextResponse.json(
            { success: false, error: 'Запрещено удалять защищенные системные аккаунты (VIP / Admin)' },
            { status: 403 }
          );
        }

        // Try atomic RPC first, fallback to manual cascade
        const { data: rpcData, error: rpcErr } = await supabaseServer.rpc('admin_delete_user_atomic', {
          p_admin_id: admin.id,
          p_target_user_id: targetUserId,
        });

        if (!rpcErr && rpcData) {
          if (!rpcData.success) {
            return NextResponse.json({ success: false, error: rpcData.error }, { status: 400 });
          }
          return NextResponse.json(rpcData);
        }

        // Manual cascade fallback
        await supabaseServer.from('user_inventory').delete().eq('user_id', targetUserId);
        await supabaseServer.from('gifts_history').delete().or(`sender_id.eq.${targetUserId},recipient_id.eq.${targetUserId}`);
        await supabaseServer.from('spins_history').delete().eq('user_id', targetUserId);
        await supabaseServer.from('purchases_history').delete().eq('user_id', targetUserId);
        await supabaseServer.from('sales_history').delete().eq('user_id', targetUserId);
        await supabaseServer.from('notifications').delete().eq('user_id', targetUserId);
        await supabaseServer.from('user_connections').delete().eq('user_id', targetUserId);
        await supabaseServer.from('users').delete().eq('id', targetUserId);

        await supabaseServer.from('admin_audit_logs').insert({
          admin_id: admin.id,
          action_type: 'delete_user',
          target_user_id: targetUserId,
          details: { username: target.username, deletedAt: new Date().toISOString() },
        });

        return NextResponse.json({ success: true, message: `Аккаунт @${target.username} успешно удален` });
      }

      if (action === 'toggle_block') {
        if (!targetUserId) return NextResponse.json({ success: false, error: 'Укажите targetUserId' }, { status: 400 });
        const { data: target } = await supabaseServer
          .from('users')
          .select('username, is_blocked, is_vip, is_admin')
          .eq('id', targetUserId)
          .single();

        if (!target) return NextResponse.json({ success: false, error: 'Пользователь не найден' }, { status: 404 });

        const newStatus = !target.is_blocked;

        if (
          newStatus &&
          (target.is_vip || target.is_admin || PROTECTED_USERNAMES.includes(target.username?.toLowerCase()))
        ) {
          return NextResponse.json(
            { success: false, error: 'Запрещено блокировать защищенные аккаунты (VIP / Admin)' },
            { status: 403 }
          );
        }

        await supabaseServer.from('users').update({ is_blocked: newStatus }).eq('id', targetUserId);

        await supabaseServer.from('admin_audit_logs').insert({
          admin_id: admin.id,
          action_type: newStatus ? 'ban_user' : 'unban_user',
          target_user_id: targetUserId,
          details: { is_blocked: newStatus },
        });

        return NextResponse.json({ success: true, is_blocked: newStatus });
      }

      if (action === 'unblock_all') {
        await supabaseServer.from('users').update({ is_blocked: false, is_approved: true }).neq('id', '00000000-0000-0000-0000-000000000000');
        await supabaseServer.from('admin_audit_logs').insert({
          admin_id: admin.id,
          action_type: 'unblock_all',
          details: { message: 'Все пользователи разблокированы администратором' },
        });
        return NextResponse.json({ success: true, message: 'Все игроки успешно разблокированы' });
      }

      if (action === 'grant_uc') {
        const ucQty = parseInt(amount, 10);
        if (isNaN(ucQty) || ucQty === 0) {
          return NextResponse.json({ success: false, error: 'Укажите количество UC' }, { status: 400 });
        }

        if (allUsers) {
          const { data: allUsersList } = await supabaseServer.from('users').select('id, username, total_uc');
          for (const u of allUsersList || []) {
            const newUc = Math.max(0, (u.total_uc || 0) + ucQty);
            await supabaseServer.from('users').update({ total_uc: newUc }).eq('id', u.id);
            await supabaseServer.from('notifications').insert({
              user_id: u.id,
              type: 'admin_bonus',
              title: 'Начисление UC! 🪙',
              message: `Вам начислено ${ucQty} UC от Администратора!`,
            });
          }
          await supabaseServer.from('admin_audit_logs').insert({
            admin_id: admin.id,
            action_type: 'grant_uc_all',
            details: { amount: ucQty, allUsers: true },
          });
          return NextResponse.json({ success: true, amount: ucQty, allUsers: true });
        } else {
          if (!targetUserId) return NextResponse.json({ success: false, error: 'Укажите targetUserId' }, { status: 400 });
          const { data: target } = await supabaseServer.from('users').select('id, username, total_uc').eq('id', targetUserId).single();
          if (!target) return NextResponse.json({ success: false, error: 'Игрок не найден' }, { status: 404 });
          const newUc = Math.max(0, (target.total_uc || 0) + ucQty);
          await supabaseServer.from('users').update({ total_uc: newUc }).eq('id', targetUserId);
          await supabaseServer.from('notifications').insert({
            user_id: targetUserId,
            type: 'admin_bonus',
            title: 'Начисление UC! 🪙',
            message: `Вам начислено ${ucQty} UC от Администратора!`,
          });
          await supabaseServer.from('admin_audit_logs').insert({
            admin_id: admin.id,
            action_type: 'grant_uc',
            target_user_id: targetUserId,
            details: { username: target.username, amount: ucQty, newUc },
          });
          return NextResponse.json({ success: true, target: target.username, amount: ucQty, newUc });
        }
      }

      if (action === 'manage_inventory') {
        if (!targetUserId || !rewardId) {
          return NextResponse.json({ success: false, error: 'Укажите targetUserId и rewardId' }, { status: 400 });
        }
        const qty = parseInt(quantity, 10);
        if (isNaN(qty) || qty < 0) {
          return NextResponse.json({ success: false, error: 'Некорректное количество' }, { status: 400 });
        }

        if (operation === 'set') {
          if (qty <= 0) {
            await supabaseServer.from('user_inventory').delete().eq('user_id', targetUserId).eq('reward_id', rewardId);
          } else {
            await supabaseServer.from('user_inventory').upsert({ user_id: targetUserId, reward_id: rewardId, quantity: qty }, { onConflict: 'user_id,reward_id' });
          }
        } else if (operation === 'add') {
          const { data: existing } = await supabaseServer.from('user_inventory').select('id, quantity').eq('user_id', targetUserId).eq('reward_id', rewardId).maybeSingle();
          const newQty = (existing?.quantity || 0) + qty;
          await supabaseServer.from('user_inventory').upsert({ user_id: targetUserId, reward_id: rewardId, quantity: newQty }, { onConflict: 'user_id,reward_id' });
        } else if (operation === 'remove') {
          const { data: existing } = await supabaseServer.from('user_inventory').select('id, quantity').eq('user_id', targetUserId).eq('reward_id', rewardId).maybeSingle();
          const newQty = Math.max(0, (existing?.quantity || 0) - qty);
          if (newQty <= 0) {
            await supabaseServer.from('user_inventory').delete().eq('user_id', targetUserId).eq('reward_id', rewardId);
          } else {
            await supabaseServer.from('user_inventory').update({ quantity: newQty }).eq('id', existing.id);
          }
        }

        await supabaseServer.from('admin_audit_logs').insert({
          admin_id: admin.id,
          action_type: 'manage_inventory',
          target_user_id: targetUserId,
          details: { rewardId, quantity: qty, operation },
        });

        return NextResponse.json({ success: true, targetUserId, rewardId, quantity: qty });
      }

      if (action === 'send_notification') {
        if (!title || !message) {
          return NextResponse.json({ success: false, error: 'Заголовок и сообщение обязательны' }, { status: 400 });
        }

        if (allUsers) {
          const { data: users } = await supabaseServer.from('users').select('id');
          for (const u of users || []) {
            await supabaseServer.from('notifications').insert({
              user_id: u.id,
              type: 'system',
              title,
              message,
            });
          }
        } else {
          if (!targetUserId) return NextResponse.json({ success: false, error: 'Укажите targetUserId' }, { status: 400 });
          await supabaseServer.from('notifications').insert({
            user_id: targetUserId,
            type: 'system',
            title,
            message,
          });
        }

        await supabaseServer.from('admin_audit_logs').insert({
          admin_id: admin.id,
          action_type: 'send_notification',
          target_user_id: allUsers ? 'ALL' : targetUserId,
          details: { title, message, allUsers },
        });

        return NextResponse.json({ success: true, allUsers, targetUserId });
      }
    } else {
      if (action === 'delete_user') {
        if (!targetUserId) return NextResponse.json({ success: false, error: 'Укажите targetUserId' }, { status: 400 });
        const result = mockStore.adminDeleteUser(admin.id, targetUserId);
        if (!result.success) {
          const status = result.error.includes('Запрещено') ? 403 : 400;
          return NextResponse.json({ success: false, error: result.error }, { status });
        }
        return NextResponse.json(result);
      }

      if (action === 'toggle_block') {
        if (!targetUserId) return NextResponse.json({ success: false, error: 'Укажите targetUserId' }, { status: 400 });
        const target = mockStore.getUserById(targetUserId);
        if (!target) return NextResponse.json({ success: false, error: 'Игрок не найден' }, { status: 404 });

        const newStatus = !target.is_blocked;

        if (
          newStatus &&
          (target.is_vip || target.is_admin || PROTECTED_USERNAMES.includes(target.username?.toLowerCase()))
        ) {
          return NextResponse.json(
            { success: false, error: 'Запрещено блокировать защищенные аккаунты (VIP / Admin)' },
            { status: 403 }
          );
        }

        mockStore.updateUser(targetUserId, { is_blocked: newStatus });

        mockStore.addAdminAuditLog({
          adminId: admin.id,
          actionType: newStatus ? 'ban_user' : 'unban_user',
          targetUserId,
          details: { username: target.username, is_blocked: newStatus },
        });

        return NextResponse.json({ success: true, is_blocked: newStatus });
      }

      if (action === 'unblock_all') {
        mockStore.unblockAllUsers();
        mockStore.addAdminAuditLog({
          adminId: admin.id,
          actionType: 'unblock_all',
          details: { message: 'Все пользователи разблокированы администратором' },
        });
        return NextResponse.json({ success: true, message: 'Все игроки успешно разблокированы' });
      }

      if (action === 'grant_uc') {
        const result = mockStore.adminGrantUc({
          adminId: admin.id,
          targetUserId,
          amount,
          allUsers: Boolean(allUsers),
        });
        if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        return NextResponse.json(result);
      }

      if (action === 'manage_inventory') {
        const result = mockStore.adminManageInventory({
          adminId: admin.id,
          targetUserId,
          rewardId,
          quantity,
          operation,
        });
        if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        return NextResponse.json(result);
      }

      if (action === 'send_notification') {
        const result = mockStore.adminSendNotification({
          adminId: admin.id,
          targetUserId,
          title,
          message,
          allUsers: Boolean(allUsers),
        });
        if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        return NextResponse.json(result);
      }
    }

    return NextResponse.json({ success: false, error: 'Неизвестное действие' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
