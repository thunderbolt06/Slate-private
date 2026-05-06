import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRequestUser } from '@/utils/supabase/auth-bridge';
import { TOPUP_COURSES_AMOUNT } from '@/lib/stripe/plans';
import { RAZORPAY_PLANS, TRIAL_DAYS, type RazorpayPlanId } from '@/lib/razorpay/client';
import { getPostHogClient } from '@/lib/posthog-server';

/**
 * POST /api/razorpay/verify-payment
 *
 * Verifies a Razorpay client-side success payload. Handles two flows:
 *
 * 1. One-time orders (topup) - signature is `order_id|payment_id`.
 * 2. Subscriptions (monthly/yearly) - signature is `payment_id|subscription_id`.
 *
 * Body shape A (order):
 *   { razorpay_payment_id, razorpay_order_id, razorpay_signature, period: 'topup' }
 *
 * Body shape B (subscription):
 *   { razorpay_payment_id, razorpay_subscription_id, razorpay_signature,
 *     period: 'monthly' | 'yearly' }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as {
      razorpay_payment_id: string;
      razorpay_order_id?: string;
      razorpay_subscription_id?: string;
      razorpay_signature: string;
      period: RazorpayPlanId | 'monthly' | 'yearly';
    };

    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_subscription_id,
      razorpay_signature,
      period,
    } = body;

    if (!razorpay_payment_id || !razorpay_signature || !period) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const isSubscription = period === 'monthly' || period === 'yearly';

    // ── Signature verification ────────────────────────────────────────────────
    // Subscription:  payment_id | subscription_id
    // Order (topup): order_id   | payment_id
    let signaturePayload: string;
    if (isSubscription) {
      if (!razorpay_subscription_id) {
        return NextResponse.json(
          { error: 'razorpay_subscription_id is required for subscriptions' },
          { status: 400 },
        );
      }
      signaturePayload = `${razorpay_payment_id}|${razorpay_subscription_id}`;
    } else {
      if (!razorpay_order_id) {
        return NextResponse.json(
          { error: 'razorpay_order_id is required for one-time payments' },
          { status: 400 },
        );
      }
      if (!RAZORPAY_PLANS[period as RazorpayPlanId]) {
        return NextResponse.json({ error: 'Invalid plan period' }, { status: 400 });
      }
      signaturePayload = `${razorpay_order_id}|${razorpay_payment_id}`;
    }

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(signaturePayload)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.warn('[razorpay/verify-payment] signature mismatch for user', user.id);
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }

    const admin = createAdminClient();

    // ── Topup (one-time) ──────────────────────────────────────────────────────
    if (period === 'topup') {
      const { data: currentPlan } = await admin
        .from('user_plans')
        .select('extra_credits')
        .eq('user_id', user.id)
        .single();

      const newExtra = (currentPlan?.extra_credits ?? 0) + TOPUP_COURSES_AMOUNT;
      await admin
        .from('user_plans')
        .upsert({ user_id: user.id, extra_credits: newExtra }, { onConflict: 'user_id' });

      getPostHogClient().capture({
        distinctId: user.id,
        event: 'razorpay_topup_completed',
        properties: { credits_added: TOPUP_COURSES_AMOUNT, payment_id: razorpay_payment_id },
      });

      return NextResponse.json({ success: true, type: 'topup' });
    }

    // ── Subscription with trial ───────────────────────────────────────────────
    // The signature only proves the user authorized the mandate. The first
    // real charge happens at start_at (trial end). We mark account as PLUS
    // with status 'trialing' until the webhook reports subscription.charged.
    const accountType = 'PLUS' as const;
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    await admin.from('user_plans').upsert(
      {
        user_id: user.id,
        account_type: accountType,
        subscription_status: 'trialing',
        subscription_period: period,
        razorpay_subscription_id: razorpay_subscription_id ?? null,
        trial_ends_at: trialEndsAt.toISOString(),
      },
      { onConflict: 'user_id' },
    );

    getPostHogClient().capture({
      distinctId: user.id,
      event: 'razorpay_subscription_authorized',
      properties: {
        plan_period: period,
        payment_id: razorpay_payment_id,
        subscription_id: razorpay_subscription_id,
        account_type: accountType,
        trial_days: TRIAL_DAYS,
      },
    });

    return NextResponse.json({
      success: true,
      type: 'subscription',
      account_type: accountType,
      trial_ends_at: trialEndsAt.toISOString(),
    });
  } catch (err: unknown) {
    console.error('[razorpay/verify-payment] error:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
