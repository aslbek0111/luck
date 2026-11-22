import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';
import { getClientIp } from '@/lib/ip-utils';

export async function GET(request) {
  try {
    const session = await getSessionUser(request);
    const createResponse = (body, status = 200) => {
      const res = NextResponse.json(body, { status });
      res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      return res;
    };

    if (!session || !session.userId) {
      return createResponse({ success: true, authenticated: false, user: null }, 200);
    }

    let user = null;

    if (isServerSupabaseConfigured && supabaseServer) {
      const { data, error } = await supabaseServer
        .from('users')
        .select('*')
        .eq('id', session.userId)
        .maybeSingle();

      if (error || !data) {
        return createResponse({ success: true, authenticated: false, user: null }, 200);
      }
      user = data;
    } else {
      user = mockStore.getUserById(session.userId);
    }

    if (!user) {
      return createResponse({ success: true, authenticated: false, user: null }, 200);
    }

    // Strict ban enforcement: Blocked user cannot authenticate or perform actions
    if (user.is_blocked) {
      const blockedRes = createResponse(
        {
          success: false,
          authenticated: false,
          is_blocked: true,
          error: 'Ваш аккаунт заблокирован администратором',
          user: null,
        },
        403
      );
      // Immediately revoke cookie
      blockedRes.cookies.set('lucky_session', '', { maxAge: 0, path: '/' });
      return blockedRes;
    }

    // Background connection tracking (with reverse-proxy support and 15-min deduplication)
    try {
      const clientIp = getClientIp(request);
      const userAgent = request.headers.get('user-agent') || '';

      if (clientIp) {
        if (isServerSupabaseConfigured && supabaseServer) {
          supabaseServer.rpc('log_user_connection', {
            p_user_id: user.id,
            p_username: user.username,
            p_ip: clientIp,
            p_user_agent: userAgent,
          }).then(() => {}).catch(() => {});
        } else {
          mockStore.logUserConnection(user.id, user.username, clientIp, userAgent);
        }
      }
    } catch {
      // Non-blocking for auth response
    }

    const sanitizedUser = { ...user };
    delete sanitizedUser.password_hash;
    delete sanitizedUser.browser_pin;
    delete sanitizedUser.auth_token;

    return createResponse({
      success: true,
      authenticated: true,
      user: sanitizedUser,
    });
  } catch (err) {
    const errRes = NextResponse.json({ success: false, error: err.message }, { status: 500 });
    errRes.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return errRes;
  }
}
