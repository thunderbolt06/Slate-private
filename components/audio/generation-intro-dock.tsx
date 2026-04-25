'use client';

import { motion, AnimatePresence } from 'motion/react';
import { Mic2, Volume2, VolumeX } from 'lucide-react';
import type { IntroSseStatus } from '@/lib/generation/intro-sse-client';

type DockStatus = 'idle' | IntroSseStatus;

export function GenerationIntroDock({
  open,
  courseName,
  status,
  muted,
  onToggleMute,
}: {
  open: boolean;
  courseName: string;
  script?: string;
  status: DockStatus;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const audioReady = status === 'streaming' || status === 'completed';
  const visible = open && audioReady;

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          initial={{ opacity: 0, x: 120 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 120 }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          className="fixed right-3 top-20 z-[45] w-[min(22rem,calc(100vw-1.5rem))] text-left pointer-events-auto"
          aria-label="Course intro audio"
        >
          <div className="rounded-2xl border border-violet-200/70 dark:border-violet-500/30 bg-white/92 dark:bg-slate-950/92 backdrop-blur-xl shadow-xl shadow-violet-500/15 p-4">
            <div className="flex items-center gap-2">
              <div
                className="shrink-0 rounded-lg p-2 bg-violet-500/10"
                aria-hidden
              >
                <Mic2
                  className={`size-5 text-violet-600 dark:text-violet-400 ${status === 'streaming' ? 'animate-pulse' : ''}`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground/90 truncate">{courseName}</p>
              </div>
              <button
                type="button"
                onClick={onToggleMute}
                className="shrink-0 rounded-full p-2 hover:bg-violet-500/10 transition-colors ring-offset-2 ring-offset-white dark:ring-offset-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                title={muted ? 'Unmute intro' : 'Mute intro'}
                aria-pressed={muted}
                aria-label={muted ? 'Unmute intro audio' : 'Mute intro audio'}
              >
                {muted ? (
                  <VolumeX className="size-4 text-destructive" />
                ) : (
                  <Volume2 className="size-4 text-violet-600 dark:text-violet-400" />
                )}
              </button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
