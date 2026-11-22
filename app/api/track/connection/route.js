import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';
import { getClientIp } from '@/lib/ip-utils';

export async function POST(request) {
  try {
    const session = await getSessionUser(request);
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let user = null;
    if (isServerSupabaseConfigured && supabaseServer) {
      const { data } = await supabaseServer
        .from('users')
        .select('id, username, is_blocked')
        .eq('id', session.userId)
        .maybeSingle();
      user = data;
    } else {
      user = mockStore.getUserById(session.userId);
    }

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (user.is_blocked) {
      return NextResponse.json({ success: false, error: 'Account blocked' }, { status: 403 });
    }

    const clientIp = getClientIp(request);
    if (!clientIp) {
      return NextResponse.json({ success: false, error: 'Could not determine valid client IP' }, { status: 400 });
    }
    const userAgent = request.headers.get('user-agent') || '';

    if (isServerSupabaseConfigured && supabaseServer) {
      const { data, error } = await supabaseServer.rpc('log_user_connection', {
        p_user_id: user.id,
        p_username: user.username,
        p_ip: clientIp,
        p_user_agent: userAgent,
      });

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, ...data });
    } else {
      const res = mockStore.logUserConnection(user.id, user.username, clientIp, userAgent);
      return NextResponse.json(res);
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
