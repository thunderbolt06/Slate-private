'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export type LoadingPillTone = 'default' | 'voice' | 'asr' | 'tts' | 'success' | 'warning';

interface LoadingPillProps {
  label: string;
  tone?: LoadingPillTone;
  icon?: ReactNode;
  className?: string;
  showDots?: boolean;
}

const TONE_STYLES: Record<LoadingPillTone, string> = {
  default:
    'bg-white/85 dark:bg-gray-900/85 border-gray-200/70 dark:border-gray-700/70 text-gray-700 dark:text-gray-200',
  voice:
    'bg-violet-50/90 dark:bg-violet-950/80 border-violet-200/70 dark:border-violet-800/60 text-violet-700 dark:text-violet-200',
  asr: 'bg-violet-50/90 dark:bg-violet-950/80 border-violet-200/70 dark:border-violet-800/60 text-violet-700 dark:text-violet-200',
  tts: 'bg-amber-50/90 dark:bg-amber-950/80 border-amber-200/70 dark:border-amber-800/60 text-amber-700 dark:text-amber-200',
  success:
    'bg-emerald-50/90 dark:bg-emerald-950/80 border-emerald-200/70 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-200',
  warning:
    'bg-rose-50/90 dark:bg-rose-950/80 border-rose-200/70 dark:border-rose-800/60 text-rose-700 dark:text-rose-200',
};

const DOT_COLOR: Record<LoadingPillTone, string> = {
  default: 'bg-gray-500 dark:bg-gray-300',
  voice: 'bg-violet-500 dark:bg-violet-300',
  asr: 'bg-violet-500 dark:bg-violet-300',
  tts: 'bg-amber-500 dark:bg-amber-300',
  success: 'bg-emerald-500 dark:bg-emerald-300',
  warning: 'bg-rose-500 dark:bg-rose-300',
};

export function LoadingPill({
  label,
  tone = 'default',
  icon,
  className,
  showDots = true,
}: LoadingPillProps) {
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0.21, 1, 0.36, 1] }}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-xl shadow-md text-xs font-medium select-none',
        TONE_STYLES[tone],
        className,
      )}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
      {showDots && (
        <span className="flex items-center gap-[3px]" aria-hidden>
          {[0, 0.15, 0.3].map((delay) => (
            <motion.span
              key={delay}
              className={cn('w-1 h-1 rounded-full', DOT_COLOR[tone])}
              animate={{ opacity: [0.25, 1, 0.25], y: [0, -1.5, 0] }}
              transition={{ repeat: Infinity, duration: 0.9, delay, ease: 'easeInOut' }}
            />
          ))}
        </span>
      )}
    </motion.div>
  );
}
