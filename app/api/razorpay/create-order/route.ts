import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/utils/supabase/auth-bridge';
import { getRazorpayClient, RAZORPAY_PLANS, type RazorpayPlanId } from '@/lib/razorpay/client';

/**
 * POST /api/razorpay/create-order
 * Creates a Razorpay order for the given plan.
 *
 * Body: { period: RazorpayPlanId }
 * Returns: { order_id, amount, currency, key_id }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { period } = (await req.json()) as { period: RazorpayPlanId };

    const plan = RAZORPAY_PLANS[period];
    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan period' }, { status: 400 });
    }

    if (plan.amount < 100) {
      return NextResponse.json({ error: 'Amount must be at least 100 paise' }, { status: 400 });
    }

    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: plan.amount,
      currency: plan.currency,
      receipt: `slate_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: {
        supabase_user_id: user.id,
        plan_period: period,
        user_email: user.email ?? '',
      },
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err: unknown) {
    console.error('[razorpay/create-order] error:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
