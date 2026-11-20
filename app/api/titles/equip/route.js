import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
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

    if (isServerSupabaseConfigured && supabaseServer && userId) {
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
        return NextResponse.json({ success: false, error: 'У вас нет этого титула в коллекции' }, { status: 403 });
      }

      // 4. Update user active_title_id with canonical database UUID
      const { data: updatedUser, error: updateErr } = await supabaseServer
        .from('users')
        .update({
          active_title_id: dbTitleId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (updateErr) {
        console.error('Supabase update active_title_id error:', updateErr);
        return NextResponse.json({ success: false, error: updateErr.message || 'Ошибка обновления титула' }, { status: 500 });
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
