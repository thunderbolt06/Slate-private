'use client';

import { createPortal } from 'react-dom';
import { useRef, useEffect, useCallback, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, MessageCircle } from 'lucide-react';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

const DISCORD_URL = 'https://discord.gg/wg7KCvQV3c';
const SUPPORT_EMAIL = 'hello@slateup.ai';

export function HelpModal({ open, onClose }: HelpModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const portalReady = useSyncExternalStore(() => () => {}, () => true, () => false);

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) close();
    };
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler); };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  const overlay = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[99] bg-black/10 backdrop-blur-[2px]"
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed bottom-4 left-[272px] z-[100] w-[320px] rounded-3xl border-[3px] border-[#073b4c] dark:border-[#333333] bg-white dark:bg-[#1a1a1a] shadow-[6px_6px_0_#073b4c] dark:shadow-[6px_6px_0_rgba(0,0,0,0.5)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <h3 className="text-sm font-black text-[#073b4c] dark:text-[#f0f0f0] tracking-tight">Get Help</h3>
              <button
                onClick={close}
                className="size-7 rounded-full border-2 border-[#073b4c]/20 dark:border-[#333333] flex items-center justify-center hover:bg-[#f0f4f8] dark:hover:bg-[#2a2a2a] transition-all cursor-pointer"
              >
                <X className="size-3.5 text-[#073b4c]/60 dark:text-[#a3a3a3]" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 pb-5 space-y-3">
              <p className="text-xs text-[#073b4c]/50 dark:text-[#a3a3a3] font-medium leading-relaxed">
                Need help with Slate? Reach out to our team or join our community.
              </p>

              {/* Email option */}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex items-center gap-4 p-4 rounded-2xl border-[3px] border-[#073b4c]/10 dark:border-[#2a2a2a] bg-[#f0f4f8] dark:bg-slate-800 hover:border-[#118ab2] hover:bg-[#e8f6fd] dark:hover:border-[#118ab2] dark:hover:bg-[#2a2a2a] transition-all group"
              >
                <div className="size-10 rounded-xl bg-[#118ab2] flex items-center justify-center shrink-0 shadow-[3px_3px_0_rgba(17,138,178,0.3)]">
                  <Mail className="size-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-[#073b4c] dark:text-[#f0f0f0]">Email Support</p>
                  <p className="text-[11px] text-[#073b4c]/50 dark:text-[#a3a3a3] font-medium truncate">{SUPPORT_EMAIL}</p>
                </div>
              </a>

              {/* Discord option */}
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-2xl border-[3px] border-[#073b4c]/10 dark:border-[#2a2a2a] bg-[#f0f4f8] dark:bg-slate-800 hover:border-[#5865F2] hover:bg-[#eef0fd] dark:hover:border-[#5865F2] dark:hover:bg-[#2a2a2a] transition-all group"
              >
                <div className="size-10 rounded-xl bg-[#5865F2] flex items-center justify-center shrink-0 shadow-[3px_3px_0_rgba(88,101,242,0.3)]">
                  <MessageCircle className="size-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-[#073b4c] dark:text-[#f0f0f0]">Discord Community</p>
                  <p className="text-[11px] text-[#073b4c]/50 dark:text-[#a3a3a3] font-medium">Join our server for support &amp; updates</p>
                </div>
              </a>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (!portalReady) return null;
  return createPortal(overlay, document.body);
}
