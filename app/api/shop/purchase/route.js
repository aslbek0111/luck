import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';
import { isItemAvailableInShop, resolveReward, resolveTitle, toDbUuid } from '@/lib/catalog-data';

export async function POST(request) {
  try {
    const session = await getSessionUser(request);

    // 1. Strict authentication check
    if (!session || !session.userId) {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация для совершения покупок' },
        { status: 401 }
      );
    }

    const userId = session.userId;
    const body = await request.json().catch(() => ({}));
    const rawItemId = body.itemId || body.itemSlug || body.rewardId;
    const quantity = Math.max(1, parseInt(body.quantity, 10) || 1);

    if (!rawItemId) {
      return NextResponse.json(
        { success: false, error: 'Укажите идентификатор товара для покупки' },
        { status: 400 }
      );
    }

    const itemId = String(rawItemId).trim();

    // 2. Strict UC VIP check
    if (!isItemAvailableInShop(itemId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Товар (UC VIP) недоступен для покупки за Монеты. Он полностью исключен из магазина.',
        },
        { status: 400 }
      );
    }

    // 3. Supabase atomic purchase execution
    if (isServerSupabaseConfigured && supabaseServer) {
      // First ensure item UUID
      const dbItemUuid = toDbUuid(itemId) || itemId;

      const { data: rpcResult, error: rpcError } = await supabaseServer.rpc('purchase_item_atomic', {
        p_user_id: userId,
        p_item_slug: dbItemUuid,
        p_quantity: quantity,
      });

      if (rpcError) {
        console.error('Supabase purchase_item_atomic error:', rpcError);
        return NextResponse.json(
          { success: false, error: rpcError.message || 'Ошибка базы данных при покупке товара' },
          { status: 500 }
        );
      }

      if (!rpcResult || !rpcResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: rpcResult?.error || 'Не удалось совершить покупку',
            requiredCoins: rpcResult?.required_coins ?? rpcResult?.required_points,
            requiredPoints: rpcResult?.required_points,
            currentCoins: rpcResult?.current_coins ?? rpcResult?.current_points,
            currentPoints: rpcResult?.current_points,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        item: rpcResult.item,
        costCoins: rpcResult.cost_coins ?? rpcResult.cost_points,
        costPoints: rpcResult.cost_points,
        coinsBalance: rpcResult.coins_balance ?? rpcResult.points_balance,
        coins_balance: rpcResult.coins_balance ?? rpcResult.points_balance,
        pointsBalance: rpcResult.points_balance,
        points_balance: rpcResult.points_balance,
        isAdmin: rpcResult.is_admin,
        message: rpcResult.message,
      });
    }

    // 4. Local fallback (dev store / mock)
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_STORE) {
      return NextResponse.json(
        { success: false, error: 'База данных Supabase не настроена на сервере' },
        { status: 503 }
      );
    }

    const result = mockStore.purchaseItem(userId, itemId, quantity);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          requiredCoins: result.requiredCoins ?? result.requiredPoints,
          requiredPoints: result.requiredPoints,
          currentCoins: result.currentCoins ?? result.currentPoints,
          currentPoints: result.currentPoints,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      item: result.item,
      costCoins: result.costCoins ?? result.costPoints,
      costPoints: result.costPoints,
      coinsBalance: result.coinsBalance ?? result.pointsBalance,
      coins_balance: result.coins_balance ?? result.points_balance,
      pointsBalance: result.pointsBalance,
      points_balance: result.points_balance,
      isAdmin: result.isAdmin,
      message: result.message,
    });
  } catch (err) {
    console.error('API /shop/purchase error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Внутренняя ошибка сервера при обработке покупки' },
      { status: 500 }
    );
  }
}
