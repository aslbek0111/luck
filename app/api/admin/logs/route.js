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
      const { data: logs, error } = await supabaseServer
        .from('admin_audit_logs')
        .select(`
          id,
          action_type,
          target_user_id,
          details,
          created_at,
          admin:users!admin_audit_logs_admin_id_fkey (username),
          target:users!admin_audit_logs_target_user_id_fkey (username)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        logs: (logs || []).map((l) => ({
          id: l.id,
          actionType: l.action_type,
          adminUsername: l.admin?.username || 'Admin',
          targetUsername: l.target?.username || l.target_user_id || 'Все игроки',
          details: l.details,
          createdAt: l.created_at,
        })),
      });
    } else {
      const logs = mockStore.getAdminAuditLogs();
      return NextResponse.json({
        success: true,
        logs: logs.map((l) => ({
          id: l.id,
          actionType: l.actionType,
          adminUsername: 'lucky_admin',
          targetUsername: l.targetUserId === 'ALL' ? 'Все игроки' : (l.details?.username || l.targetUserId || 'Система'),
          details: l.details,
          createdAt: l.createdAt,
        })),
      });
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
