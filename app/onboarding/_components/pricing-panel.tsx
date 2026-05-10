'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import {
  INK,
  RED,
  YELLOW,
  GREEN,
  BLUE,
  FREDOKA,
  NUNITO,
} from '../_lib/tokens';
import type { PaymentProviderResponse } from '@/app/api/payment/provider/route';
import type { RazorpayPlanId } from '@/lib/razorpay/client';
import { trackTrialStart } from '@/lib/gtag';

type CheckoutPeriod = 'monthly' | 'yearly';
type RazorpayCtor = new (opts: Record<string, unknown>) => {
  open(): void;
  on(e: string, h: (r: { error: { description: string } }) => void): void;
};

function errMsg(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong';
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as unknown as { Razorpay?: unknown }).Razorpay)
      return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const INR_PRICES = {
  monthly: '₹1,699',
  yearly: '₹1,359',
  yearlyBilled: 'Billed ₹16,299/yr, save ₹4,089',
  yearlyBadge: 'Save ₹4,089/yr',
};

const FREE_FEATURES = [
  '2 classroom credits, forever',
  'Professor Sage only',
  'Up to 10-min lessons',
  'Classroom chat + quizzes',
];

const PRO_FEATURES = [
  '30 classroom credits / month',
  'All 4 Mates',
  'Full-length lessons (up to 45 min)',
  'Instant Classroom, no wait',
  'Import from PDF, YouTube, URL',
  'Progress analytics + streaks',
  'Priority generation queue',
];

const ENT_FEATURES = [
  'Team seats + admin console',
  'Custom course libraries',
  'SSO / SAML + audit logs',
  'Learner analytics dashboards',
  'Co-branded certificates',
  'Dedicated success manager',
];

const FAQS = [
  {
    q: 'Will I be charged today?',
    a: "No, your 7-day trial is free. We'll email you 2 days before the trial ends so nothing surprises you.",
  },
  {
    q: 'Can I switch plans later?',
    a: 'Yes. Upgrade, downgrade, or cancel anytime from your account settings.',
  },
  {
    q: "What counts as a 'course credit'?",
    a: "One fully-generated course with slides, narration, chat, and quizzes. You can replay courses as many times as you want, replays don't cost credits.",
  },
  {
    q: 'What happens when I run out of credits?',
    a: "You can top up anytime. Top-ups add 10 Standard Classroom credits, work on any plan, and never expire once purchased.",
  },
];

