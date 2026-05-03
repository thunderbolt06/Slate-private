import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRequestUser } from '@/utils/supabase/auth-bridge';

/**
 * GET /api/notifications
 * Returns unread (and recent) notifications for the authenticated user.
 *
 * Query params:
 *   unread_only=true   (default true) - only return unread
 *   limit=20           (default 20)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get('unread_only') !== 'false';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);

    const admin = createAdminClient();
    let query = admin
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[notifications] fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }

    const unreadCount = unreadOnly
      ? (data ?? []).length
      : (data ?? []).filter((n) => !n.is_read).length;

    // camelCase mapping for the mobile contract; raw rows are also kept so
    // existing webapp callers still work.
    const notifications = (data ?? []).map((n) => ({
      ...n,
      readAt: n.is_read ? (n.updated_at ?? n.created_at) : null,
      createdAt: n.created_at,
    }));

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (err) {
    console.error('[notifications] error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications
 * Mark all notifications as read for the authenticated user.
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[notifications] PATCH error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
