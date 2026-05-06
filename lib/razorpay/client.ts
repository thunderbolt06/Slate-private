import Razorpay from 'razorpay';

let _razorpay: Razorpay | null = null;

export function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId) throw new Error('RAZORPAY_KEY_ID environment variable is not set');
  if (!keySecret) throw new Error('RAZORPAY_KEY_SECRET environment variable is not set');

  if (!_razorpay) {
    _razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return _razorpay;
}

/**
 * INR pricing in paise (1 INR = 100 paise). Approximate rate: $1 ≈ ₹85.
 *
 * monthly  $20  → ₹1,699  (169900 paise)
 * yearly   $192 → ₹16,299 (1629900 paise) - billed annually
 * topup    $5   → ₹499    (49900 paise)
 */
export const RAZORPAY_PLANS = {
  monthly: { amount: 169900,  currency: 'INR', description: 'Slate Plus - Monthly' },
  yearly:  { amount: 1629900, currency: 'INR', description: 'Slate Plus - Yearly' },
  topup:   { amount: 49900,   currency: 'INR', description: 'Slate Course Top-Up (+10)' },
} as const;

export type RazorpayPlanId = keyof typeof RAZORPAY_PLANS;

/**
 * Subscription plan config. These plans are recurring and need to be created
 * once on Razorpay (via the dashboard or scripts/setup-razorpay-plans.ts) and
 * the resulting plan IDs added to env vars below.
 *
 * Trial: 7 days. Implemented via `start_at = now + 7 days` on subscription
 * creation, so the customer's first charge happens 7 days after authorization.
 */
export const RAZORPAY_SUBSCRIPTION_PLANS = {
  monthly: {
    interval: 1,
    period: 'monthly' as const,
    amount: 169900,
    currency: 'INR',
    name: 'Slate Plus - Monthly',
    envKey: 'RAZORPAY_PLAN_MONTHLY_ID',
  },
  yearly: {
    interval: 1,
    period: 'yearly' as const,
    amount: 1629900,
    currency: 'INR',
    name: 'Slate Plus - Yearly',
    envKey: 'RAZORPAY_PLAN_YEARLY_ID',
  },
} as const;

export type RazorpaySubscriptionPeriod = keyof typeof RAZORPAY_SUBSCRIPTION_PLANS;

export const TRIAL_DAYS = 7;

export function getSubscriptionPlanId(period: RazorpaySubscriptionPeriod): string {
  const cfg = RAZORPAY_SUBSCRIPTION_PLANS[period];
  const planId = process.env[cfg.envKey];
  if (!planId) {
    throw new Error(
      `${cfg.envKey} is not set. Run \`pnpm tsx scripts/setup-razorpay-plans.ts\` or create the plan on the Razorpay dashboard and add the plan_id to your env.`,
    );
  }
  return planId;
}
