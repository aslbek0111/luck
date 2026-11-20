import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';

export async function POST(request) {
  try {
    const session = await getSessionUser(request);

    // Strict authentication enforcement
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
    }

    const userId = session.userId;

    if (isServerSupabaseConfigured && supabaseServer && userId) {
      const { data: updatedUser, error } = await supabaseServer
        .from('users')
        .update({
          active_title_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      const sanitized = updatedUser ? { ...updatedUser } : null;
      if (sanitized) {
        delete sanitized.password_hash;
        delete sanitized.browser_pin;
        delete sanitized.auth_token;
      }

      return NextResponse.json({ success: true, user: sanitized, activeTitle: null });
    } else {
      if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_STORE) {
        return NextResponse.json({ success: false, error: 'База данных Supabase не настроена на сервере' }, { status: 503 });
      }
      const updated = mockStore.unequipTitle(userId);
      const sanitized = updated ? { ...updated } : null;
      if (sanitized) {
        delete sanitized.password_hash;
        delete sanitized.browser_pin;
        delete sanitized.auth_token;
      }

      return NextResponse.json({ success: true, user: sanitized, activeTitle: null });
    }
  } catch (err) {
    console.error('API /titles/unequip error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
