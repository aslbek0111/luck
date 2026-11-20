import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';
import { resolveReward, resolveTitle, toDbUuid } from '@/lib/catalog-data';

export async function POST(request) {
  try {
    const session = await getSessionUser(request);

    // 1. Strict authentication check
    if (!session || !session.userId) {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация для использования предметов' },
        { status: 401 }
      );
    }

    const userId = session.userId;
    const body = await request.json().catch(() => ({}));
    const rawItemId = body.itemId || body.itemSlug || body.rewardId;
    const quantity = Math.max(1, parseInt(body.quantity, 10) || 1);

    if (!rawItemId) {
      return NextResponse.json(
        { success: false, error: 'Укажите идентификатор предмета' },
        { status: 400 }
      );
    }

    const itemId = String(rawItemId).trim();

    // 2. Reject titles from being consumed
    const meta = resolveTitle(itemId);
    if (meta && (meta.isTitle || meta.category === 'titles')) {
      return NextResponse.json(
        { success: false, error: 'Титулы экипируются в профиле, а не расходуются' },
        { status: 400 }
      );
    }

    // 3. Supabase atomic execution
    if (isServerSupabaseConfigured && supabaseServer) {
      const dbItemUuid = toDbUuid(itemId) || itemId;

      const { data: rpcResult, error: rpcError } = await supabaseServer.rpc('use_inventory_item_atomic', {
        p_user_id: userId,
        p_item_identifier: dbItemUuid,
        p_quantity: quantity,
      });

      if (rpcError) {
        console.error('Supabase use_inventory_item_atomic error:', rpcError);
        return NextResponse.json(
          { success: false, error: rpcError.message || 'Ошибка базы данных при использовании предмета' },
          { status: 500 }
        );
      }

      if (!rpcResult || !rpcResult.success) {
        return NextResponse.json(
          { success: false, error: rpcResult?.error || 'Не удалось использовать предмет' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        item: rpcResult.item,
        quantityUsed: rpcResult.quantity_used || quantity,
        remainingQuantity: rpcResult.remaining_quantity,
        granted: rpcResult.granted,
        user: rpcResult.user,
        message: rpcResult.message,
      });
    }

    // 4. Local dev fallback (mockStore)
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_STORE) {
      return NextResponse.json(
        { success: false, error: 'База данных Supabase не настроена на сервере' },
        { status: 503 }
      );
    }

    const result = mockStore.useInventoryItem(userId, itemId, quantity);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      item: result.item,
      quantityUsed: result.quantityUsed,
      remainingQuantity: result.remainingQuantity,
      granted: result.granted,
      user: result.user,
      message: result.message,
    });
  } catch (err) {
    console.error('API /inventory/use error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Внутренняя ошибка сервера при использовании предмета' },
      { status: 500 }
    );
  }
}
