import Razorpay from 'razorpay';

export function getRazorpay(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId) {
    throw new Error('RAZORPAY_KEY_ID environment variable is not set');
  }
  if (!keySecret) {
    throw new Error('RAZORPAY_KEY_SECRET environment variable is not set');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

/** INR pricing in paise (1 INR = 100 paise) */
export const RAZORPAY_PLANS = {
  monthly:       { amount: 169900,   currency: 'INR', description: 'Slate Plus — Monthly' },
  yearly:        { amount: 1599900,  currency: 'INR', description: 'Slate Plus — Yearly' },
  ultra_monthly: { amount: 1699900,  currency: 'INR', description: 'Slate Ultra — Monthly' },
  ultra_yearly:  { amount: 14999900, currency: 'INR', description: 'Slate Ultra — Yearly' },
  topup:         { amount: 49900,    currency: 'INR', description: 'Slate Course Top-Up (+10)' },
} as const;

export type RazorpayPlanId = keyof typeof RAZORPAY_PLANS;
