import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRequestUser } from '@/utils/supabase/auth-bridge';
import { getCreditSummary } from '@/lib/stripe/plans';
import type { UserPlan } from '@/lib/stripe/plans';

/**
 * GET /api/user/plan
 * Returns the authenticated user's current plan and credit usage.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Upsert to guarantee the row exists for new users
    const { data: plan, error } = await admin
      .from('user_plans')
      .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
      .select()
      .single();

    if (error) {
      // Row already exists - fetch it
      const { data: existing, error: fetchErr } = await admin
        .from('user_plans')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchErr || !existing) {
        return NextResponse.json({ error: 'Failed to fetch plan' }, { status: 500 });
      }

      const credits = getCreditSummary(existing as UserPlan);
      return NextResponse.json(
        { success: true, plan: existing, credits },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const credits = getCreditSummary(plan as UserPlan);
    return NextResponse.json(
      { success: true, plan, credits },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (err) {
    console.error('[user/plan] error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