export function PricingPanel({ onFreeContinue }: { onFreeContinue?: () => void }) {
  const [billingCycle, setBillingCycle] = useState<CheckoutPeriod>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const [provider, setProvider] = useState<PaymentProviderResponse | null>(null);

  useEffect(() => {
    fetch('/api/payment/provider')
      .then((r) => r.json())
      .then((d: PaymentProviderResponse) => setProvider(d))
      .catch(() =>
        setProvider({ provider: 'stripe', countryCode: 'XX', countryName: 'Unknown' }),
      );
  }, []);

  const isIndia = provider?.provider === 'razorpay';
  const monthlyPrice = isIndia ? INR_PRICES.monthly : '$19';
  const yearlyPrice = isIndia ? INR_PRICES.yearly : '$15';
  const yearlyBilled = isIndia ? INR_PRICES.yearlyBilled : 'Billed $180/yr, save $48';
  const yearlyBadge = isIndia ? INR_PRICES.yearlyBadge : 'Save $48/yr';

  const handleCheckout = async (period: CheckoutPeriod) => {
    setLoading(period);
    const prov = provider?.provider ?? 'stripe';
    posthog.capture('checkout_initiated', { plan_period: period, provider: prov });

    // Google Ads: Trial_Start fires when the user kicks off the 7-day trial.
    // Value is approximate (1-month equivalent); Ads uses this as the trial signal.
    const isINR = prov === 'razorpay';
    const trialValue = isINR
      ? (period === 'yearly' ? 1359 : 1699)
      : (period === 'yearly' ? 15 : 19);
    trackTrialStart({ value: trialValue, currency: isINR ? 'INR' : 'USD' });

    try {
      if (prov === 'razorpay') {
        const ok = await loadRazorpayScript();
        if (!ok) {
          toast.error('Failed to load payment gateway. Please try again.');
          setLoading(null);
          return;
        }
        // Monthly/yearly are subscriptions with a 7-day free trial.
        const subRes = await fetch('/api/razorpay/create-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ period: period as RazorpayPlanId }),
        });
        const subData = await subRes.json();
        if (!subRes.ok) throw new Error(subData.error || 'Failed to start subscription');

        const Razorpay = (window as unknown as { Razorpay: RazorpayCtor }).Razorpay;
        const rzp = new Razorpay({
          key: subData.key_id,
          subscription_id: subData.subscription_id,
          name: 'Slate',
          description: `Slate ${period} plan, 7-day free trial`,
          theme: { color: INK },
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_subscription_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const verifyRes = await fetch('/api/razorpay/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...response, period }),
              });
              const v = await verifyRes.json();
              if (!verifyRes.ok) throw new Error(v.error || 'Payment verification failed');
              window.location.href = `/pricing?success=true&period=${period}&trial=true`;
            } catch (err) {
              toast.error(errMsg(err));
            } finally {
              setLoading(null);
            }
          },
          modal: {
            ondismiss: () => {
              toast.info('Checkout cancelled. No charge was made.');
              setLoading(null);
            },
          },
        });
        rzp.on('payment.failed', (r: { error: { description: string } }) => {
          toast.error(r.error.description || 'Payment failed');
          setLoading(null);
        });
        rzp.open();
        return;
      }

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Checkout failed');
      if (json.url) window.location.href = json.url;
    } catch (err) {
      toast.error(errMsg(err));
      setLoading(null);
    }
  };

  const contactSales = () => {
    window.location.href =
      'mailto:sales@slate.app?subject=Slate%20Enterprise%20inquiry&body=Hi%20Slate%20team%2C%20we%27d%20like%20to%20learn%20more%20about%20Enterprise.';
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', color: INK }}>
      {/* Provider badge */}
      {provider && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <span
            style={{
              fontFamily: FREDOKA,
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#6B7B85',
              background: '#fff',
              border: `2px solid ${INK}20`,
              borderRadius: 999,
              padding: '5px 14px',
            }}
          >
            {provider.provider === 'razorpay'
              ? '🇮🇳 Paying in INR · Razorpay'
              : '💳 Paying in USD · Stripe'}
          </span>
        </div>
      )}

      {/* Billing toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
        <div
          style={{
            display: 'inline-flex',
            gap: 4,
            padding: 4,
            background: '#fff',
            border: `3px solid ${INK}`,
            borderRadius: 999,
            boxShadow: `4px 4px 0 ${INK}`,
          }}
        >
          {(['monthly', 'yearly'] as const).map((c) => {
            const active = billingCycle === c;
            return (
              <button
                key={c}
                onClick={() => setBillingCycle(c)}
                style={{
                  padding: '8px 20px',
                  borderRadius: 999,
                  border: 0,
                  cursor: 'pointer',
                  fontFamily: FREDOKA,
                  fontWeight: 700,
                  fontSize: 14,
                  background: active ? INK : 'transparent',
                  color: active ? '#fff' : INK,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {c === 'monthly' ? 'Monthly' : 'Yearly'}
                {c === 'yearly' && (
                  <span
                    style={{
                      fontSize: 9,
                      background: GREEN,
                      color: INK,
                      padding: '2px 8px',
                      borderRadius: 999,
                      letterSpacing: '0.08em',
                    }}
                  >
                    SAVE UP TO 25%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3-column plan grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: 20,
          alignItems: 'stretch',
        }}
      >
        {/* FREE */}
        <div style={planCardStyle()}>
          <Eyebrow color="#6B7B85">Free forever</Eyebrow>
          <PlanTitle>Starter</PlanTitle>
          <PriceBlock value={isIndia ? '₹0' : '$0'} sub="forever" />
          <PlanTagline>Dip a toe in. No card needed.</PlanTagline>
          <FeatureList items={FREE_FEATURES} />
          <div style={{ marginTop: 'auto', paddingTop: 18 }}>
            {onFreeContinue ? (
              <BigBtn variant="white" onClick={onFreeContinue}>
                Continue on Free
              </BigBtn>
            ) : (
              <div
                style={{
                  fontFamily: FREDOKA,
                  fontWeight: 700,
                  fontSize: 13,
                  padding: '12px 20px',
                  borderRadius: 16,
                  border: `3px solid ${INK}10`,
                  background: '#F0F4F8',
                  color: '#6B7B85',
                  textAlign: 'center',
                }}
              >
                Your current plan
              </div>
            )}
            <p style={footNote()}>No card. No catch. Upgrade whenever.</p>
          </div>
        </div>

        {/* PRO – highlighted */}
        <div style={planCardStyle({ highlighted: true })}>
          <div
            style={{
              position: 'absolute',
              top: -14,
              right: 20,
              background: RED,
              color: '#fff',
              fontFamily: FREDOKA,
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: '0.12em',
              padding: '5px 12px',
              borderRadius: 999,
              border: `2px solid ${INK}`,
              boxShadow: `2px 2px 0 ${INK}`,
            }}
          >
            {billingCycle === 'yearly' ? yearlyBadge : 'MOST POPULAR'}
          </div>
          <Eyebrow color={RED}>Pro · {billingCycle === 'monthly' ? 'Monthly' : 'Yearly'}</Eyebrow>
          <PlanTitle>Slate Pro</PlanTitle>
          {billingCycle === 'monthly' ? (
            <PriceBlock value={monthlyPrice} sub="/ month" />
          ) : (
            <>
              <PriceBlock value={yearlyPrice} sub="/ month" />
              <div
                style={{
                  fontFamily: NUNITO,
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#05A37A',
                  marginTop: -10,
                  marginBottom: 4,
                }}
              >
                {yearlyBilled}
              </div>
            </>
          )}
          <PlanTagline>Everything to actually build momentum.</PlanTagline>

          {/* Promo banner
          <div
            style={{
              background: YELLOW,
              border: `2.5px solid ${INK}`,
              borderRadius: 14,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: `3px 3px 0 ${INK}`,
            }}
          >
            <span style={{ fontSize: 22 }}>🎁</span>
            <div>
              <div style={{ fontFamily: FREDOKA, fontWeight: 700, fontSize: 13, color: INK }}>
                50% off your first month
              </div>
              <div style={{ fontFamily: NUNITO, fontWeight: 700, fontSize: 12, color: INK }}>
                just {isIndia ? '₹849' : '$10'} to start
              </div>
            </div>
          </div> */}

          <FeatureList items={PRO_FEATURES} tick={RED} />

          <div style={{ marginTop: 'auto', paddingTop: 18 }}>
            <BigBtn
              id="pro-trial-cta"
              variant="primary"
              onClick={() => handleCheckout(billingCycle)}
              disabled={!!loading}
            >
              {loading === billingCycle ? 'Redirecting...' : 'Start 7-day free trial →'}
            </BigBtn>
            <p style={footNote()}>
              Card required. We&apos;ll remind you 2 days before charge.
            </p>
          </div>
        </div>

        {/* ENTERPRISE – dark */}
        <div
          style={{
            ...planCardStyle(),
            background: '#0F1B24',
            borderColor: INK,
            color: '#fff',
          }}
        >
          <Eyebrow color="#FFD66B">Enterprise</Eyebrow>
          <PlanTitle color="#fff">Custom</PlanTitle>
          <div
            style={{
              fontFamily: NUNITO,
              fontSize: 13,
              fontWeight: 700,
              color: '#B7C4CD',
              marginTop: -6,
            }}
          >
            Volume pricing · annual agreements
          </div>
          <PlanTagline color="#D9E2E8">
            For schools, bootcamps, and teams learning together.
          </PlanTagline>
          <FeatureList items={ENT_FEATURES} dark tick={YELLOW} />
          <div style={{ marginTop: 'auto', paddingTop: 18 }}>
            <button
              onClick={contactSales}
              style={{
                width: '100%',
                fontFamily: FREDOKA,
                fontWeight: 700,
                fontSize: 16,
                padding: '14px 22px',
                borderRadius: 16,
                border: `3px solid ${INK}`,
                boxShadow: `4px 4px 0 #000`,
                background: YELLOW,
                color: INK,
                cursor: 'pointer',
              }}
            >
              Contact sales →
            </button>
            <p style={{ ...footNote(), color: '#B7C4CD' }}>
              Talk to our team · typically replies same day.
            </p>
          </div>
        </div>
      </div>

      {/* Trust strip */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 24,
          flexWrap: 'wrap',
          marginTop: 28,
          fontFamily: NUNITO,
          fontSize: 12,
          fontWeight: 700,
          color: '#6B7B85',
        }}
      >
        <span>✓ Cancel anytime</span>
        <span>✓ Secure checkout</span>
        <span>✓ No hidden fees</span>
      </div>

      {/* How credits work */}
      <HowCreditsPanel isIndia={isIndia} />

      {/* FAQ */}
      <div style={{ marginTop: 64 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              fontFamily: FREDOKA,
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: RED,
              marginBottom: 8,
            }}
          >
            Questions?
          </div>
          <h2
            style={{
              fontFamily: FREDOKA,
              fontWeight: 700,
              fontSize: 'clamp(26px, 4vw, 36px)',
              color: INK,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Good, we have answers.
          </h2>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 14,
            maxWidth: 880,
            margin: '0 auto',
          }}
        >
          {FAQS.map((f) => (
            <FAQItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── helpers ──

function planCardStyle(opts: { highlighted?: boolean } = {}): React.CSSProperties {
  return {
    position: 'relative',
    background: '#fff',
    border: `3px solid ${INK}`,
    borderRadius: 24,
    padding: '28px 24px 22px',
    boxShadow: opts.highlighted ? `8px 8px 0 ${RED}` : `6px 6px 0 ${INK}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    minHeight: 560,
  };
}

function Eyebrow({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div
      style={{
        fontFamily: FREDOKA,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color,
      }}
    >
      {children}
    </div>
  );
}

function PlanTitle({ children, color = INK }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      style={{
        fontFamily: FREDOKA,
        fontWeight: 700,
        fontSize: 28,
        color,
        lineHeight: 1,
      }}
    >
      {children}
    </div>
  );
}

function PlanTagline({ children, color = '#495057' }: { children: React.ReactNode; color?: string }) {
  return (
    <p
      style={{
        fontFamily: NUNITO,
        fontSize: 14,
        fontWeight: 600,
        color,
        margin: 0,
        lineHeight: 1.4,
      }}
    >
      {children}
    </p>
  );
}

function PriceBlock({ value, sub }: { value: string; sub: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: -4 }}>
      <span style={{ fontFamily: FREDOKA, fontWeight: 700, fontSize: 48, color: INK }}>
        {value}
      </span>
      <span style={{ fontFamily: NUNITO, fontSize: 14, color: '#6B7B85' }}>{sub}</span>
    </div>
  );
}

function FeatureList({
  items,
  dark,
  tick,
}: {
  items: string[];
  dark?: boolean;
  tick?: string;
}) {
  const tickBg = tick ?? GREEN;
  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {items.map((text) => (
        <li
          key={text}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            fontFamily: NUNITO,
            fontSize: 14,
            color: dark ? '#E6EEF3' : '#334750',
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: tickBg,
              border: `2px solid ${dark ? '#000' : INK}`,
              color: dark ? INK : '#fff',
              fontSize: 11,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            ✓
          </span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

function HowCreditsPanel({ isIndia }: { isIndia: boolean }) {
  const topupPrice = isIndia ? '₹499' : '$5';
  return (
    <div
      style={{
        marginTop: 40,
        background: '#fff',
        border: `3px solid ${INK}`,
        borderRadius: 24,
        boxShadow: `6px 6px 0 ${INK}`,
        padding: '22px 26px',
        maxWidth: 880,
        margin: '40px auto 0',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: BLUE,
            color: '#fff',
            border: `2px solid ${INK}`,
            fontFamily: FREDOKA,
            fontWeight: 700,
            fontSize: 14,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          i
        </span>
        <h3
          style={{
            fontFamily: FREDOKA,
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: INK,
            margin: 0,
          }}
        >
          How credits work
        </h3>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 28,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: FREDOKA,
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#6B7B85',
              marginBottom: 6,
            }}
          >
            Free
          </div>
          <p
            style={{
              fontFamily: NUNITO,
              fontSize: 14,
              fontWeight: 600,
              color: '#334750',
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            2 lifetime classroom credits. Once used, top up for {topupPrice} per 10 extra
            classrooms.
          </p>
        </div>
        <div>
          <div
            style={{
              fontFamily: FREDOKA,
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: BLUE,
              marginBottom: 6,
            }}
          >
            Pro
          </div>
          <p
            style={{
              fontFamily: NUNITO,
              fontSize: 14,
              fontWeight: 600,
              color: '#334750',
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            30 classroom credits per month (Standard + Instant), reset on your billing date.
            Unused credits don&apos;t carry over.
          </p>
        </div>
      </div>
      <div
        style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: `2px solid ${INK}15`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontFamily: NUNITO,
          fontSize: 13,
          fontWeight: 600,
          color: '#6B7B85',
          lineHeight: 1.5,
        }}
      >
        <span style={{ fontSize: 14 }}>↻</span>
        <span>
          Top-ups add 10 Standard Classroom credits for {topupPrice} and work on any plan. Credits
          never expire once purchased.
        </span>
      </div>
    </div>
  );
}

function BigBtn({
  children,
  onClick,
  variant = 'primary',
  disabled,
  id,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'white';
  disabled?: boolean;
  id?: string;
}) {
  const bg = variant === 'primary' ? RED : '#fff';
  const color = variant === 'primary' ? '#fff' : INK;
  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        fontFamily: FREDOKA,
        fontWeight: 700,
        fontSize: 16,
        padding: '14px 22px',
        borderRadius: 16,
        border: `3px solid ${INK}`,
        boxShadow: `4px 4px 0 ${INK}`,
        background: bg,
        color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function footNote(): React.CSSProperties {
  return {
    fontFamily: NUNITO,
    fontSize: 11,
    fontWeight: 600,
    color: '#6B7B85',
    textAlign: 'center',
    margin: '10px 0 0',
    lineHeight: 1.4,
  };
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen((v) => !v)}
      style={{
        textAlign: 'left',
        width: '100%',
        background: '#fff',
        border: `2.5px solid ${INK}`,
        borderRadius: 16,
        boxShadow: `4px 4px 0 ${INK}`,
        padding: '16px 18px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: FREDOKA,
            fontWeight: 700,
            fontSize: 15,
            color: INK,
          }}
        >
          {q}
        </span>
        <span
          style={{
            fontFamily: FREDOKA,
            fontWeight: 700,
            fontSize: 18,
            color: INK,
            transition: 'transform .2s ease',
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
        >
          +
        </span>
      </div>
      {open && (
        <p
          style={{
            fontFamily: NUNITO,
            fontSize: 14,
            fontWeight: 500,
            color: '#495057',
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          {a}
        </p>
      )}
    </button>
  );
}
