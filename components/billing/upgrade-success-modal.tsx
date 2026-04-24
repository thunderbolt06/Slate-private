'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, Check, Sparkles, BookOpen, MessageCircle, Headphones, RotateCcw } from 'lucide-react';
import type { SubscriptionPeriod } from '@/lib/stripe/plans';

interface UpgradeSuccessModalProps {
  open: boolean;
  onClose: () => void;
  period: SubscriptionPeriod;
}

const PLUS_FEATURES = [
  { icon: <Zap className="size-4 text-[#118AB2]" />, label: '30 Standard Classrooms per month' },
  { icon: <RotateCcw className="size-4 text-[#06D6A0]" />, label: 'Monthly credit reset' },
  { icon: <BookOpen className="size-4 text-[#118AB2]" />, label: 'Cloud storage for all courses' },
  { icon: <MessageCircle className="size-4 text-[#118AB2]" />, label: 'Slate community access' },
  { icon: <Check className="size-4 text-[#06D6A0] stroke-[3]" />, label: 'Priority AI generation' },
];

const ULTRA_FEATURES = [
  { icon: <span className="text-sm">⚡</span>, label: '30 instant classrooms per month' },
  { icon: <span className="text-sm">∞</span>, label: 'Unlimited Standard Classrooms' },
  { icon: <RotateCcw className="size-4 text-[#ffd166]" />, label: 'Monthly instant credit reset' },
  { icon: <Headphones className="size-4 text-[#ffd166]" />, label: '1-on-1 support from the team' },
  { icon: <MessageCircle className="size-4 text-[#ffd166]" />, label: 'Slate community access' },
];

export function UpgradeSuccessModal({ open, onClose, period }: UpgradeSuccessModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const isUltra = period === 'ultra_monthly' || period === 'ultra_yearly';
  const features = isUltra ? ULTRA_FEATURES : PLUS_FEATURES;

  const accentColor = isUltra ? '#ffd166' : '#06D6A0';
  const accentText = isUltra ? 'text-[#ffd166]' : 'text-[#06D6A0]';
  const shadowColor = isUltra ? 'shadow-[6px_6px_0_#ffd166]' : 'shadow-[6px_6px_0_#06D6A0]';
  const borderColor = isUltra ? 'border-[#ffd166]' : 'border-[#06D6A0]';
  const btnBg = isUltra
    ? 'bg-[#ffd166] border-[#073b4c] text-[#073b4c] hover:bg-[#f5c842]'
    : 'bg-[#06D6A0] border-[#073b4c] text-[#073b4c] hover:bg-[#04b889]';

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm"
            ref={overlayRef}
            onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
            aria-hidden
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 24 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[201]
              w-[92vw] max-w-[440px] rounded-3xl border-[3px] ${borderColor}
              bg-white ${shadowColor} overflow-hidden`}
            role="dialog"
            aria-modal="true"
          >
            {/* Confetti-like top strip */}
            <div
              className="h-2 w-full"
              style={{ background: `linear-gradient(90deg, ${accentColor}, #118AB2, ${accentColor})` }}
            />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 size-7 rounded-full border-2 border-[#073b4c]/20
                flex items-center justify-center hover:bg-[#f0f4f8] hover:border-[#073b4c]/40
                transition-all cursor-pointer z-10"
            >
              <X className="size-3.5 text-[#073b4c]/60" />
            </button>

            <div className="px-7 pt-6 pb-7">
              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="size-12 rounded-2xl flex items-center justify-center border-[3px] border-[#073b4c]/10"
                  style={{ backgroundColor: `${accentColor}30` }}
                >
                  {isUltra
                    ? <span className="text-2xl">⚡</span>
                    : <Sparkles className="size-6 text-[#06D6A0]" />}
                </div>
                <div>
                  <p className={`text-xs font-black uppercase tracking-widest ${accentText} mb-0.5`}>
                    {isUltra ? 'Ultra Plan Active' : 'Standard Plan Active'}
                  </p>
                  <h2 className="text-xl font-black text-[#073b4c] leading-tight">
                    {isUltra ? 'Instant classrooms unlocked! ⚡' : 'You\'re all set! 🚀'}
                  </h2>
                </div>
              </div>

              <p className="text-sm text-[#073b4c]/60 mb-5 leading-relaxed">
                {isUltra
                  ? `Your Ultra subscription is now active. Here's what you've unlocked:`
                  : `Your ${period === 'yearly' ? 'yearly' : 'monthly'} Standard subscription is now active. Here's what you've unlocked:`}
              </p>

              {/* Features list */}
              <ul className="space-y-3 mb-7">
                {features.map((f, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.07, duration: 0.25 }}
                    className="flex items-center gap-3 text-sm text-[#073b4c]/80 font-medium"
                  >
                    <span className="shrink-0">{f.icon}</span>
                    {f.label}
                  </motion.li>
                ))}
              </ul>

              {/* CTA */}
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.25 }}
                onClick={() => { onClose(); router.push('/'); }}
                className={`w-full h-12 rounded-2xl border-[3px] font-black text-sm
                  ${btnBg} shadow-[3px_3px_0_#073b4c] hover:shadow-[5px_5px_0_#073b4c]
                  hover:-translate-y-0.5 transition-all cursor-pointer active:shadow-[2px_2px_0_#073b4c]
                  active:translate-y-0 flex items-center justify-center gap-2`}
              >
                <BookOpen className="size-4" />
                Happy Learning!
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
