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
  Headphones,
  ChevronLeft,
  Bolt,
  Infinity,
  RefreshCw,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import type { UserPlan, SubscriptionPeriod } from '@/lib/stripe/plans';
import { UpgradeSuccessModal } from '@/components/billing/upgrade-success-modal';
import { usePlanStore } from '@/lib/store/user-plan';
import { Button } from '@/components/ui/button';
import posthog from 'posthog-js';

// ── Feature table ───────────────────────────────────────────────────────────

const FEATURES: {
  label: string;
  free: boolean | string;
  standard: boolean | string;
  ultra: boolean | string;
}[] = [
  { label: 'AI course generation', free: true, standard: true, ultra: true },
  { label: 'Basic classrooms / mo', free: '2 total', standard: '30 / mo', ultra: 'Unlimited' },
  { label: 'Instant classrooms / mo', free: false, standard: false, ultra: '30 / mo' },
  { label: 'Cloud storage & quizzes', free: true, standard: true, ultra: true },
  { label: 'Monthly credit reset', free: false, standard: true, ultra: true },
  { label: 'Priority generation', free: false, standard: true, ultra: true },
  { label: 'Slate community', free: false, standard: true, ultra: true },
  { label: '1-on-1 support', free: false, standard: false, ultra: true },
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

function CreditsInfo() {
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-1">
            <p className="text-xs font-black text-[#073b4c]/40 uppercase tracking-widest">Free</p>
            <p className="text-sm text-[#073b4c]/70">
              2 lifetime credits. Once used, top up for $5 per 10 extra basic classrooms.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black text-[#118AB2] uppercase tracking-widest">Standard</p>
            <p className="text-sm text-[#073b4c]/70">
              30 basic classroom credits reset every month on your billing date. Unused credits
              don't carry over.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black text-[#ffd166] uppercase tracking-widest">Ultra</p>
            <p className="text-sm text-[#073b4c]/70">
              30 instant classroom credits + unlimited basic classrooms per month. Instant credits
              reset monthly.
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-[#073b4c]/5 flex items-start gap-2">
          <RefreshCw className="size-3.5 text-[#073b4c]/30 mt-0.5 shrink-0" />
          <p className="text-xs text-[#073b4c]/40">
            Top-ups add 10 basic classroom credits for $5 and work on any plan. Credits never
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
            ? ['PLUS', 'ULTRA'].includes(json.plan.account_type) ||
              json.plan.subscription_status === 'active'
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

  const handleCheckout = async (
    period: 'monthly' | 'yearly' | 'ultra_monthly' | 'ultra_yearly',
  ) => {
    setLoading(period);
    posthog.capture('checkout_initiated', { plan_period: period });
    try {
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
      setLoading(null);
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
  const isUltra = accountType === 'ULTRA';
  const isAdmin = accountType === 'ADMIN';

  const isStandardMonthlyActive = isPlus && currentPeriod === 'monthly';
  const isStandardYearlyActive = isPlus && currentPeriod === 'yearly';
  const isUltraMonthlyActive = isUltra && currentPeriod === 'monthly';
  const isUltraYearlyActive = isUltra && currentPeriod === 'yearly';

  const standardCheckoutId = billingCycle === 'monthly' ? 'monthly' : 'yearly';
  const ultraCheckoutId = billingCycle === 'monthly' ? 'ultra_monthly' : 'ultra_yearly';
  const isStandardActive =
    billingCycle === 'monthly' ? isStandardMonthlyActive : isStandardYearlyActive;
  const isUltraActive = billingCycle === 'monthly' ? isUltraMonthlyActive : isUltraYearlyActive;

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
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">

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
              <span className="text-4xl font-black text-[#073b4c]">$0</span>
              <span className="text-[#073b4c]/30 text-sm ml-1">forever</span>
            </div>

            <ul className="space-y-2.5 mb-8 flex-1">
              <li className="flex items-center gap-2 text-sm text-[#073b4c]/70">
                <Check className="size-3.5 text-[#06D6A0] stroke-[3] shrink-0" />
                <strong>2 basic classrooms</strong> (lifetime)
              </li>
              <li className="flex items-center gap-2 text-sm text-[#073b4c]/70">
                <Check className="size-3.5 text-[#06D6A0] stroke-[3] shrink-0" />
                Cloud storage & quizzes
              </li>
              <li className="flex items-center gap-2 text-sm text-[#073b4c]/70">
                <Check className="size-3.5 text-[#06D6A0] stroke-[3] shrink-0" />
                Leaderboard & analytics
              </li>
              <li className="flex items-start gap-2 text-sm text-[#073b4c]/40">
                <span className="mt-0.5 text-base font-bold leading-none">—</span>
                No instant classrooms
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
            {isStandardActive && (
              <div className="absolute -top-3 left-5 px-3 py-0.5 bg-[#118AB2] rounded-full text-white text-[10px] font-black uppercase tracking-widest">
                Active
              </div>
            )}
            {billingCycle === 'yearly' && !isStandardActive && (
              <div className="absolute -top-3 right-5 px-3 py-0.5 bg-[#118AB2]/15 border border-[#118AB2]/30 rounded-full text-[#118AB2] text-[10px] font-black uppercase tracking-widest">
                Save $48/yr
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
                <span className="text-4xl font-black text-[#073b4c]">$20</span>
                <span className="text-[#073b4c]/30 text-sm ml-1">/ month</span>
              </div>
            ) : (
              <div className="mb-1">
                <span className="text-4xl font-black text-[#073b4c]">$16</span>
                <span className="text-[#073b4c]/30 text-sm ml-1">/ month</span>
                <p className="text-xs font-bold text-[#06D6A0] mt-0.5 mb-5">
                  Billed $192/yr · save $48
                </p>
              </div>
            )}

            <ul className="space-y-2.5 mb-8 flex-1">
              <li className="flex items-center gap-2 text-sm text-[#073b4c]/70">
                <Check className="size-3.5 text-[#118AB2] stroke-[3] shrink-0" />
                <strong>30 basic classrooms / month</strong>
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
              <li className="flex items-start gap-2 text-sm text-[#073b4c]/40">
                <span className="mt-0.5 text-base font-bold leading-none">—</span>
                No instant classrooms
              </li>
            </ul>

            {isStandardActive ? (
              <button
                onClick={handlePortal}
                disabled={loading === 'portal'}
                className="h-11 rounded-2xl border-[3px] border-[#118AB2] text-[#118AB2] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#118AB2]/5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading === 'portal' ? 'Loading…' : 'Manage Subscription'}
              </button>
            ) : (
              <button
                onClick={() => handleCheckout(standardCheckoutId as 'monthly' | 'yearly')}
                disabled={!!loading || isAdmin || isUltra}
                className="h-11 rounded-2xl border-[3px] border-[#118AB2] bg-[#118AB2] text-white font-bold text-sm flex items-center justify-center hover:bg-[#0e7aa0] hover:shadow-[4px_4px_0_#073b4c] transition-all cursor-pointer disabled:opacity-50 shadow-[3px_3px_0_#073b4c]"
              >
                {loading === standardCheckoutId
                  ? 'Redirecting…'
                  : isUltra
                    ? 'Included in Ultra'
                    : billingCycle === 'monthly'
                      ? 'Get Standard'
                      : 'Get Standard Yearly'}
              </button>
            )}
          </motion.div>

          {/* ULTRA */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            id="ultra"
            className="relative rounded-3xl border-[3px] border-[#ffd166] bg-gradient-to-br from-[#fffdf0] to-white p-7 flex flex-col shadow-[6px_6px_0_#ffd166]"
          >
            <div className="absolute -top-3 right-5 px-3 py-0.5 bg-[#ffd166] border border-[#073b4c]/10 rounded-full text-[#073b4c] text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
              {isUltraActive ? (
                'Active'
              ) : (
                <>
                  <Bolt className="size-2.5" />
                  Instant Classroom
                </>
              )}
            </div>

            <div className="flex items-center gap-2 mb-5">
              <div className="size-9 rounded-xl bg-[#ffd166]/20 border-2 border-[#ffd166]/40 flex items-center justify-center">
                <Sparkles className="size-4 text-[#ffd166]" />
              </div>
              <div>
                <p className="text-xs font-black text-[#ffd166]/70 uppercase tracking-widest">
                  Ultra
                </p>
                <h2 className="text-lg font-black text-[#073b4c]">
                  {billingCycle === 'monthly' ? 'Monthly' : 'Yearly'}
                </h2>
              </div>
            </div>

            {billingCycle === 'monthly' ? (
              <div className="mb-6">
                <span className="text-4xl font-black text-[#073b4c]">$200</span>
                <span className="text-[#073b4c]/30 text-sm ml-1">/ month</span>
              </div>
            ) : (
              <div className="mb-1">
                <span className="text-4xl font-black text-[#073b4c]">$150</span>
                <span className="text-[#073b4c]/30 text-sm ml-1">/ month</span>
                <p className="text-xs font-bold text-[#06D6A0] mt-0.5 mb-5">
                  Billed $1,800/yr · save $600
                </p>
              </div>
            )}

            <ul className="space-y-2.5 mb-8 flex-1">
              <li className="flex items-center gap-2 text-sm text-[#073b4c]/70">
                <Bolt className="size-3.5 text-[#ffd166] shrink-0" />
                <strong>30 instant classrooms / month</strong>
              </li>
              <li className="flex items-center gap-2 text-sm text-[#073b4c]/70">
                <Infinity className="size-3.5 text-[#ffd166] shrink-0" />
                <strong>Unlimited basic classrooms</strong>
              </li>
              <li className="flex items-center gap-2 text-sm text-[#073b4c]/70">
                <Check className="size-3.5 text-[#ffd166] stroke-[3] shrink-0" />
                Monthly instant credit reset
              </li>
              <li className="flex items-center gap-2 text-sm text-[#073b4c]/70">
                <Headphones className="size-3.5 text-[#ffd166] shrink-0" />
                <strong>1-on-1 support</strong> from the team
              </li>
              <li className="flex items-center gap-2 text-sm text-[#073b4c]/70">
                <MessageCircle className="size-3.5 text-[#ffd166] shrink-0" />
                Slate community access
              </li>
            </ul>

            {isUltraActive ? (
              <button
                onClick={handlePortal}
                disabled={loading === 'portal'}
                className="h-11 rounded-2xl border-[3px] border-[#ffd166] text-[#073b4c] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#ffd166]/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading === 'portal' ? 'Loading…' : 'Manage Subscription'}
              </button>
            ) : (
              <button
                onClick={() => handleCheckout(ultraCheckoutId as 'ultra_monthly' | 'ultra_yearly')}
                disabled={!!loading || isAdmin}
                className="h-11 rounded-2xl border-[3px] border-[#073b4c] bg-[#ffd166] text-[#073b4c] font-black text-sm flex items-center justify-center hover:bg-[#f5c842] hover:shadow-[4px_4px_0_#073b4c] transition-all cursor-pointer disabled:opacity-50 shadow-[3px_3px_0_#073b4c]"
              >
                {loading === ultraCheckoutId
                  ? 'Redirecting…'
                  : billingCycle === 'monthly'
                    ? 'Get Ultra'
                    : 'Get Ultra Yearly'}
              </button>
            )}
          </motion.div>
        </div>

        {/* ── Classroom types explainer ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="max-w-3xl mx-auto mb-12"
        >
          <h3 className="text-center text-xs font-black text-[#073b4c]/30 uppercase tracking-widest mb-5">
            Two ways to learn
          </h3>
          <div className="flex flex-col md:flex-row gap-5">
            <ClassroomTypeCard
              icon={<Clock className="size-5 text-[#8338ec]" />}
              title="Basic Classroom"
              color="#8338ec"
              borderColor="border-[#8338ec]/20"
              shadowColor="shadow-[4px_4px_0_#8338ec]/15"
              badge="All plans"
              features={[
                'Generated in the background in 3–5 min',
                'Full slide deck with quizzes & leaderboard',
                'Available on Free and Standard',
                'Top up extra credits for $5 per 10 courses',
              ]}
            />
            <ClassroomTypeCard
              icon={<Bolt className="size-5 text-[#ffd166]" />}
              title="Instant Classroom"
              color="#f5c842"
              borderColor="border-[#ffd166]/40"
              shadowColor="shadow-[4px_4px_0_#ffd166]/30"
              badge="Ultra only"
              features={[
                'Streams live — enter the classroom instantly',
                'Real-time AI generation as you learn',
                '30 instant classrooms per month',
                'Resets on your billing date',
              ]}
            />
          </div>
        </motion.div>

        {/* ── Credits info ── */}
        <CreditsInfo />

        {/* ── Feature comparison table ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="max-w-3xl mx-auto mb-12"
        >
          <h3 className="text-center text-xs font-black text-[#073b4c]/30 uppercase tracking-widest mb-5">
            Full comparison
          </h3>
          <div className="rounded-3xl border-[3px] border-[#073b4c]/10 bg-white overflow-hidden">
            <div className="grid grid-cols-4 border-b-[3px] border-[#073b4c]/5 px-5 py-3">
              <span className="text-xs font-black text-[#073b4c]/30 uppercase tracking-widest">
                Feature
              </span>
              <span className="text-xs font-black text-[#073b4c]/40 uppercase tracking-widest text-center">
                Free
              </span>
              <span className="text-xs font-black text-[#118AB2] uppercase tracking-widest text-center">
                Standard
              </span>
              <span className="text-xs font-black text-[#ffd166] uppercase tracking-widest text-center">
                Ultra
              </span>
            </div>
            {FEATURES.map((f, i) => (
              <div
                key={f.label}
                className={`grid grid-cols-4 items-center px-5 py-3.5 ${
                  i < FEATURES.length - 1 ? 'border-b border-[#073b4c]/5' : ''
                } ${f.label === 'Instant classrooms / mo' ? 'bg-[#fffdf0]' : ''}`}
              >
                <span className="text-sm text-[#073b4c]/70 font-medium flex items-center gap-1.5">
                  {f.label === '1-on-1 support' && (
                    <Headphones className="size-3.5 text-[#ffd166] shrink-0" />
                  )}
                  {f.label === 'Slate community' && (
                    <MessageCircle className="size-3.5 text-[#118AB2] shrink-0" />
                  )}
                  {f.label === 'Instant classrooms / mo' && (
                    <Bolt className="size-3.5 text-[#ffd166] shrink-0" />
                  )}
                  {f.label}
                </span>
                <div className="flex justify-center">
                  <FeatureVal value={f.free} color="text-[#06D6A0]" />
                </div>
                <div className="flex justify-center">
                  <FeatureVal value={f.standard} color="text-[#118AB2]" />
                </div>
                <div className="flex justify-center">
                  <FeatureVal value={f.ultra} color="text-[#ffd166]" />
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
