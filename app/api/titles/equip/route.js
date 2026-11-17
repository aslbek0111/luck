import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';
import { TITLES_LIST, toDbUuid } from '@/lib/catalog-data';

export async function POST(request) {
  try {
    const session = await getSessionUser(request);

    // Strict authentication enforcement
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, error: 'Требуется авторизация' }, { status: 401 });
    }

    const userId = session.userId;

    const body = await request.json();
    const { titleId } = body;

    if (!titleId) {
      return NextResponse.json({ success: false, error: 'Укажите titleId' }, { status: 400 });
    }

    const titleMeta = TITLES_LIST.find((t) => t.id === titleId || t.uuid === titleId || t.slug === titleId);
    if (!titleMeta) {
      return NextResponse.json({ success: false, error: 'Титул не найден в каталоге' }, { status: 404 });
    }

    const dbTitleId = toDbUuid(titleMeta.id) || titleId;

    if (isServerSupabaseConfigured && supabaseServer && userId) {
      // 1. Verify user owns the title in user_inventory
      const { data: invItem, error: invErr } = await supabaseServer
        .from('user_inventory')
        .select('quantity, reward_id')
        .eq('user_id', userId)
        .eq('reward_id', dbTitleId)
        .maybeSingle();

      if (invErr || !invItem || invItem.quantity < 1) {
        return NextResponse.json({ success: false, error: 'У вас нет этого титула в коллекции' }, { status: 403 });
      }

      // 2. Update user active_title_id
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
        return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
      }

      // 3. Log event
      await supabaseServer.from('public_events').insert({
        user_id: userId,
        username: '@' + (updatedUser.username || 'Игрок'),
        reward_id: titleId,
        reward_name: `Титул ${titleMeta.name}`,
        reward_rarity: titleMeta.rarity,
        reward_category: 'titles',
        event_type: 'title_equipped',
      });

      return NextResponse.json({ success: true, user: updatedUser, activeTitle: titleMeta });
    } else {
      if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_STORE) {
        return NextResponse.json({ success: false, error: 'База данных Supabase не настроена на сервере' }, { status: 503 });
      }
      const updated = mockStore.equipTitle(userId, titleId);
      return NextResponse.json({ success: true, user: updated, activeTitle: titleMeta });
    }
  } catch (err) {
    console.error('API /titles/equip error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
