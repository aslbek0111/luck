import { NextResponse } from 'next/server';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';

export async function GET() {
  try {
    let events = [];

    if (isServerSupabaseConfigured && supabaseServer) {
      const { data, error } = await supabaseServer
        .from('public_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        events = data.map((evt) => ({
          id: evt.id,
          userId: evt.user_id,
          username: evt.username,
          rewardName: evt.reward_name,
          rewardRarity: evt.reward_rarity,
          rewardCategory: evt.reward_category,
          icon: evt.reward_category === 'titles' ? 'Crown' : evt.reward_category === 'uc' ? 'Coins' : 'Sparkles',
          createdAt: new Date(evt.created_at).toLocaleDateString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        }));
      }
    } else if (process.env.NODE_ENV !== 'production') {
      events = mockStore.getEvents();
    }

    return NextResponse.json({ success: true, events });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
