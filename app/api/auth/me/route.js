import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';

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
