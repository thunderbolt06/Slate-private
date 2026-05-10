// Google Ads conversion helpers (client-side).
// Conversion labels are wired through env so the labels from Google Ads
// can be set per-environment without redeploying app code.

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
    dataLayer?: unknown[];
  }
}

export const GADS_ID = process.env.NEXT_PUBLIC_GADS_ID || 'AW-18072518513';

const LABELS = {
  signup: process.env.NEXT_PUBLIC_GADS_SIGNUP_LABEL || '',
  trial: process.env.NEXT_PUBLIC_GADS_TRIAL_LABEL || '',
  subPro: process.env.NEXT_PUBLIC_GADS_SUBPRO_LABEL || '',
} as const;

function sendTo(label: string): string | null {
  if (!label) return null;
  return `${GADS_ID}/${label}`;
}

function gtag(...args: unknown[]): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag(...args);
}

export function setUserData(data: { email?: string | null; phone?: string | null }) {
  const email = data.email?.trim().toLowerCase();
  const phone = data.phone?.trim();
  if (!email && !phone) return;
  gtag('set', 'user_data', {
    ...(email ? { email } : {}),
    ...(phone ? { phone_number: phone } : {}),
  });
}

export function trackSignup(opts: { method?: 'email' | 'google' } = {}) {
  const to = sendTo(LABELS.signup);
  if (to) {
    gtag('event', 'conversion', { send_to: to, value: 1.0, currency: 'USD' });
  }
  gtag('event', 'sign_up', { method: opts.method || 'email' });
}

export function trackTrialStart(opts: { value?: number; currency?: string } = {}) {
  const value = opts.value ?? 10.0;
  const currency = opts.currency ?? 'USD';
  const to = sendTo(LABELS.trial);
  if (to) {
    gtag('event', 'conversion', { send_to: to, value, currency });
  }
  gtag('event', 'begin_checkout', { currency, value });
}

export function trackSubscriptionPro(opts: {
  value: number;
  currency: string;
  transactionId: string;
}) {
  const to = sendTo(LABELS.subPro);
  if (to) {
    gtag('event', 'conversion', {
      send_to: to,
      value: opts.value,
      currency: opts.currency,
      transaction_id: opts.transactionId,
    });
  }
  gtag('event', 'purchase', {
    currency: opts.currency,
    value: opts.value,
    transaction_id: opts.transactionId,
  });
}
