'use client';

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, LogOut, Mail, Zap, Crown, Shield, BookOpen, ExternalLink, RefreshCw, Sun, Moon, Monitor, User, CreditCard } from 'lucide-react';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePlanStore } from '@/lib/store/user-plan';
import { useTheme } from '@/lib/hooks/use-theme';
import type { UserPlan } from '@/lib/stripe/plans';

interface AuthProfileModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'general' | 'plans';

const ACCOUNT_META: Record<string, { label: string; color: string; bgClass: string; icon: React.ReactNode }> = {
  FREE:  { label: 'Free',  color: '#073b4c', bgClass: 'bg-[#f0f4f8] dark:bg-[#1a2332]', icon: <BookOpen className="size-3" /> },
  PLUS:  { label: 'Plus',  color: '#118AB2', bgClass: 'bg-[#e8f6fd] dark:bg-[#0a1929]', icon: <Zap className="size-3" /> },
  ADMIN: { label: 'Admin', color: '#06D6A0', bgClass: 'bg-[#e6fdf7] dark:bg-[#0a1f1a]', icon: <Shield className="size-3" /> },
};

// ── Plans Tab ────────────────────────────────────────────────────────────────

function PlansTab({
  plan,
  credits,
  isLoading,
  onRefresh,
  onClose,
}: {
  plan: UserPlan | null;
  credits: { used: number; total: number | 'unlimited'; remaining: number | 'unlimited'; resetsAt: string | null } | null;
  isLoading: boolean;
  onRefresh: () => void;
  onClose: () => void;
}) {
  if (!plan && isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-16 rounded-2xl bg-[#f0f4f8] dark:bg-[#1a1a1a] animate-pulse" />
        <div className="h-24 rounded-2xl bg-[#f0f4f8] dark:bg-[#1a1a1a] animate-pulse" />
      </div>
    );
  }

  if (!plan) return null;

  const meta   = ACCOUNT_META[plan.account_type] ?? ACCOUNT_META.FREE;
  const isPaid = plan.account_type === 'PLUS' || plan.account_type === 'ADMIN';

  const used      = credits?.used      ?? 0;
  const total     = credits?.total     ?? (plan.account_type === 'FREE' ? 2 : 30);
  const remaining = credits?.remaining ?? (total === 'unlimited' ? 'unlimited' : Math.max(0, (total as number) - used));
  const pct       = total === 'unlimited' ? 0 : Math.min(100, Math.round((used / (total as number)) * 100));

  const handleUpgrade = () => {
    onClose();
    window.location.href = '/pricing';
  };

  const handleManageBilling = async () => {
    const res  = await fetch('/api/stripe/portal', { method: 'POST' });
    const json = await res.json();
    if (json.url) window.open(json.url, '_blank');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Current plan */}
      <div>
        <div className="flex items-center justify-between mb-2 px-0.5">
          <h4 className="text-[11px] font-black text-[#073b4c]/40 dark:text-[#737373] uppercase tracking-widest">Current Plan</h4>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh"
            className="size-5 flex items-center justify-center rounded-full hover:bg-[#f0f4f8] dark:hover:bg-[#2a2a2a]
              text-[#073b4c]/30 hover:text-[#073b4c]/60 dark:text-[#737373] transition-all disabled:opacity-40 cursor-pointer"
          >
            <RefreshCw className={`size-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div
          className={`flex items-center justify-between rounded-2xl border-2 px-3 py-3 ${meta.bgClass}`}
          style={{ borderColor: `${meta.color}20` }}
        >
          <div className="flex items-center gap-2">
            <span style={{ color: meta.color }}>{meta.icon}</span>
            <span className="text-sm font-black dark:opacity-90" style={{ color: meta.color }}>{meta.label}</span>
            {plan.subscription_period && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize"
                style={{ background: `${meta.color}18`, color: meta.color }}>
                {plan.subscription_period}
              </span>
            )}
          </div>
          {isPaid ? (
            <button
              onClick={handleManageBilling}
              className="flex items-center gap-1 text-[10px] font-semibold text-[#073b4c]/40 hover:text-[#073b4c] dark:hover:text-white transition-colors cursor-pointer"
            >
              Manage <ExternalLink className="size-2.5" />
            </button>
          ) : (
            <button
              onClick={handleUpgrade}
              className="flex items-center gap-1 text-[10px] font-black text-[#118AB2] hover:text-[#073b4c] transition-colors cursor-pointer"
            >
              <Crown className="size-3" /> Upgrade
            </button>
          )}
        </div>
      </div>

      {/* Usage */}
      <div>
        <h4 className="text-[11px] font-black text-[#073b4c]/40 dark:text-[#737373] uppercase tracking-widest mb-2 px-0.5">
          {plan.account_type === 'FREE' ? 'Course Credits (Lifetime)' : 'Courses This Month'}
        </h4>
        <div className="bg-[#f0f4f8] dark:bg-[#1a1a1a] rounded-2xl border-2 border-[#073b4c]/5 dark:border-[#2a2a2a] px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#073b4c]/60 dark:text-[#a3a3a3]">
              {remaining === 'unlimited' ? '∞ unlimited' : `${remaining} remaining`}
            </span>
            {total !== 'unlimited' && (
              <span className="text-[10px] font-semibold text-[#073b4c]/35 dark:text-[#737373]">
                {used} / {total as number} used
              </span>
            )}
          </div>

          {plan.extra_credits > 0 && (
            <div className="flex items-center gap-1.5 mb-2">
              <div className="size-1.5 rounded-full bg-[#118AB2] animate-pulse" />
              <span className="text-[10px] font-bold text-[#118AB2]">
                Includes {plan.extra_credits} top-up credits
              </span>
            </div>
          )}

          {total !== 'unlimited' ? (
            <>
              <div className="w-full h-2 rounded-full bg-[#073b4c]/10 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: pct >= 90 ? '#ef476f' : pct >= 60 ? '#ffd166' : '#06D6A0',
                  }}
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-[#06D6A0] font-black">Unlimited access</p>
          )}
        </div>
      </div>

      {/* Top-up / upgrade CTA */}
      {!isPaid && (
        <div className="bg-gradient-to-br from-[#118AB2]/8 to-[#06D6A0]/8 border-2 border-[#118AB2]/15 rounded-2xl p-4">
          <p className="text-xs font-black text-[#073b4c] dark:text-[#e0e0e0] mb-1">Unlock more with Plus</p>
          <p className="text-[10px] text-[#073b4c]/50 dark:text-[#737373] mb-3 leading-relaxed">
            Get 30 courses/month, priority AI generation, and more.
          </p>
          <button
            onClick={handleUpgrade}
            className="w-full h-9 rounded-xl bg-[#073b4c] dark:bg-[#118AB2] text-white text-xs font-black hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Crown className="size-3.5" /> Upgrade to Plus
          </button>
        </div>
      )}

      {isPaid && (
        <div className="bg-[#f0f4f8] dark:bg-[#1a1a1a] border-2 border-[#073b4c]/5 dark:border-[#2a2a2a] rounded-2xl p-4">
          <p className="text-xs font-black text-[#073b4c] dark:text-[#e0e0e0] mb-1">Manage Subscription</p>
          <p className="text-[10px] text-[#073b4c]/50 dark:text-[#737373] mb-3 leading-relaxed">
            Update billing, cancel, or change your plan.
          </p>
          <button
            onClick={handleManageBilling}
            className="w-full h-9 rounded-xl border-2 border-[#073b4c]/20 dark:border-[#333333] text-[#073b4c] dark:text-[#e0e0e0] text-xs font-black hover:bg-white dark:hover:bg-[#2a2a2a] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            Billing Portal <ExternalLink className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── General Tab ──────────────────────────────────────────────────────────────

function GeneralTab({
  avatarUrl,
  fullName,
  email,
  provider,
  initials,
  theme,
  setTheme,
  onSignOut,
}: {
  avatarUrl: string;
  fullName: string;
  email: string;
  provider: string;
  initials: string;
  theme: string;
  setTheme: (t: 'light' | 'dark' | 'system') => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Profile info */}
      <div>
        <h4 className="text-[11px] font-black text-[#073b4c]/40 dark:text-[#737373] uppercase tracking-widest mb-3 px-0.5">Profile</h4>
        <div className="flex items-center gap-3.5 bg-[#f0f4f8] dark:bg-[#1a1a1a] border-2 border-[#073b4c]/5 dark:border-[#2a2a2a] rounded-2xl p-3.5">
          {avatarUrl ? (
            <div className="size-14 rounded-2xl border-[3px] border-[#073b4c] dark:border-[#4a9db5] overflow-hidden shadow-[3px_3px_0_#073b4c] dark:shadow-[3px_3px_0_#4a9db5] shrink-0">
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            </div>
          ) : (
            <div className="size-14 rounded-2xl border-[3px] border-[#073b4c] dark:border-[#4a9db5] bg-gradient-to-br from-[#118AB2] to-[#06D6A0] shadow-[3px_3px_0_#073b4c] dark:shadow-[3px_3px_0_#4a9db5] flex items-center justify-center shrink-0">
              <span className="text-lg font-black text-white">{initials}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            {fullName && (
              <p className="text-sm font-bold text-[#073b4c] dark:text-[#f0f0f0] truncate leading-tight">{fullName}</p>
            )}
            <p className="text-[11px] text-[#073b4c]/50 dark:text-[#737373] truncate mt-0.5">{email}</p>
            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-white dark:bg-[#2a2a2a] rounded-full border border-[#073b4c]/10 dark:border-[#333333]">
              {provider === 'google' ? (
                <svg className="size-3" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              ) : (
                <Mail className="size-3 text-[#118AB2]" />
              )}
              <span className="text-[10px] font-semibold text-[#073b4c]/50 dark:text-[#737373] capitalize">{provider}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div>
        <h4 className="text-[11px] font-black text-[#073b4c]/40 dark:text-[#737373] uppercase tracking-widest mb-2 px-0.5">Appearance</h4>
        <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-[#f0f4f8] dark:bg-[#111111] rounded-2xl border-2 border-[#073b4c]/5 dark:border-[#2a2a2a]">
          {([
            { value: 'light',  icon: <Sun className="size-3" />,     label: 'Light' },
            { value: 'dark',   icon: <Moon className="size-3" />,    label: 'Dark' },
            { value: 'system', icon: <Monitor className="size-3" />, label: 'System' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg font-bold text-[10px] transition-all cursor-pointer ${
                theme === opt.value
                  ? 'bg-white dark:bg-slate-700 text-[#073b4c] dark:text-[#f0f0f0] shadow-[2px_2px_0_#073b4c] dark:shadow-[2px_2px_0_rgba(0,0,0,0.5)] border-2 border-[#073b4c] dark:border-[#333333]'
                  : 'text-[#073b4c]/50 dark:text-[#737373] hover:text-[#073b4c] dark:hover:text-slate-300 border-2 border-transparent'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={onSignOut}
        className="w-full h-11 rounded-2xl border-[3px] border-[#073b4c] dark:border-[#333333] bg-white dark:bg-transparent text-[#073b4c] dark:text-[#f0f0f0] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#ef476f] hover:text-white hover:translate-y-[-2px] shadow-[3px_3px_0_#073b4c] dark:shadow-[3px_3px_0_rgba(0,0,0,0.5)] hover:shadow-[5px_5px_0_#073b4c] transition-all cursor-pointer active:translate-y-0 active:shadow-[2px_2px_0_#073b4c]"
      >
        <LogOut className="size-4" />
        Sign Out
      </button>
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────

export function AuthProfileModal({ open, onClose }: AuthProfileModalProps) {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const panelRef = useRef<HTMLDivElement>(null);
  const portalReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const { plan, credits, isLoading: planLoading, refetch: refetchPlan } = usePlanStore();

  const closeProfile = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (open && user) refetchPlan();
  }, [open, user, refetchPlan]);

  // Reset tab on open
  useEffect(() => {
    if (open) setActiveTab('general');
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) closeProfile();
    };
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler); };
  }, [open, closeProfile]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeProfile(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, closeProfile]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      /* fall through — we still want to redirect even if the network call fails */
    }
    closeProfile();
    // Clear any cached course data so the previous user's content doesn't
    // briefly flash on the next page. IndexedDB stores per-user courses,
    // and stale entries make sign-out look like it didn't take effect.
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    // Navigate to /auth/login (not '/') so the sign-out is visibly different
    // from the logged-in dashboard. /auth/login is unauthenticated UX, which
    // is the correct landing for a just-signed-out user.
    window.location.href = '/auth/login';
  };

  if (!user) return null;

  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
  const fullName  = user.user_metadata?.full_name || user.user_metadata?.name || '';
  const email     = user.email || '';
  const provider  = user.app_metadata?.provider || 'email';
  const initials  = fullName
    ? fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : email.slice(0, 2).toUpperCase();

  const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <User className="size-4" /> },
    { id: 'plans',   label: 'Plans',   icon: <CreditCard className="size-4" /> },
  ];

  const overlay = (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[99] bg-black/30 backdrop-blur-[3px]"
            aria-hidden
          />

          {/* Centered modal */}
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[100]
              w-[640px] max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)]
              flex flex-col sm:flex-row rounded-3xl border-[3px] border-[#073b4c] dark:border-[#333333]
              bg-white dark:bg-[#1a1a1a]
              shadow-[8px_8px_0_#073b4c] dark:shadow-[8px_8px_0_rgba(0,0,0,0.6)]
              overflow-hidden"
          >
            {/* Left nav */}
            <div className="w-full sm:w-[160px] sm:shrink-0 border-b-[3px] sm:border-b-0 sm:border-r-[3px] border-[#073b4c]/10 dark:border-[#2a2a2a] bg-[#f8fafb] dark:bg-[#141414] flex flex-col">
              {/* Nav items */}
              <nav className="flex flex-row sm:flex-col gap-1 px-2 py-2 sm:py-4 flex-1">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${
                      activeTab === item.id
                        ? 'bg-white dark:bg-[#2a2a2a] text-[#073b4c] dark:text-[#f0f0f0] shadow-[2px_2px_0_#073b4c] dark:shadow-[2px_2px_0_rgba(0,0,0,0.5)] border-2 border-[#073b4c]/20 dark:border-[#333333]'
                        : 'text-[#073b4c]/50 dark:text-[#737373] hover:bg-white/60 dark:hover:bg-[#2a2a2a]/60 hover:text-[#073b4c] dark:hover:text-[#e0e0e0] border-2 border-transparent'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Right content */}
            <div className="flex-1 min-w-0 flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b-2 border-[#073b4c]/8 dark:border-[#2a2a2a] shrink-0">
                <h3 className="text-sm font-black text-[#073b4c] dark:text-[#f0f0f0] tracking-tight">
                  {activeTab === 'general' ? 'General' : 'Plans & Credits'}
                </h3>
                <button
                  onClick={closeProfile}
                  className="size-7 rounded-full border-2 border-[#073b4c]/20 dark:border-[#333333] flex items-center justify-center hover:bg-[#f0f4f8] dark:hover:bg-[#2a2a2a] hover:border-[#073b4c]/40 transition-all cursor-pointer"
                >
                  <X className="size-3.5 text-[#073b4c]/60 dark:text-[#a3a3a3]" />
                </button>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
                {activeTab === 'general' && (
                  <GeneralTab
                    avatarUrl={avatarUrl}
                    fullName={fullName}
                    email={email}
                    provider={provider}
                    initials={initials}
                    theme={theme}
                    setTheme={setTheme}
                    onSignOut={handleSignOut}
                  />
                )}
                {activeTab === 'plans' && (
                  <PlansTab
                    plan={plan}
                    credits={credits}
                    isLoading={planLoading}
                    onRefresh={() => refetchPlan({ withLoading: true })}
                    onClose={closeProfile}
                  />
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (!portalReady) return null;
  return createPortal(overlay, document.body);
}
