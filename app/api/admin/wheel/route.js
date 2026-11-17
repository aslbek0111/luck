import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';
import { CHRISTMAS_REWARDS, REWARDS_CATALOG } from '@/lib/catalog-data';

// Default Christmas wheel segments setup
export const DEFAULT_WHEEL_SEGMENTS = [
  { id: 'seg-1', rewardId: 'reward-xmas-sticker', name: 'Новогодний стикер', rarity: 'common', weight: 30, isActive: true },
  { id: 'seg-2', rewardId: 'reward-xmas-snowflake-badge', name: 'Значок Снежинка', rarity: 'common', weight: 25, isActive: true },
  { id: 'seg-3', rewardId: 'reward-xmas-candy-cane', name: 'Леденец-Трость', rarity: 'common', weight: 20, isActive: true },
  { id: 'seg-4', rewardId: 'reward-xmas-snow-globe', name: 'Снежный шар', rarity: 'rare', weight: 12, isActive: true },
  { id: 'seg-5', rewardId: 'reward-xmas-santas-gift', name: 'Подарок Санты', rarity: 'rare', weight: 10, isActive: true },
  { id: 'seg-6', rewardId: 'reward-xmas-golden-bell', name: 'Золотой колокольчик', rarity: 'rare', weight: 8, isActive: true },
  { id: 'seg-7', rewardId: 'reward-xmas-magic-snowflake', name: 'Волшебная снежинка', rarity: 'epic', weight: 4, isActive: true },
  { id: 'seg-8', rewardId: 'reward-xmas-golden-tree', name: 'Золотая ёлочка', rarity: 'epic', weight: 3, isActive: true },
  { id: 'seg-9', rewardId: 'reward-xmas-santas-sleigh', name: 'Золотые сани Санты', rarity: 'legendary', weight: 1, isActive: true },
  { id: 'seg-10', rewardId: 'reward-xmas-miracle-box', name: 'Шкатулка Рождественского чуда', rarity: 'mythic', weight: 0.5, isActive: true },
];

async function checkAdmin(request) {
  const session = await getSessionUser(request);
  if (!session || !session.userId) return null;

  if (isServerSupabaseConfigured && supabaseServer) {
    const { data: user } = await supabaseServer
      .from('users')
      .select('id, is_admin')
      .eq('id', session.userId)
      .maybeSingle();
    return user?.is_admin ? user : null;
  } else {
    const user = mockStore.getUserById(session.userId);
    return user?.is_admin ? user : null;
  }
}

export async function GET(request) {
  try {
    let segments = null;

    if (isServerSupabaseConfigured && supabaseServer) {
      const { data } = await supabaseServer
        .from('system_config')
        .select('value')
        .eq('key', 'wheel_segments')
        .maybeSingle();
      if (data?.value && Array.isArray(data.value)) {
        segments = data.value;
      }
    }

    if (!segments) {
      segments = mockStore.getSystemConfig('wheel_segments');
    }

    if (!segments || !Array.isArray(segments)) {
      segments = DEFAULT_WHEEL_SEGMENTS;
    }

    // Enrich segments with catalog metadata (icon, description, etc.)
    const enrichedSegments = segments.map((seg) => {
      const meta = REWARDS_CATALOG.find((r) => r.id === seg.rewardId || r.uuid === seg.rewardId) || {};
      return {
        ...meta,
        ...seg,
      };
    });

    return NextResponse.json({
      success: true,
      segments: enrichedSegments,
      catalog: CHRISTMAS_REWARDS,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const admin = await checkAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Доступ разрешен только администраторам' }, { status: 403 });
    }

    const body = await request.json();
    const { action, segments, updatedSegment } = body;

    if (action === 'save_segments') {
      if (!Array.isArray(segments)) {
        return NextResponse.json({ success: false, error: 'Некорректный формат сегментов' }, { status: 400 });
      }

      if (isServerSupabaseConfigured && supabaseServer) {
        await supabaseServer.from('system_config').upsert({
          key: 'wheel_segments',
          value: segments,
          updated_at: new Date().toISOString(),
        });

        await supabaseServer.from('admin_audit_logs').insert({
          admin_id: admin.id,
          action_type: 'update_wheel_rewards',
          details: { count: segments.length },
        });
      }

      mockStore.setSystemConfig('wheel_segments', segments);
      mockStore.addAdminAuditLog({
        adminId: admin.id,
        actionType: 'update_wheel_rewards',
        details: { count: segments.length },
      });

      return NextResponse.json({ success: true, segments });
    }

    if (action === 'update_single_segment' && updatedSegment) {
      let currentSegments = null;
      if (isServerSupabaseConfigured && supabaseServer) {
        const { data } = await supabaseServer
          .from('system_config')
          .select('value')
          .eq('key', 'wheel_segments')
          .maybeSingle();
        if (data?.value && Array.isArray(data.value)) {
          currentSegments = data.value;
        }
      }

      if (!currentSegments) {
        currentSegments = mockStore.getSystemConfig('wheel_segments') || DEFAULT_WHEEL_SEGMENTS;
      }

      const index = currentSegments.findIndex((s) => s.id === updatedSegment.id);
      if (index !== -1) {
        currentSegments[index] = { ...currentSegments[index], ...updatedSegment };
      } else {
        currentSegments.push(updatedSegment);
      }

      if (isServerSupabaseConfigured && supabaseServer) {
        await supabaseServer.from('system_config').upsert({
          key: 'wheel_segments',
          value: currentSegments,
          updated_at: new Date().toISOString(),
        });

        await supabaseServer.from('admin_audit_logs').insert({
          admin_id: admin.id,
          action_type: 'update_wheel_reward',
          details: { segmentId: updatedSegment.id, name: updatedSegment.name },
        });
      }

      mockStore.setSystemConfig('wheel_segments', currentSegments);
      mockStore.addAdminAuditLog({
        adminId: admin.id,
        actionType: 'update_wheel_reward',
        details: { segmentId: updatedSegment.id, name: updatedSegment.name },
      });

      return NextResponse.json({ success: true, segments: currentSegments });
    }

    return NextResponse.json({ success: false, error: 'Неизвестное действие' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
