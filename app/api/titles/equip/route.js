import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured, getSupabaseDiagnostics } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';
import { TITLES_LIST, resolveTitle, toDbUuid } from '@/lib/catalog-data';

export async function POST(request) {
  try {
    const session = await getSessionUser(request);

    // Strict authentication enforcement
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
    }

    const userId = session.userId;

    const body = await request.json().catch(() => ({}));
    const { titleId } = body;

    if (!titleId) {
      return NextResponse.json({ success: false, error: 'Укажите titleId' }, { status: 400 });
    }

    // 1. Resolve title metadata reliably across slug, UUID, and aliases
    const titleMeta = resolveTitle(titleId) || TITLES_LIST.find((t) => t.id === titleId || t.uuid === titleId || t.slug === titleId);
    if (!titleMeta) {
      return NextResponse.json({ success: false, error: 'Титул не найден в каталоге' }, { status: 404 });
    }

    const dbTitleId = toDbUuid(titleMeta.id) || toDbUuid(titleId) || titleMeta.uuid || titleId;

    const diag = getSupabaseDiagnostics();

    if (isServerSupabaseConfigured && supabaseServer && userId) {
      console.log(`[TITLES_EQUIP] Processing equip request: userId=${userId}, titleId=${titleId}, dbTitleId=${dbTitleId}, isUsingServiceRole=${diag.isUsingServiceRole}, keyRole=${diag.serviceRoleKeyRole}`);

      if (!diag.isUsingServiceRole && process.env.NODE_ENV === 'production') {
        console.warn(`[TITLES_EQUIP_WARNING] SUPABASE_SERVICE_ROLE_KEY is not configured with role 'service_role' (current: '${diag.serviceRoleKeyRole}'). Direct updates on public.users will be blocked by RLS.`);
      }

      // 2. Fetch user to check VIP status
      const { data: userRecord } = await supabaseServer
        .from('users')
        .select('id, username, is_vip, is_admin')
        .eq('id', userId)
        .maybeSingle();

      const isVipUser = Boolean(userRecord?.is_vip || userRecord?.is_admin);
      const isVipTitle = titleMeta.id === 'title-vip' || titleMeta.slug === 'vip';

      // 3. Verify user owns the title in user_inventory
      const { data: invItem, error: invErr } = await supabaseServer
        .from('user_inventory')
        .select('quantity, reward_id')
        .eq('user_id', userId)
        .eq('reward_id', dbTitleId)
        .maybeSingle();

      const hasInInventory = !invErr && invItem && invItem.quantity >= 1;

      if (!hasInInventory && !(isVipTitle && isVipUser)) {
        console.warn(`[TITLES_EQUIP_FORBIDDEN] User ${userId} does not own title ${dbTitleId} and is not VIP`);
        return NextResponse.json({ success: false, error: 'У вас нет этого титула в коллекции' }, { status: 403 });
      }

      // 4. Update user active_title_id with canonical database UUID
      const startTime = Date.now();
      const { data: updatedRows, error: updateErr } = await supabaseServer
        .from('users')
        .update({
          active_title_id: dbTitleId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select('id, username, active_title_id, is_vip, is_admin');

      const durationMs = Date.now() - startTime;
      const affectedRows = Array.isArray(updatedRows) ? updatedRows.length : (updatedRows ? 1 : 0);
      const updatedUser = Array.isArray(updatedRows) && updatedRows.length > 0 ? updatedRows[0] : null;

      console.log(`[TITLES_EQUIP_UPDATE] userId=${userId}, dbTitleId=${dbTitleId}, affectedRows=${affectedRows}, duration=${durationMs}ms, error=${updateErr ? updateErr.message : 'none'}`);

      if (updateErr) {
        console.error('[TITLES_EQUIP_ERROR] Supabase update active_title_id error:', updateErr);
        return NextResponse.json({
          success: false,
          error: updateErr.message || 'Ошибка обновления титула',
          debug: {
            affectedRows: 0,
            hasServiceRoleKey: diag.hasServiceRoleKey,
            isUsingServiceRole: diag.isUsingServiceRole,
          },
        }, { status: 500 });
      }

      if (affectedRows === 0 || !updatedUser) {
        console.error(`[TITLES_EQUIP_ERROR] Supabase update affected 0 rows for userId=${userId}. Possible RLS block or missing SUPABASE_SERVICE_ROLE_KEY. keyRole=${diag.serviceRoleKeyRole}`);
        return NextResponse.json({
          success: false,
          error: 'Не удалось обновить титул: 0 строк изменено в базе данных. Проверьте права доступа и SUPABASE_SERVICE_ROLE_KEY на сервере.',
          debug: {
            affectedRows: 0,
            hasServiceRoleKey: diag.hasServiceRoleKey,
            isUsingServiceRole: diag.isUsingServiceRole,
            serviceRoleKeyRole: diag.serviceRoleKeyRole,
          },
        }, { status: 500 });
      }

      if (updatedUser.active_title_id !== dbTitleId) {
        console.error(`[TITLES_EQUIP_ERROR] Supabase update returned unexpected active_title_id: ${updatedUser.active_title_id}, expected: ${dbTitleId}`);
        return NextResponse.json({
          success: false,
          error: 'База данных не сохранила active_title_id (значение осталось NULL). Проверьте триггеры или ограничения таблицы users.',
          debug: {
            savedValue: updatedUser.active_title_id,
            expectedValue: dbTitleId,
          },
        }, { status: 500 });
      }

      // 5. Log public event safely (using valid UUID dbTitleId)
      try {
        await supabaseServer.from('public_events').insert({
          user_id: userId,
          username: '@' + (updatedUser.username || userRecord?.username || 'Игрок'),
          reward_id: dbTitleId,
          reward_name: `Титул ${titleMeta.name}`,
          reward_rarity: titleMeta.rarity || 'epic',
          reward_category: 'titles',
          event_type: 'title_equipped',
        });
      } catch (eventErr) {
        console.warn('Non-critical public_events log notice:', eventErr);
      }

      const sanitizedUser = { ...updatedUser };
      delete sanitizedUser.password_hash;
      delete sanitizedUser.browser_pin;
      delete sanitizedUser.auth_token;

      return NextResponse.json({
        success: true,
        user: sanitizedUser,
        activeTitle: titleMeta,
        message: `Титул «${titleMeta.name}» успешно экипирован!`,
      });
    } else {
      if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_STORE) {
        return NextResponse.json({ success: false, error: 'База данных Supabase не настроена на сервере' }, { status: 503 });
      }

      const inv = mockStore.getUserInventory(userId);
      const user = mockStore.getUserById(userId);
      const isVipUser = Boolean(user?.is_vip || user?.is_admin);
      const isVipTitle = titleMeta.id === 'title-vip' || titleMeta.slug === 'vip';
      const owns = inv.some(
        (it) =>
          it.id === titleId ||
          it.id === titleMeta.id ||
          it.rewardId === titleId ||
          it.rewardId === titleMeta.id ||
          it.rewardId === dbTitleId
      );

      if (!owns && !(isVipTitle && isVipUser)) {
        return NextResponse.json({ success: false, error: 'У вас нет этого титула в коллекции' }, { status: 403 });
      }

      const updated = mockStore.equipTitle(userId, titleMeta.id);
      const sanitized = updated ? { ...updated } : null;
      if (sanitized) {
        delete sanitized.password_hash;
        delete sanitized.browser_pin;
        delete sanitized.auth_token;
      }

      return NextResponse.json({
        success: true,
        user: sanitized,
        activeTitle: titleMeta,
        message: `Титул «${titleMeta.name}» успешно экипирован!`,
      });
    }
  } catch (err) {
    console.error('API /titles/equip error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
