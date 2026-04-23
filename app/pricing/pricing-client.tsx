'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Check,
  Zap,
  Shield,
  BookOpen,
  Sparkles,
  Clock,
  MessageCircle,
  ChevronLeft,
  RefreshCw,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import type { UserPlan, SubscriptionPeriod } from '@/lib/stripe/plans';
import { UpgradeSuccessModal } from '@/components/billing/upgrade-success-modal';
import { usePlanStore } from '@/lib/store/user-plan';
import { Button } from '@/components/ui/button';
import posthog from 'posthog-js';
import type { PaymentProvider, PaymentProviderResponse } from '@/app/api/payment/provider/route';
import type { RazorpayPlanId } from '@/lib/razorpay/client';

// ── Types ────────────────────────────────────────────────────────────────────

type CheckoutPeriod = 'monthly' | 'yearly';

// ── Razorpay script loader (only loaded for IN users) ───────────────────────

declare global {
  interface Window {
    Razorpay: new (opts: object) => { open(): void; on(e: string, h: (r: { error: { description: string } }) => void): void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// ── INR display prices matching lib/razorpay/client.ts amounts ──────────────

// Approximate rate: $1 ≈ ₹85
// yearly display is per-month equivalent (₹16,299 ÷ 12 ≈ ₹1,359)
const INR_PRICES = {
  monthly: { display: '₹1,699', sub: '/ month' },
  yearly:  { display: '₹1,359', sub: '/ month', billed: 'Billed ₹16,299/yr · save ₹4,089' },
  topup:   { display: '₹499',   sub: 'one-time' },
} as const;

// ── Feature table ───────────────────────────────────────────────────────────

const FEATURES: {
  label: string;
  free: boolean | string;
  plus: boolean | string;
}[] = [
  { label: 'AI course generation',      free: true,      plus: true      },
  { label: 'Classrooms / mo',           free: '2 total', plus: '30 / mo' },
  { label: 'Instant Classroom',         free: false,     plus: true      },
  { label: 'Cloud storage & quizzes',   free: true,      plus: true      },
  { label: 'Monthly credit reset',      free: false,     plus: true      },
  { label: 'Priority generation',       free: false,     plus: true      },
  { label: 'Slate community',           free: false,     plus: true      },
];

function FeatureVal({ value, color }: { value: boolean | string; color: string }) {
  if (value === false)
    return <span className="text-[#073b4c]/20 font-bold text-base leading-none">—</span>;
  if (value === true) return <Check className={`size-4 stroke-[3] ${color}`} />;
  return <span className="text-[10px] font-black text-[#073b4c]">{value}</span>;
}

// ── Classroom type card ─────────────────────────────────────────────────────

function ClassroomTypeCard({
  icon,
  title,
  color,
  borderColor,
  shadowColor,
  badge,
  features,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  borderColor: string;
  shadowColor: string;
  badge: string;
  features: string[];
}) {
  return (
    <div className={`flex-1 rounded-3xl border-[3px] ${borderColor} bg-white p-6 ${shadowColor}`}>
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`size-10 rounded-2xl flex items-center justify-center border-2 ${borderColor}/40`}
          style={{ background: `${color}18` }}
        >
          {icon}
        </div>
        <div>
          <span
            className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: `${color}22`, color }}
          >
            {badge}
          </span>
          <h4 className="text-base font-black text-[#073b4c] mt-0.5">{title}</h4>
        </div>
      </div>
      <ul className="space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-[#073b4c]/65">
            <Check className="size-3.5 mt-0.5 shrink-0 stroke-[3]" style={{ color }} />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Credits info ────────────────────────────────────────────────────────────

function CreditsInfo({ topupPrice }: { topupPrice: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="max-w-3xl mx-auto mb-12"
    >
      <div className="rounded-3xl border-[3px] border-[#073b4c]/10 bg-white p-7">
        <div className="flex items-center gap-2 mb-4">
          <Info className="size-4 text-[#118AB2]" />
          <h3 className="text-sm font-black text-[#073b4c] uppercase tracking-widest">
            How credits work
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1">
            <p className="text-xs font-black text-[#073b4c]/40 uppercase tracking-widest">Free</p>
            <p className="text-sm text-[#073b4c]/70">
              2 lifetime classroom credits. Once used, top up for {topupPrice} per 10 extra classrooms.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black text-[#118AB2] uppercase tracking-widest">Plus</p>
            <p className="text-sm text-[#073b4c]/70">
              30 classroom credits per month (Standard + Instant), reset on your billing date. Unused credits don&apos;t carry over.
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-[#073b4c]/5 flex items-start gap-2">
          <RefreshCw className="size-3.5 text-[#073b4c]/30 mt-0.5 shrink-0" />
          <p className="text-xs text-[#073b4c]/40">
            Top-ups add 10 Standard Classroom credits for {topupPrice} and work on any plan. Credits never
            expire once purchased.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function PricingClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentProvider, setPaymentProvider] = useState<PaymentProviderResponse | null>(null);
  const [successModal, setSuccessModal] = useState<{ open: boolean; period: SubscriptionPeriod }>({
    open: false,
    period: null,
  });

  useEffect(() => {
    const successParam = searchParams.get('success');
    const periodParam = searchParams.get('period') as SubscriptionPeriod | null;
    const topupParam = searchParams.get('topup');

    if (successParam || topupParam === 'success') {
      if (successParam) {
        setSuccessModal({ open: true, period: periodParam ?? 'monthly' });
      } else {
        toast.success('10 courses added to your account! Happy learning 🎉');
      }

      let count = 0;
      const interval = setInterval(async () => {
        count++;
        const res = await fetch('/api/user/plan', { cache: 'no-store' });
        const json = await res.json();
        if (json.success) {
          setPlan(json.plan);
          usePlanStore.getState().refetch();
          const isUpdated = successParam
            ? json.plan.account_type === 'PLUS' || json.plan.subscription_status === 'active'
            : true;
          if (isUpdated || count >= 5) clearInterval(interval);
        }
      }, 2000);

      return () => clearInterval(interval);
    } else if (searchParams.get('canceled')) {
      toast.info('Checkout canceled — no charge was made.');
    }
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/user/plan', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setPlan(j.plan); })
      .catch(() => {});
  }, []);

  // Detect payment provider from geo (runs once, server-side headers used)
  useEffect(() => {
    fetch('/api/payment/provider')
      .then((r) => r.json())
      .then((data: PaymentProviderResponse) => setPaymentProvider(data))
      .catch(() => setPaymentProvider({ provider: 'stripe', countryCode: 'XX', countryName: 'Unknown' }));
  }, []);

  const handleCheckout = async (period: CheckoutPeriod) => {
    setLoading(period);
    const provider: PaymentProvider = paymentProvider?.provider ?? 'stripe';
    posthog.capture('checkout_initiated', { plan_period: period, provider });

    try {
      // ── Razorpay (India) ────────────────────────────────────────────────────
      if (provider === 'razorpay') {
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          toast.error('Failed to load payment gateway. Please try again.');
          setLoading(null);
          return;
        }

        const orderRes = await fetch('/api/razorpay/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ period: period as RazorpayPlanId }),
        });
        const orderData = await orderRes.json();
        if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create order');

        const rzp = new window.Razorpay({
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency,
          order_id: orderData.order_id,
          name: 'Slate',
          description: `Slate ${period} plan`,
          theme: { color: '#073b4c' },
          handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            try {
              const verifyRes = await fetch('/api/razorpay/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...response, period }),
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok) throw new Error(verifyData.error || 'Payment verification failed');

              setSuccessModal({ open: true, period: period as SubscriptionPeriod });
              usePlanStore.getState().refetch();
              posthog.capture('razorpay_checkout_completed', { plan_period: period, payment_id: response.razorpay_payment_id });
            } catch (err: any) {
              toast.error(err.message || 'Payment verification failed');
            } finally {
              setLoading(null);
            }
          },
          modal: {
            ondismiss: () => {
              toast.info('Payment cancelled — no charge was made.');
              setLoading(null);
            },
          },
        });

        rzp.on('payment.failed', (response: { error: { description: string } }) => {
          toast.error(response.error.description || 'Payment failed');
          setLoading(null);
        });

        rzp.open();
        return; // loading cleared inside handlers above
      }

      // ── Stripe (rest of world) ──────────────────────────────────────────────
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Checkout failed');
      if (json.url) window.location.href = json.url;
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      if (provider !== 'razorpay') setLoading(null);
    }
  };

  const handlePortal = async () => {
    setLoading('portal');
    posthog.capture('subscription_management_opened');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Portal failed');
      if (json.url) window.open(json.url, '_blank');
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setLoading(null);
    }
  };

  const currentPeriod = plan?.subscription_period;
  const accountType = plan?.account_type ?? 'FREE';
  const isPlus = accountType === 'PLUS';
  const isAdmin = accountType === 'ADMIN';

  // Geo-aware pricing display
  const isIndia = paymentProvider?.provider === 'razorpay';
  const stdMonthlyPrice    = isIndia ? INR_PRICES.monthly.display : '$20';
  const stdYearlyPrice     = isIndia ? INR_PRICES.yearly.display  : '$16';
  const stdYearlyBilled    = isIndia ? INR_PRICES.yearly.billed   : 'Billed $192/yr · save $48';
  const stdYearlySaveBadge = isIndia ? 'Save ₹4,089/yr'          : 'Save $48/yr';
  const topupPrice         = isIndia ? INR_PRICES.topup.display   : '$5';

  const checkoutId: CheckoutPeriod = billingCycle === 'monthly' ? 'monthly' : 'yearly';
  const isPlusActive = isPlus && currentPeriod === billingCycle;

  return (
    <>
      <UpgradeSuccessModal
        open={successModal.open}
        period={successModal.period}
        onClose={() => setSuccessModal((s) => ({ ...s, open: false }))}
      />

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 w-full bg-[#f0f4f8]/80 backdrop-blur-md border-b-[3px] border-[#073b4c]">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push('/')}
            className="group flex items-center gap-2 font-bold text-[#073b4c] hover:bg-white"
          >
            <ChevronLeft className="size-5 transition-transform group-hover:-translate-x-1" />
            <span>Back</span>
          </Button>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
            <h1 className="text-xl md:text-2xl font-black text-[#073b4c] tracking-tight uppercase">
              SLATE UP
            </h1>
            <span className="px-2 py-0.5 bg-[#ef476f] text-white text-[10px] font-bold rounded-full border border-[#073b4c] shadow-[1px_1px_0_#073b4c] uppercase tracking-widest mt-1">
              BETA
            </span>
          </div>
          <div className="w-20" />
        </div>
      </header>

      <main className="min-h-screen bg-[#f0f4f8] py-16 px-4">

        {/* ── Hero ── */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-5xl font-black text-[#073b4c] leading-tight mb-3">
              Build smarter.
              <br />
              Learn faster.
            </h1>
            <p className="text-[#073b4c]/50 text-lg max-w-md mx-auto">
              Start free. Upgrade when you need more. Cancel anytime.
            </p>
          </motion.div>
        </div>

        {/* ── Payment provider badge ── */}
        {paymentProvider && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex justify-center mb-4"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#073b4c]/10 bg-white text-[10px] font-black text-[#073b4c]/40 uppercase tracking-widest">
              {paymentProvider.provider === 'razorpay' ? (
                <>🇮🇳 Paying in INR · Razorpay</>
              ) : (
                <>💳 Paying in USD · Stripe</>
              )}
            </span>
          </motion.div>
        )}

        {/* ── Billing toggle ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex justify-center mb-10"
        >
          <div className="flex items-center gap-1 p-1 rounded-full border-[3px] border-[#073b4c]/10 bg-white">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-full text-sm font-black transition-all cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-[#073b4c] text-white shadow-[2px_2px_0_#073b4c]/20'
                  : 'text-[#073b4c]/50 hover:text-[#073b4c]'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-5 py-2 rounded-full text-sm font-black transition-all cursor-pointer flex items-center gap-2 ${
                billingCycle === 'yearly'
                  ? 'bg-[#073b4c] text-white shadow-[2px_2px_0_#073b4c]/20'
                  : 'text-[#073b4c]/50 hover:text-[#073b4c]'
              }`}
            >
              Yearly
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#06D6A0] text-[#073b4c]">
                Save up to 25%
              </span>
            </button>
          </div>
        </motion.div>

        {/* ── Plan cards ── */}
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">

          {/* FREE */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative rounded-3xl border-[3px] border-[#073b4c]/10 bg-white p-7 flex flex-col"
          >
            {accountType === 'FREE' && (
              <div className="absolute -top-3 left-5 px-3 py-0.5 bg-[#073b4c]/10 rounded-full text-[#073b4c] text-[10px] font-black uppercase tracking-widest">
                Current plan
              </div>
            )}
            <div className="flex items-center gap-2 mb-5">
              <div className="size-9 rounded-xl bg-[#f0f4f8] border-2 border-[#073b4c]/10 flex items-center justify-center">
                <BookOpen className="size-4 text-[#073b4c]/50" />
              </div>
              <div>
                <p className="text-xs font-black text-[#073b4c]/30 uppercase tracking-widest">
                  Free
                </p>
                <h2 className="text-lg font-black text-[#073b4c]">Starter</h2>
              </div>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-black text-[#073b4c]">{isIndia ? '₹0' : '$0'}</span>
              <span className="text-[#073b4c]/30 text-sm ml-1">forever</span>
            </div>

            <ul className="space-y-2.5 mb-8 flex-1">
              <li className="flex items-center gap-2 text-sm text-[#073b4c]/70">
                <Check className="size-3.5 text-[#06D6A0] stroke-[3] shrink-0" />
                <strong>2 classrooms</strong> (lifetime)
              </li>
              <li className="flex items-center gap-2 text-sm text-[#073b4c]/70">
                <Check className="size-3.5 text-[#06D6A0] stroke-[3] shrink-0" />
                Cloud storage & quizzes
              </li>
              <li className="flex items-center gap-2 text-sm text-[#073b4c]/70">
                <Check className="size-3.5 text-[#06D6A0] stroke-[3] shrink-0" />
                Leaderboard & analytics
              </li>
            </ul>

            <div className="h-11 rounded-2xl border-[3px] border-[#073b4c]/10 bg-[#f0f4f8] text-[#073b4c]/40 font-bold text-sm flex items-center justify-center">
              {accountType === 'FREE' ? 'Your current plan' : 'Free forever'}
            </div>
          </motion.div>

          {/* STANDARD */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative rounded-3xl border-[3px] border-[#118AB2] bg-white p-7 flex flex-col shadow-[6px_6px_0_#118AB2]"
          >
            {isPlusActive && (
              <div className="absolute -top-3 left-5 px-3 py-0.5 bg-[#118AB2] rounded-full text-white text-[10px] font-black uppercase tracking-widest">
                Active
              </div>
            )}
            {billingCycle === 'yearly' && !isPlusActive && (
              <div className="absolute -top-3 right-5 px-3 py-0.5 bg-[#118AB2]/15 border border-[#118AB2]/30 rounded-full text-[#118AB2] text-[10px] font-black uppercase tracking-widest">
                {stdYearlySaveBadge}
              </div>
            )}

            <div className="flex items-center gap-2 mb-5">
              <div className="size-9 rounded-xl bg-[#118AB2]/10 border-2 border-[#118AB2]/20 flex items-center justify-center">
                <Zap className="size-4 text-[#118AB2]" />
              </div>
              <div>
                <p className="text-xs font-black text-[#118AB2]/60 uppercase tracking-widest">
                  Standard
                </p>
                <h2 className="text-lg font-black text-[#073b4c]">
                  {billingCycle === 'monthly' ? 'Monthly' : 'Yearly'}
                </h2>
              </div>
            </div>

            {billingCycle === 'monthly' ? (
              <div className="mb-6">
                <span className="text-4xl font-black text-[#073b4c]">{stdMonthlyPrice}</span>
                <span className="text-[#073b4c]/30 text-sm ml-1">/ month</span>
              </div>
            ) : (
              <div className="mb-1">
                <span className="text-4xl font-black text-[#073b4c]">{stdYearlyPrice}</span>
                <span className="text-[#073b4c]/30 text-sm ml-1">/ month</span>
                <p className="text-xs font-bold text-[#06D6A0] mt-0.5 mb-5">
                  {stdYearlyBilled}
                </p>
              </div>
            )}

            <ul className="space-y-2.5 mb-8 flex-1">
              <li className="flex items-center gap-2 text-sm text-[#073b4c]/70">
                <Check className="size-3.5 text-[#118AB2] stroke-[3] shrink-0" />
                <strong>30 classrooms / month</strong>
              </li>
              <li className="flex items-center gap-2 text-sm text-[#073b4c]/70">
                <span className="text-sm shrink-0">⚡</span>
                <strong>Instant Classroom</strong> included
              </li>
              <li className="flex items-center gap-2 text-sm text-[#073b4c]/70">
                <Check className="size-3.5 text-[#118AB2] stroke-[3] shrink-0" />
                Monthly credit reset
              </li>
              <li className="flex items-center gap-2 text-sm text-[#073b4c]/70">
                <Check className="size-3.5 text-[#118AB2] stroke-[3] shrink-0" />
                Community access & priority gen
              </li>
              <li className="flex items-center gap-2 text-sm text-[#073b4c]/70">
                <Check className="size-3.5 text-[#118AB2] stroke-[3] shrink-0" />
                Everything in Free
              </li>
            </ul>

            {isPlusActive ? (
              <button
                onClick={handlePortal}
                disabled={loading === 'portal'}
                className="h-11 rounded-2xl border-[3px] border-[#118AB2] text-[#118AB2] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#118AB2]/5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading === 'portal' ? 'Loading…' : 'Manage Subscription'}
              </button>
            ) : (
              <button
                onClick={() => handleCheckout(checkoutId)}
                disabled={!!loading || isAdmin}
                className="h-11 rounded-2xl border-[3px] border-[#118AB2] bg-[#118AB2] text-white font-bold text-sm flex items-center justify-center hover:bg-[#0e7aa0] hover:shadow-[4px_4px_0_#073b4c] transition-all cursor-pointer disabled:opacity-50 shadow-[3px_3px_0_#073b4c]"
              >
                {loading === checkoutId
                  ? 'Redirecting…'
                  : billingCycle === 'monthly'
                    ? 'Get Standard'
                    : 'Get Standard Yearly'}
              </button>
            )}
          </motion.div>

        </div>

        {/* ── Credits info ── */}
        <CreditsInfo topupPrice={topupPrice} />

        {/* ── Feature comparison table ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="max-w-3xl mx-auto mb-12"
        >
          <h3 className="text-center text-xs font-black text-[#073b4c]/30 uppercase tracking-widest mb-5">
            Full comparison
          </h3>
          <div className="rounded-3xl border-[3px] border-[#073b4c]/10 bg-white overflow-hidden">
            <div className="grid grid-cols-3 border-b-[3px] border-[#073b4c]/5 px-5 py-3">
              <span className="text-xs font-black text-[#073b4c]/30 uppercase tracking-widest">
                Feature
              </span>
              <span className="text-xs font-black text-[#073b4c]/40 uppercase tracking-widest text-center">
                Free
              </span>
              <span className="text-xs font-black text-[#118AB2] uppercase tracking-widest text-center">
                Plus
              </span>
            </div>
            {FEATURES.map((f, i) => (
              <div
                key={f.label}
                className={`grid grid-cols-3 items-center px-5 py-3.5 ${
                  i < FEATURES.length - 1 ? 'border-b border-[#073b4c]/5' : ''
                } ${f.label === 'Instant Classroom' ? 'bg-[#f0f4f8]/50' : ''}`}
              >
                <span className="text-sm text-[#073b4c]/70 font-medium flex items-center gap-1.5">
                  {f.label === 'Slate community' && (
                    <MessageCircle className="size-3.5 text-[#118AB2] shrink-0" />
                  )}
                  {f.label === 'Instant Classroom' && (
                    <span className="text-xs shrink-0">⚡</span>
                  )}
                  {f.label}
                </span>
                <div className="flex justify-center">
                  <FeatureVal value={f.free} color="text-[#06D6A0]" />
                </div>
                <div className="flex justify-center">
                  <FeatureVal value={f.plus} color="text-[#118AB2]" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Admin note ── */}
        {isAdmin && (
          <div className="max-w-md mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#06D6A0]/10 border-2 border-[#06D6A0]/20 text-[#06D6A0] text-xs font-black">
              <Shield className="size-3.5" /> Admin — unlimited access
            </div>
          </div>
        )}
      </main>
    </>
  );
}
