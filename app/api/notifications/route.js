import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseServer, isServerSupabaseConfigured } from '@/lib/supabaseServer';
import { mockStore } from '@/lib/mock-store';

export async function GET(request) {
  try {
    const session = await getSessionUser(request);
    const userId = session?.userId || (!isServerSupabaseConfigured ? mockStore.getCurrentUserId() : null);

    if (!userId) {
      return NextResponse.json({ success: true, notifications: [], unreadCount: 0 });
    }

    if (isServerSupabaseConfigured && supabaseServer) {
      const { data, error } = await supabaseServer
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      const notifications = (data || []).map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.is_read,
        data: n.data,
        createdAt: n.created_at,
      }));

      const unreadCount = notifications.filter((n) => !n.isRead).length;

      return NextResponse.json({
        success: true,
        notifications,
        unreadCount,
      });
    } else {
      const notifications = mockStore.getNotifications(userId);
      const unreadCount = notifications.filter((n) => !n.isRead).length;
      return NextResponse.json({
        success: true,
        notifications,
        unreadCount,
      });
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getSessionUser(request);
    const userId = session?.userId || (!isServerSupabaseConfigured ? mockStore.getCurrentUserId() : null);

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Не авторизован' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { notificationIds } = body;

    if (isServerSupabaseConfigured && supabaseServer) {
      let query = supabaseServer
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId);

      if (Array.isArray(notificationIds) && notificationIds.length > 0) {
        query = query.in('id', notificationIds);
      }

      const { error } = await query;
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    } else {
      mockStore.markNotificationsAsRead(userId, notificationIds);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
