import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/utils/supabase/admin';
import { TOPUP_COURSES_AMOUNT } from '@/lib/stripe/plans';
import type Stripe from 'stripe';
import { getPostHogClient } from '@/lib/posthog-server';

export const runtime = 'nodejs';

/**
 * POST /api/stripe/webhook
 * Receives Stripe events and keeps user_plans in sync.
 *
 * Required env vars:
 *   STRIPE_WEBHOOK_SECRET  — from `stripe listen --forward-to ...` or the Stripe dashboard
 */
export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: 'Missing stripe-signature or webhook secret' },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.arrayBuffer();
    event = stripe.webhooks.constructEvent(Buffer.from(rawBody), sig, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stripe/webhook] signature verification failed:', msg);
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      // ── Checkout completed ───────────────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const period = session.metadata?.period as SubscriptionPeriodWebhook | undefined;
        const type = session.metadata?.type;

        if (!userId) break;

        // ── Course top-up (one-time, +10 courses) ──────────────────────────
        if (type === 'topup') {
          if (session.payment_intent) {
            const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
            if (pi.status !== 'succeeded') {
              console.warn(
                `[stripe/webhook] topup payment_intent not succeeded (${pi.status}) for user ${userId}`,
              );
              break;
            }
          }

          const { data: currentPlan } = await admin
            .from('user_plans')
            .select('extra_credits')
            .eq('user_id', userId)
            .single();

          if (currentPlan) {
            const newExtra = (currentPlan.extra_credits || 0) + TOPUP_COURSES_AMOUNT;
            await admin
              .from('user_plans')
              .update({ extra_credits: newExtra })
              .eq('user_id', userId);
          }
          getPostHogClient().capture({
            distinctId: userId,
            event: 'topup_completed',
            properties: { credits_added: TOPUP_COURSES_AMOUNT },
          });
          console.log(
            `[stripe/webhook] topup applied for user ${userId} (+${TOPUP_COURSES_AMOUNT} extra_credits)`,
          );
          break;
        }

        if (!period) break;

        // Subscription checkout completed
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          const resolvedPeriod =
            (sub.metadata?.period as SubscriptionPeriodWebhook | undefined) ?? period;
          await upsertSubscription(admin, userId, sub, resolvedPeriod as SubscriptionPeriodWebhook);
        }
        break;
      }

      // ── Subscription lifecycle ───────────────────────────────────────────────
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_user_id;
        const period = sub.metadata?.period as SubscriptionPeriodWebhook | undefined;
        if (!userId) break;

        // Re-retrieve the subscription so we have the latest state (avoids stale webhook payloads)
        const freshSub = await stripe.subscriptions.retrieve(sub.id);
        await upsertSubscription(admin, userId, freshSub, period);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;

        await admin.from('user_plans').upsert(
          {
            user_id: userId,
            account_type: 'FREE',
            subscription_status: 'canceled',
            subscription_period: null,
            stripe_subscription_id: sub.id,
            current_period_end: null,
          },
          { onConflict: 'user_id' },
        );
        getPostHogClient().capture({
          distinctId: userId,
          event: 'subscription_cancelled',
          properties: { subscription_id: sub.id },
        });
        break;
      }

      // ── Invoice events ───────────────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.parent?.subscription_details?.subscription;
        const subId = typeof subRef === 'string' ? subRef : subRef?.id;
        if (!subId) break;

        await admin
          .from('user_plans')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_subscription_id', subId);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.parent?.subscription_details?.subscription;
        const subId = typeof subRef === 'string' ? subRef : subRef?.id;
        if (!subId) break;

        // Retrieve fresh subscription to sync the latest billing state
        try {
          const sub = await stripe.subscriptions.retrieve(subId);
          const itemPeriodEnd = sub.items.data[0]?.current_period_end ?? null;
          const periodEnd = itemPeriodEnd ? new Date(itemPeriodEnd * 1000).toISOString() : null;
          const isActive = ['active', 'trialing'].includes(sub.status);

          await admin
            .from('user_plans')
            .update({
              subscription_status: isActive ? 'active' : sub.status,
              account_type: isActive ? 'PLUS' : 'FREE',
              current_period_end: periodEnd,
              courses_generated_month: 0,
              courses_month_reset_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subId);
        } catch (subErr) {
          await admin
            .from('user_plans')
            .update({
              subscription_status: 'active',
              courses_generated_month: 0,
              courses_month_reset_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subId);
          console.error('[stripe/webhook] invoice.paid sub fetch failed:', subErr);
        }
        break;
      }

      // ── Payment intent (one-time payments completed outside Checkout) ────────
      case 'payment_intent.succeeded': {
        // Handled via checkout.session.completed; this is a safety net for
        // direct PaymentIntent flows if ever used.
        break;
      }

      default:
        break;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[stripe/webhook] handler error for ${event.type}:`, msg);
    // Return 200 so Stripe doesn't retry transient errors
  }

  return NextResponse.json({ received: true });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type SubscriptionPeriodWebhook = 'monthly' | 'yearly';

async function upsertSubscription(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  sub: Stripe.Subscription,
  period?: SubscriptionPeriodWebhook,
) {
  const firstItem = sub.items.data[0];
  const priceId = firstItem?.price?.id ?? null;
  const isActive = ['active', 'trialing'].includes(sub.status);
  const accountType = isActive ? 'PLUS' : 'FREE';

  // In Stripe v22 (API version dahlia), current_period_end lives on the
  // subscription item, not on the subscription object itself.
  const itemPeriodEnd = firstItem?.current_period_end ?? null;
  const periodEnd = itemPeriodEnd ? new Date(itemPeriodEnd * 1000).toISOString() : null;

  await admin.from('user_plans').upsert(
    {
      user_id: userId,
      account_type: accountType,
      stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      subscription_status: sub.status,
      subscription_period: period ?? null,
      current_period_end: periodEnd,
    },
    { onConflict: 'user_id' },
  );

  if (isActive) {
    getPostHogClient().capture({
      distinctId: userId,
      event: 'subscription_activated',
      properties: { plan_period: period ?? null, subscription_id: sub.id },
    });
  }
}
