import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/utils/supabase/auth-bridge';
import {
  getRazorpayClient,
  getSubscriptionPlanId,
  RAZORPAY_SUBSCRIPTION_PLANS,
  TRIAL_DAYS,
  type RazorpaySubscriptionPeriod,
} from '@/lib/razorpay/client';
import { createAdminClient } from '@/utils/supabase/admin';
import { getPostHogClient } from '@/lib/posthog-server';

/**
 * POST /api/razorpay/create-subscription
 *
 * Creates a Razorpay subscription with a 7-day free trial. The trial is
 * implemented by setting `start_at` to (now + 7 days), so the customer
 * authorizes the mandate immediately but is not charged until the trial ends.
 *
 * Body: { period: 'monthly' | 'yearly' }
 * Returns: { subscription_id, key_id, plan_id, trial_ends_at }
 *
 * Docs: https://razorpay.com/docs/api/payments/subscriptions/create-subscription
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { period } = (await req.json()) as { period: RazorpaySubscriptionPeriod };

    if (!RAZORPAY_SUBSCRIPTION_PLANS[period]) {
      return NextResponse.json(
        { error: 'Invalid plan period - must be "monthly" or "yearly"' },
        { status: 400 },
      );
    }

    const planId = getSubscriptionPlanId(period);
    const planCfg = RAZORPAY_SUBSCRIPTION_PLANS[period];

    // start_at delays the first charge by TRIAL_DAYS days. Razorpay sets up
    // the mandate immediately on authorization, but no money is debited until
    // start_at. This is the recommended way to offer a free trial.
    const trialEndsAtSec = Math.floor(Date.now() / 1000) + TRIAL_DAYS * 24 * 60 * 60;

    // total_count = number of billing cycles after the trial. We pick a high
    // value so the subscription effectively renews until the user cancels.
    // Monthly: 120 cycles = 10 years. Yearly: 10 cycles = 10 years.
    const totalCount = period === 'monthly' ? 120 : 10;

    const razorpay = getRazorpayClient();

    // Avoid duplicate active subscriptions for a single user
    const admin = createAdminClient();
    const { data: existingPlan } = await admin
      .from('user_plans')
      .select('razorpay_subscription_id, subscription_status')
      .eq('user_id', user.id)
      .single();

    if (
      existingPlan?.razorpay_subscription_id &&
      existingPlan.subscription_status &&
      ['active', 'authenticated', 'trial'].includes(existingPlan.subscription_status)
    ) {
      return NextResponse.json(
        {
          error: 'You already have an active subscription. Please cancel it before subscribing again.',
        },
        { status: 409 },
      );
    }

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: totalCount,
      quantity: 1,
      start_at: trialEndsAtSec,
      customer_notify: 1,
      notes: {
        supabase_user_id: user.id,
        plan_period: period,
        user_email: user.email ?? '',
        trial_days: String(TRIAL_DAYS),
      },
    });

    // Store subscription_id immediately so we can correlate webhook events
    // even if the user never returns to the success page.
    await admin.from('user_plans').upsert(
      {
        user_id: user.id,
        razorpay_subscription_id: subscription.id,
        subscription_status: 'created',
        subscription_period: period,
      },
      { onConflict: 'user_id' },
    );

    getPostHogClient().capture({
      distinctId: user.id,
      event: 'razorpay_subscription_created',
      properties: {
        plan_period: period,
        subscription_id: subscription.id,
        plan_id: planId,
        trial_days: TRIAL_DAYS,
      },
    });

    return NextResponse.json({
      subscription_id: subscription.id,
      key_id: process.env.RAZORPAY_KEY_ID,
      plan_id: planId,
      trial_ends_at: trialEndsAtSec,
      amount: planCfg.amount,
      currency: planCfg.currency,
      name: planCfg.name,
    });
  } catch (err: unknown) {
    console.error('[razorpay/create-subscription] error:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
