import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRequestUser } from '@/utils/supabase/auth-bridge';

/**
 * POST /api/user/credits/check
 * Atomically checks if the user has course-creation credits and
 * increments the counter if allowed.
 *
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('increment_course_credit', {
      p_user_id: user.id,
    });

    if (error) {
      console.error('[credits/check] rpc error:', error);
      return NextResponse.json({ error: 'Failed to check credits' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[credits/check] error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
