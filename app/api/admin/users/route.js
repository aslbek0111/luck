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
    const { targetUserId, action } = body;

    if (!targetUserId || !action) {
      return NextResponse.json({ success: false, error: 'Укажите targetUserId и action' }, { status: 400 });
    }

    if (isServerSupabaseConfigured && supabaseServer) {
      if (action === 'toggle_block') {
        const { data: target } = await supabaseServer.from('users').select('is_blocked').eq('id', targetUserId).single();
        const newStatus = !target?.is_blocked;
        await supabaseServer.from('users').update({ is_blocked: newStatus }).eq('id', targetUserId);

        await supabaseServer.from('admin_audit_logs').insert({
          admin_id: admin.id,
          action_type: newStatus ? 'ban_user' : 'unban_user',
          target_user_id: targetUserId,
          details: { is_blocked: newStatus },
        });

        return NextResponse.json({ success: true, is_blocked: newStatus });
      }
    } else {
      const target = mockStore.getUserById(targetUserId);
      if (!target) return NextResponse.json({ success: false, error: 'Игрок не найден' }, { status: 404 });

      if (action === 'toggle_block') {
        const newStatus = !target.is_blocked;
        mockStore.updateUser(targetUserId, { is_blocked: newStatus });

        mockStore.addAdminAuditLog({
          adminId: admin.id,
          actionType: newStatus ? 'ban_user' : 'unban_user',
          targetUserId,
          details: { username: target.username, is_blocked: newStatus },
        });

        return NextResponse.json({ success: true, is_blocked: newStatus });
      }
    }

    return NextResponse.json({ success: false, error: 'Неизвестное действие' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
