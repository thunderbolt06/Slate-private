import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/utils/supabase/admin';
import { getPostHogClient } from '@/lib/posthog-server';

/**
 * POST /api/razorpay/webhook
 *
 * Razorpay → server webhook for subscription lifecycle events.
 *
 * Events we care about:
 *   subscription.authenticated  - mandate set up, trial begins
 *   subscription.activated      - first real charge succeeded (trial ended)
 *   subscription.charged        - any successful recurring charge
 *   subscription.completed      - all billing cycles complete
 *   subscription.cancelled      - user or admin cancelled
 *   subscription.halted         - too many failed retries, customer must update
 *   subscription.paused / resumed
 *
 * Setup:
 *   Razorpay Dashboard → Settings → Webhooks → Add new webhook
 *     URL:    https://app.slateup.ai/api/razorpay/webhook
 *     Events: all subscription.* events
 *     Secret: copy into RAZORPAY_WEBHOOK_SECRET
 *
 * Docs: https://razorpay.com/docs/webhooks/
 */

interface RazorpaySubscriptionEntity {
  id: string;
  status: string;
  plan_id: string;
  current_start: number | null;
  current_end: number | null;
  charge_at: number | null;
  notes: Record<string, string> | null;
}

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    subscription?: { entity: RazorpaySubscriptionEntity };
    payment?: { entity: { id: string; amount: number } };
  };
}

// Razorpay status → our subscription_status text column
function mapStatus(rzpStatus: string): string {
  switch (rzpStatus) {
    case 'authenticated':
      return 'trialing';
    case 'active':
      return 'active';
    case 'paused':
      return 'paused';
    case 'halted':
      return 'past_due';
    case 'cancelled':
      return 'canceled';
    case 'completed':
      return 'completed';
    case 'expired':
      return 'expired';
    default:
      return rzpStatus;
  }
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[razorpay/webhook] RAZORPAY_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';

  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    console.warn('[razorpay/webhook] signature mismatch');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = payload.event;
  const subscription = payload.payload.subscription?.entity;

  if (!subscription) {
    // We only handle subscription.* events. Ignore everything else with 200.
    return NextResponse.json({ received: true, ignored: true });
  }

  const supabaseUserId = subscription.notes?.supabase_user_id;
  if (!supabaseUserId) {
    console.warn('[razorpay/webhook] subscription has no supabase_user_id note', subscription.id);
    return NextResponse.json({ received: true, ignored: true });
  }

  const admin = createAdminClient();

  const status = mapStatus(subscription.status);

  // Map event → side effects
  switch (event) {
    case 'subscription.authenticated':
    case 'subscription.activated':
    case 'subscription.charged':
    case 'subscription.resumed': {
      const isPaid = event === 'subscription.charged' || event === 'subscription.activated';
      const updates: Record<string, unknown> = {
        user_id: supabaseUserId,
        razorpay_subscription_id: subscription.id,
        razorpay_plan_id: subscription.plan_id,
        subscription_status: isPaid ? 'active' : status,
      };
      if (isPaid) {
        updates.account_type = 'PLUS';
      }
      if (subscription.current_end) {
        updates.current_period_end = new Date(subscription.current_end * 1000).toISOString();
      }
      await admin.from('user_plans').upsert(updates, { onConflict: 'user_id' });
      break;
    }

    case 'subscription.cancelled':
    case 'subscription.halted':
    case 'subscription.paused':
    case 'subscription.completed':
    case 'subscription.expired': {
      // Keep account_type at PLUS until current_period_end so the user gets
      // what they paid for. The increment_course_credit() function already
      // gates on subscription_status, so dropping status to canceled stops
      // future course generations once the current period is up.
      await admin
        .from('user_plans')
        .update({
          subscription_status: status,
          ...(subscription.current_end && {
            current_period_end: new Date(subscription.current_end * 1000).toISOString(),
          }),
        })
        .eq('razorpay_subscription_id', subscription.id);
      break;
    }

    default:
      // Other events (subscription.updated, etc.) — just log status change.
      await admin
        .from('user_plans')
        .update({ subscription_status: status })
        .eq('razorpay_subscription_id', subscription.id);
  }

  getPostHogClient().capture({
    distinctId: supabaseUserId,
    event: `razorpay_${event.replace(/\./g, '_')}`,
    properties: {
      subscription_id: subscription.id,
      plan_id: subscription.plan_id,
      status: subscription.status,
    },
  });

  return NextResponse.json({ received: true });
}
