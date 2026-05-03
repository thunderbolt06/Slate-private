import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRequestUser } from '@/utils/supabase/auth-bridge';

/**
 * POST /api/user/onboarding
 * Saves the onboarding answers into the authenticated user's
 * auth.users.user_metadata under the `onboarding` key.
 *
 * Body: the full OnboardingAnswers object (plus any extras the
 * client wants to stash). Silently no-ops for unauthenticated
 * users so the onboarding flow can be used pre-signup.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json({ ok: true, persisted: false });
    }

    const body = await req.json();

    // Use admin client so this works for both cookie- and bearer-auth callers.
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata ?? {}),
        onboarding: {
          ...body,
          completed_at: new Date().toISOString(),
        },
      },
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, persisted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
