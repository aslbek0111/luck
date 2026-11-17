import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';

export async function GET(request) {
  try {
    const session = await getSessionUser(request);
    if (!session || !session.userId) {
      return NextResponse.json({ success: true, authenticated: false, user: null }, { status: 200 });
    }

    let user = null;

    if (isServerSupabaseConfigured && supabaseServer) {
      const { data, error } = await supabaseServer
        .from('users')
        .select('*')
        .eq('id', session.userId)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json({ success: true, authenticated: false, user: null }, { status: 200 });
      }
      user = data;
    } else {
      user = mockStore.getUserById(session.userId);
    }

    if (!user) {
      return NextResponse.json({ success: true, authenticated: false, user: null }, { status: 200 });
    }

    const sanitizedUser = { ...user };
    delete sanitizedUser.password_hash;
    delete sanitizedUser.browser_pin;
    delete sanitizedUser.auth_token;

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: sanitizedUser,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
