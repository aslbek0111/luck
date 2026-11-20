import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured, getSupabaseDiagnostics } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';

export async function POST(request) {
  try {
    const session = await getSessionUser(request);

    // Strict authentication enforcement
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
    }

    const userId = session.userId;
    const diag = getSupabaseDiagnostics();

    if (isServerSupabaseConfigured && supabaseServer && userId) {
      console.log(`[TITLES_UNEQUIP] Processing unequip request: userId=${userId}, isUsingServiceRole=${diag.isUsingServiceRole}`);

      const startTime = Date.now();
      const { data: updatedRows, error } = await supabaseServer
        .from('users')
        .update({
          active_title_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select('id, username, active_title_id, is_vip, is_admin');

      const durationMs = Date.now() - startTime;
      const affectedRows = Array.isArray(updatedRows) ? updatedRows.length : (updatedRows ? 1 : 0);
      const updatedUser = Array.isArray(updatedRows) && updatedRows.length > 0 ? updatedRows[0] : null;

      console.log(`[TITLES_UNEQUIP_UPDATE] userId=${userId}, affectedRows=${affectedRows}, duration=${durationMs}ms, error=${error ? error.message : 'none'}`);

      if (error) {
        console.error('[TITLES_UNEQUIP_ERROR] Supabase unequip error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      if (affectedRows === 0 || !updatedUser) {
        console.error(`[TITLES_UNEQUIP_ERROR] Supabase update affected 0 rows for userId=${userId}. keyRole=${diag.serviceRoleKeyRole}`);
        return NextResponse.json({
          success: false,
          error: 'Не удалось снять титул: 0 строк изменено в базе данных.',
          debug: {
            affectedRows: 0,
            hasServiceRoleKey: diag.hasServiceRoleKey,
            isUsingServiceRole: diag.isUsingServiceRole,
          },
        }, { status: 500 });
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
