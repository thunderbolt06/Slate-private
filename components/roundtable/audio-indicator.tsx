'use client';

import { motion } from 'motion/react';

export type AudioIndicatorState = 'idle' | 'generating' | 'playing';

interface AudioIndicatorProps {
  state: AudioIndicatorState;
  agentColor?: string;
  /** Optional label rendered next to the bars (e.g. "Preparing voice…"). */
  label?: string;
}

const BAR_COUNT = 4;

export function AudioIndicator({ state, agentColor = '#10b981', label }: AudioIndicatorProps) {
  if (state === 'idle') return null;

  const color = state === 'generating' ? 'rgba(251, 191, 36, 0.95)' : agentColor;
  const cycleDuration = state === 'generating' ? 0.8 : 0.5;

  const bars = (
    <span className="inline-flex items-end gap-[2px]" style={{ height: 12 }}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <motion.span
          key={i}
          style={{
            width: 2,
            borderRadius: 1,
            backgroundColor: color,
          }}
          animate={{
            height: [4, 10 + (i % 2) * 2, 4],
          }}
          transition={{
            duration: cycleDuration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * (cycleDuration / BAR_COUNT),
          }}
        />
      ))}
    </span>
  );

  if (!label) return bars;

  return (
    <span className="inline-flex items-center gap-1.5">
      {bars}
      <span
        className={
          state === 'generating'
            ? 'text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-300'
            : 'text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400'
        }
      >
        {label}
      </span>
    </span>
  );
}
