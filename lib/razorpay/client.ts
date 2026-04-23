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
 * yearly   $192 → ₹16,299 (1629900 paise) — billed annually
 * topup    $5   → ₹499    (49900 paise)
 */
export const RAZORPAY_PLANS = {
  monthly: { amount: 169900,  currency: 'INR', description: 'Slate Plus — Monthly' },
  yearly:  { amount: 1629900, currency: 'INR', description: 'Slate Plus — Yearly' },
  topup:   { amount: 49900,   currency: 'INR', description: 'Slate Course Top-Up (+10)' },
} as const;

export type RazorpayPlanId = keyof typeof RAZORPAY_PLANS;
