import { NextResponse } from 'next/server';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';
import { resolveTitle } from '@/lib/catalog-data';
export async function GET(request) {
  try {
    let leaders = [];

    if (isServerSupabaseConfigured && supabaseServer) {
      // Primary sort: total_popularity DESC
      // Secondary sort: most recent achievement time (popularity_updated_at DESC)
      // Tertiary sort: created_at ASC
      const { data, error } = await supabaseServer
        .from('users')
        .select('id, username, first_name, avatar_url, active_title_id, spins_count, total_uc, total_popularity, popularity_updated_at, is_admin, is_vip, profile_frame, vip_badge, created_at')
        .eq('is_blocked', false)
        .order('total_popularity', { ascending: false })
        .order('popularity_updated_at', { ascending: false })
        .order('created_at', { ascending: true });

      if (!error && Array.isArray(data)) {
        leaders = data;
      }
    } else {
      leaders = mockStore.getLeaderboard();
    }

    const enriched = leaders.map((u, index) => {
      const activeTitle = resolveTitle(u.active_title_id) || null;
      const pp = typeof u.total_popularity === 'number' ? u.total_popularity : 0;
      return {
        rank: index + 1,
        id: u.id,
        username: u.username,
        firstName: u.first_name,
        avatarUrl: u.avatar_url,
        activeTitle,
        spinsCount: u.spins_count || 0,
        totalUc: u.total_uc || 0,
        popularity: pp,
        pp: pp,
        popularityUpdatedAt: u.popularity_updated_at || u.created_at || null,
        isVip: Boolean(u.is_vip),
        isAdmin: Boolean(u.is_admin),
        profileFrame: u.profile_frame || 'default',
        vipBadge: u.vip_badge || null,
      };
    });

    const response = NextResponse.json({
      success: true,
      leaders: enriched,
      totalRanked: enriched.length,
    });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return response;
  } catch (err) {
    console.error('API /leaderboard error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
