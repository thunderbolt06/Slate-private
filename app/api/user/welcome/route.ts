import { type NextRequest, NextResponse, after } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRequestUser } from '@/utils/supabase/auth-bridge';
import {
  addToSendgridContacts,
  sendNewUserWelcomeEmail,
} from '@/lib/server/waitlist-sendgrid';
import { createLogger } from '@/lib/logger';

const log = createLogger('user-welcome-api');

/**
 * POST /api/user/welcome
 * Sends the new-user welcome email and adds the user to the SendGrid
 * "All contacts" marketing list. Idempotent: marks
 * user_metadata.welcomed = true once dispatched so repeat calls no-op.
 */
export async function POST(req: NextRequest) {
  const user = await getRequestUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }

  if (user.user_metadata?.welcomed) {
    return NextResponse.json({ ok: true, alreadyWelcomed: true });
  }

  const email = user.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: 'no_email' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    log.error('Supabase admin client not configured');
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 });
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata ?? {}),
      welcomed: true,
      welcomed_at: new Date().toISOString(),
    },
  });

  if (updateError) {
    log.error('Failed to mark user as welcomed', { id: user.id, error: updateError });
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  after(() => {
    void sendNewUserWelcomeEmail(email);
    void addToSendgridContacts(email);
  });

  return NextResponse.json({ ok: true });
}
