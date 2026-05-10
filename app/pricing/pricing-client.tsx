'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UpgradeSuccessModal } from '@/components/billing/upgrade-success-modal';
import { usePlanStore } from '@/lib/store/user-plan';
import type { UserPlan, SubscriptionPeriod } from '@/lib/stripe/plans';
import { PricingPanel } from '@/app/onboarding/_components/pricing-panel';
import { INK, FREDOKA, NUNITO, RED, YELLOW } from '@/app/onboarding/_lib/tokens';
import { OnboardBg } from '@/app/onboarding/_components/primitives';
import { trackSubscriptionPro } from '@/lib/gtag';

export function PricingClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [, setPlan] = useState<UserPlan | null>(null);
  const [successModal, setSuccessModal] = useState<{ open: boolean; period: SubscriptionPeriod }>({
    open: false,
    period: null,
  });

  useEffect(() => {
    const successParam = searchParams.get('success');
    const periodParam = searchParams.get('period') as SubscriptionPeriod | null;
    const topupParam = searchParams.get('topup');

    if (successParam || topupParam === 'success') {
      if (successParam) setSuccessModal({ open: true, period: periodParam ?? 'monthly' });
      else toast.success('10 courses added to your account! Happy learning 🎉');

      // Google Ads: fire Subscription_Pro on successful checkout return.
      // Client-side fallback only — server-side webhook (api/stripe/webhook,
      // api/razorpay/webhook) is the source of truth for revenue.
      if (successParam && !searchParams.get('topup')) {
        const period = periodParam ?? 'monthly';
        const sessionId = searchParams.get('session_id') || searchParams.get('rzp_payment_id');
        fetch('/api/payment/provider')
          .then((r) => r.json())
          .then((prov: { provider?: string }) => {
            const isINR = prov?.provider === 'razorpay';
            const value = isINR
              ? (period === 'yearly' ? 16299 : 1699)
              : (period === 'yearly' ? 180 : 19);
            trackSubscriptionPro({
              value,
              currency: isINR ? 'INR' : 'USD',
              transactionId: sessionId || `client-${period}-${Date.now()}`,
            });
          })
          .catch(() => {});
      }

      let count = 0;
      const interval = setInterval(async () => {
        count++;
        try {
          const res = await fetch('/api/user/plan', { cache: 'no-store' });
          const json = await res.json();
          if (json.success) {
            setPlan(json.plan);
            usePlanStore.getState().refetch();
            const updated = successParam
              ? json.plan.account_type === 'PLUS' || json.plan.subscription_status === 'active'
              : true;
            if (updated || count >= 5) clearInterval(interval);
          }
        } catch {
          /* ignore */
        }
      }, 2000);
      return () => clearInterval(interval);
    }
    if (searchParams.get('canceled')) toast.info('Checkout canceled. No charge was made.');
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/user/plan', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => j.success && setPlan(j.plan))
      .catch(() => {});
  }, []);

  return (
    <>
      <style jsx global>{`
        @keyframes obFloat {
          0%, 100% { transform: translateY(0)    rotate(0deg); }
          50%      { transform: translateY(-14px) rotate(6deg); }
        }
        @keyframes obFloatR {
          0%, 100% { transform: translateY(0)    rotate(0deg); }
          50%      { transform: translateY(-10px) rotate(-8deg); }
        }
      `}</style>

      <UpgradeSuccessModal
        open={successModal.open}
        period={successModal.period}
        onClose={() => setSuccessModal((s) => ({ ...s, open: false }))}
      />

      {/* Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'rgba(253,253,253,0.9)',
          backdropFilter: 'blur(8px)',
          borderBottom: `2px solid ${INK}15`,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={() => router.push('/')}
            style={{
              background: '#fff',
              border: `2.5px solid ${INK}`,
              boxShadow: `3px 3px 0 ${INK}`,
              borderRadius: 999,
              padding: '8px 16px',
              fontFamily: FREDOKA,
              fontWeight: 700,
              fontSize: 14,
              color: INK,
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: FREDOKA,
              fontWeight: 700,
              fontSize: 20,
              color: INK,
            }}
          >
            SLATE
            <span
              style={{
                fontSize: 10,
                color: '#fff',
                background: RED,
                padding: '2px 8px',
                borderRadius: 999,
                border: `1.5px solid ${INK}`,
              }}
            >
              BETA
            </span>
          </div>
          <div style={{ width: 80 }} />
        </div>
      </header>

      <main
        style={{
          minHeight: '100vh',
          background: '#FDFDFD',
          padding: '64px 24px 120px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <OnboardBg variant="warm" />
        <div style={{ maxWidth: 960, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div
              style={{
                fontFamily: FREDOKA,
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: RED,
                marginBottom: 12,
              }}
            >
              Slate Plans
            </div>
            <h1
              style={{
                fontFamily: FREDOKA,
                fontWeight: 700,
                fontSize: 'clamp(36px, 6vw, 60px)',
                color: INK,
                letterSpacing: '-0.03em',
                lineHeight: 1,
                margin: 0,
              }}
            >
              Build smarter.{' '}
              <span
                style={{
                  background: YELLOW,
                  padding: '0 14px',
                  border: `3px solid ${INK}`,
                  borderRadius: 14,
                  boxShadow: `4px 4px 0 ${INK}`,
                  display: 'inline-block',
                  transform: 'rotate(-1deg)',
                }}
              >
                Learn faster.
              </span>
            </h1>
            <p
              style={{
                fontFamily: NUNITO,
                fontSize: 17,
                color: '#495057',
                maxWidth: 520,
                margin: '20px auto 0',
                lineHeight: 1.55,
              }}
            >
              Start free, no card required. Upgrade any time to unlock Instant Classroom and 30
              courses a month.
            </p>
          </div>

          <PricingPanel />
        </div>
      </main>
    </>
  );
}
