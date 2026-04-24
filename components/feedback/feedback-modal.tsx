'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSyncExternalStore, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bug, Lightbulb, HelpCircle, Camera, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';

type FeedbackType = 'bug' | 'feature' | 'other';

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TYPES = [
  { id: 'bug' as FeedbackType, icon: Bug, label: 'Bug Report', color: '#ef476f', bg: 'bg-[#ef476f]' },
  { id: 'feature' as FeedbackType, icon: Lightbulb, label: 'Feature', color: '#ffd166', bg: 'bg-[#ffd166]' },
  { id: 'other' as FeedbackType, icon: HelpCircle, label: 'Other', color: '#118ab2', bg: 'bg-[#118ab2]' },
] as const;

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>('bug');
  const [content, setContent] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const portalReady = useSyncExternalStore(() => () => {}, () => true, () => false);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

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

  const captureScreenshot = async () => {
    setIsCapturing(true);
    try {
      await new Promise(r => setTimeout(r, 100));
      const canvas = await html2canvas(document.body, {
        ignoreElements: (el) => el.getAttribute('data-feedback-modal') === 'true',
        useCORS: true,
        scale: 0.5,
      });
      setScreenshot(canvas.toDataURL('image/png'));
    } catch {
      toast.error('Could not capture screenshot');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content, screenshot, url: window.location.href }),
      });
      if (response.ok) {
        setIsSuccess(true);
        setTimeout(() => {
          close();
          setTimeout(() => { setIsSuccess(false); setContent(''); setScreenshot(null); setType('bug'); }, 300);
        }, 2000);
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const overlay = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[99] bg-black/20 backdrop-blur-[2px]"
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            data-feedback-modal="true"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto w-[440px] max-w-[calc(100vw-2rem)] rounded-3xl border-[3px] border-[#073b4c] dark:border-[#333333] bg-white dark:bg-[#1a1a1a] shadow-[8px_8px_0_#073b4c] dark:shadow-[8px_8px_0_rgba(51,65,85,0.8)] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b-[3px] border-[#073b4c]/8 dark:border-slate-700">
                <h3 className="text-sm font-black text-[#073b4c] dark:text-[#f0f0f0] tracking-tight">Give Feedback</h3>
                <button
                  onClick={close}
                  className="size-7 rounded-full border-2 border-[#073b4c]/20 dark:border-[#333333] flex items-center justify-center hover:bg-[#f0f4f8] dark:hover:bg-slate-700 transition-all cursor-pointer"
                >
                  <X className="size-3.5 text-[#073b4c]/60 dark:text-[#a3a3a3]" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                {isSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="py-10 flex flex-col items-center gap-4"
                  >
                    <div className="size-16 rounded-2xl bg-[#06d6a0]/15 border-[3px] border-[#06d6a0] flex items-center justify-center shadow-[3px_3px_0_#06d6a0]">
                      <CheckCircle2 className="size-8 text-[#06d6a0]" />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-black text-[#073b4c] dark:text-[#f0f0f0]">Thank you!</p>
                      <p className="text-sm text-[#073b4c]/50 dark:text-[#a3a3a3] font-medium mt-1">Your feedback helps us improve Slate.</p>
                    </div>
                  </motion.div>
                ) : (
                  <>
                    {/* Type selector */}
                    <div className="grid grid-cols-3 gap-2">
                      {TYPES.map((item) => {
                        const active = type === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setType(item.id)}
                            className={cn(
                              'flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-[3px] font-bold text-xs transition-all',
                              active
                                ? 'border-[#073b4c] dark:border-slate-400 shadow-[3px_3px_0_#073b4c] dark:shadow-[3px_3px_0_rgba(51,65,85,0.8)] -translate-y-0.5'
                                : 'border-[#073b4c]/10 dark:border-slate-700 text-[#073b4c]/50 dark:text-[#737373] hover:border-[#073b4c]/30 dark:hover:border-slate-600 hover:bg-[#f0f4f8] dark:hover:bg-[#222222]',
                            )}
                          >
                            <div className={cn(
                              'size-8 rounded-xl flex items-center justify-center',
                              active ? `${item.bg} ${item.id === 'feature' ? 'text-[#073b4c]' : 'text-white'}` : 'bg-[#f0f4f8] dark:bg-[#2a2a2a]',
                            )}>
                              <item.icon className="size-4" style={active ? {} : { color: item.color }} />
                            </div>
                            <span className={active ? 'text-[#073b4c] dark:text-[#f0f0f0]' : ''}>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Textarea */}
                    <textarea
                      placeholder={
                        type === 'bug' ? 'What happened? How can we reproduce it?' :
                        type === 'feature' ? 'What would you like to see? How would it help?' :
                        "What's on your mind?"
                      }
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={4}
                      className="w-full resize-none rounded-2xl border-[3px] border-[#073b4c]/15 dark:border-[#333333] bg-[#f0f4f8] dark:bg-[#1a1a1a] px-4 py-3 text-sm font-medium text-[#073b4c] dark:text-[#f0f0f0] placeholder:text-[#073b4c]/40 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#073b4c] dark:focus:border-slate-400 transition-colors"
                    />

                    {/* Screenshot */}
                    {screenshot ? (
                      <div className="relative rounded-2xl overflow-hidden border-[3px] border-[#073b4c]/15 dark:border-[#333333]">
                        <img src={screenshot} alt="Screenshot" className="w-full h-auto max-h-[150px] object-contain bg-black/5" />
                        <button
                          onClick={() => setScreenshot(null)}
                          className="absolute top-2 right-2 size-6 rounded-full bg-[#ef476f] border-2 border-[#073b4c] flex items-center justify-center text-white shadow-[2px_2px_0_#073b4c]"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={captureScreenshot}
                        disabled={isCapturing}
                        className="w-full h-14 rounded-2xl border-[3px] border-dashed border-[#073b4c]/15 dark:border-[#333333] flex items-center justify-center gap-2 text-xs font-bold text-[#073b4c]/40 dark:text-[#737373] hover:border-[#073b4c]/30 dark:hover:border-slate-500 hover:bg-[#f0f4f8] dark:hover:bg-[#222222] transition-all disabled:opacity-50"
                      >
                        {isCapturing ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                        {isCapturing ? 'Capturing…' : 'Attach screenshot (optional)'}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              {!isSuccess && (
                <div className="flex items-center gap-3 px-5 pb-5">
                  <button
                    onClick={close}
                    disabled={isSubmitting}
                    className="flex-1 h-10 rounded-2xl border-[3px] border-[#073b4c]/20 dark:border-[#333333] text-sm font-bold text-[#073b4c]/60 dark:text-[#a3a3a3] hover:bg-[#f0f4f8] dark:hover:bg-[#222222] transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !content.trim()}
                    className="flex-1 h-10 rounded-2xl border-[3px] border-[#073b4c] dark:border-slate-500 bg-[#073b4c] dark:bg-[#ef476f] text-white text-sm font-black shadow-[3px_3px_0_rgba(7,59,76,0.25)] hover:shadow-[5px_5px_0_rgba(7,59,76,0.25)] hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <><Loader2 className="size-4 animate-spin" /> Sending…</> : 'Submit'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (!portalReady) return null;
  return createPortal(overlay, document.body);
}
