import { NextResponse } from 'next/server';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';
import { TITLES_LIST } from '@/lib/catalog-data';

export async function GET() {
  try {
    let leaders = [];

    if (isServerSupabaseConfigured && supabaseServer) {
      const { data, error } = await supabaseServer
        .from('users')
        .select('id, username, first_name, avatar_url, active_title_id, spins_count, total_uc, total_popularity, is_admin')
        .eq('is_blocked', false)
        .order('total_popularity', { ascending: false })
        .order('spins_count', { ascending: false })
        .limit(50);

      if (!error && data) {
        leaders = data;
      }
    } else if (process.env.NODE_ENV !== 'production') {
      const users = mockStore.getUsers();
      leaders = [...users].sort((a, b) => (b.total_popularity || 0) - (a.total_popularity || 0));
    }

    const enriched = leaders.map((u, index) => {
      const activeTitle = TITLES_LIST.find((t) => t.id === u.active_title_id) || null;
      return {
        rank: index + 1,
        id: u.id,
        username: u.username,
        firstName: u.first_name,
        avatarUrl: u.avatar_url,
        activeTitle,
        spinsCount: u.spins_count,
        totalUc: u.total_uc,
        popularity: u.total_popularity,
        isAdmin: Boolean(u.is_admin),
      };
    });

    return NextResponse.json({ success: true, leaders: enriched });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
