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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    if (isServerSupabaseConfigured && supabaseServer) {
      let query = supabaseServer
        .from('user_connections')
        .select(`
          id,
          user_id,
          username,
          ip_address,
          user_agent,
          connections_count,
          first_seen_at,
          last_seen_at,
          users:user_id (
            is_blocked,
            is_vip,
            is_admin
          )
        `, { count: 'exact' });

      if (search.trim()) {
        const s = search.trim();
        query = query.or(`username.ilike.%${s}%,ip_address.ilike.%${s}%`);
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data: rows, count, error } = await query
        .order('last_seen_at', { ascending: false })
        .range(from, to);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      const formatted = (rows || []).map((r) => {
        const u = r.users || {};
        let accountStatus = 'ACTIVE';
        if (u.is_admin && u.is_vip) accountStatus = 'VIP_ADMIN';
        else if (u.is_admin) accountStatus = 'ADMIN';
        else if (u.is_vip) accountStatus = 'VIP';
        else if (u.is_blocked) accountStatus = 'BLOCKED';

        return {
          id: r.id,
          user_id: r.user_id,
          username: r.username,
          ip_address: r.ip_address,
          user_agent: r.user_agent,
          connections_count: r.connections_count,
          first_seen_at: r.first_seen_at,
          last_seen_at: r.last_seen_at,
          is_blocked: Boolean(u.is_blocked),
          is_vip: Boolean(u.is_vip),
          is_admin: Boolean(u.is_admin),
          accountStatus,
        };
      });

      return NextResponse.json({
        success: true,
        connections: formatted,
        total: count || formatted.length,
        page,
        limit,
      });
    } else {
      const result = mockStore.getConnectionHistory({ search, page, limit });
      return NextResponse.json(result);
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
