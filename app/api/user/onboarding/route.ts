import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

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
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: true, persisted: false });
    }

    const body = await req.json();

    const { error } = await supabase.auth.updateUser({
      data: {
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
