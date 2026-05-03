import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRequestUser } from '@/utils/supabase/auth-bridge';
import { TOPUP_COURSES_AMOUNT } from '@/lib/stripe/plans';
import { RAZORPAY_PLANS, type RazorpayPlanId } from '@/lib/razorpay/client';
import { getPostHogClient } from '@/lib/posthog-server';

/**
 * POST /api/razorpay/verify-payment
 * Verifies Razorpay payment signature and updates user plan.
 *
 * Body: { razorpay_payment_id, razorpay_order_id, razorpay_signature, period }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, period } =
      (await req.json()) as {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
        period: RazorpayPlanId;
      };

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !period) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!RAZORPAY_PLANS[period]) {
      return NextResponse.json({ error: 'Invalid plan period' }, { status: 400 });
    }

    // Verify HMAC-SHA256 signature
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.warn('[razorpay/verify-payment] signature mismatch for user', user.id);
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }

    const admin = createAdminClient();

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

    // Subscription plans - all non-topup periods map to PLUS
    const accountType = 'PLUS' as const;
    await admin.from('user_plans').upsert(
      {
        user_id: user.id,
        account_type: accountType,
        subscription_status: 'active',
        subscription_period: period,
      },
      { onConflict: 'user_id' },
    );

    getPostHogClient().capture({
      distinctId: user.id,
      event: 'razorpay_payment_verified',
      properties: { plan_period: period, payment_id: razorpay_payment_id, account_type: accountType },
    });

    return NextResponse.json({ success: true, type: 'subscription', account_type: accountType });
  } catch (err: unknown) {
    console.error('[razorpay/verify-payment] error:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
