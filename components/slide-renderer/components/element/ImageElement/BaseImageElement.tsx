'use client';

import type { PPTImageElement } from '@/lib/types/slides';
import { useElementShadow } from '../hooks/useElementShadow';
import { useElementFlip } from '../hooks/useElementFlip';
import { useClipImage } from './useClipImage';
import { useFilter } from './useFilter';
import { ImageOutline } from './ImageOutline';
import { useMediaGenerationStore, isMediaPlaceholder } from '@/lib/store/media-generation';
import { useSettingsStore } from '@/lib/store/settings';
import { useMediaStageId } from '@/lib/contexts/media-stage-context';
import { retryMediaTask } from '@/lib/media/media-orchestrator';
import { RotateCcw, Paintbrush, ShieldAlert, ImageOff } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useEffect, useState } from 'react';

export interface BaseImageElementProps {
  elementInfo: PPTImageElement;
}

// After this long with no observable progress on a placeholder, treat the image
// as broken and show an actionable error UI instead of a forever-skeleton.
// NEW-005 surfaced classrooms where the original generation never completed —
// the slide ships with a `gen_img_N` placeholder, no task is ever enqueued
// (the course is loaded fresh from storage, not from a generation flow), so
// the skeleton spins indefinitely. This timeout converts that into an
// "image unavailable" state the user can dismiss or retry.
const PLACEHOLDER_STUCK_TIMEOUT_MS = 30_000;

// Same idea for resolved URLs that 404 / fail to load (e.g. expired blob storage
// URLs for older courses) — see NEW-005.
type ImgLoadStatus = 'pending' | 'loaded' | 'errored';

/**
 * Base image element component for read-only display
 */
export function BaseImageElement({ elementInfo }: BaseImageElementProps) {
  const { t } = useI18n();
  const { shadowStyle } = useElementShadow(elementInfo.shadow);
  const { flipStyle } = useElementFlip(elementInfo.flipH, elementInfo.flipV);
  const { clipShape, imgPosition } = useClipImage(elementInfo);
  const { filter } = useFilter(elementInfo.filters);

  // Only subscribe to media store when inside a classroom (stageId provided via context).
  // Homepage thumbnails have no stageId context → skip store to prevent cross-course contamination.
  const stageId = useMediaStageId();
  const isPlaceholder = !!stageId && isMediaPlaceholder(elementInfo.src);
  const task = useMediaGenerationStore((s) => {
    if (!isPlaceholder) return undefined;
    const t = s.tasks[elementInfo.src];
    // Only use task if it belongs to the current stage
    if (t && t.stageId !== stageId) return undefined;
    return t;
  });

  const imageGenerationEnabled = useSettingsStore((s) => s.imageGenerationEnabled);
  // Resolve actual src: use objectUrl from store if available, otherwise original src
  const resolvedSrc = task?.status === 'done' && task.objectUrl ? task.objectUrl : elementInfo.src;

  // Track whether a placeholder skeleton has been spinning longer than the
  // stuck-timeout. We only arm the timer for "no task at all" placeholders,
  // since active generations report progress via task.status transitions.
  // The `lastStuckKey` / derived-state pattern resets `stuck` when the
  // placeholder identity changes without setState-in-effect.
  const placeholderHasNoTask = isPlaceholder && !task;
  const stuckKey = `${placeholderHasNoTask ? 'p' : '_'}::${elementInfo.src}`;
  const [stuck, setStuck] = useState(false);
  const [lastStuckKey, setLastStuckKey] = useState(stuckKey);
  if (lastStuckKey !== stuckKey) {
    setLastStuckKey(stuckKey);
    setStuck(false);
  }
  useEffect(() => {
    if (!placeholderHasNoTask) return;
    const id = setTimeout(() => setStuck(true), PLACEHOLDER_STUCK_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [placeholderHasNoTask, elementInfo.src]);

  // Track <img> load failures (e.g. expired storage URLs). Same derived-state
  // pattern: when the src changes, reset the load status synchronously in
  // render rather than via an effect.
  const [imgLoadStatus, setImgLoadStatus] = useState<ImgLoadStatus>('pending');
  const [lastImgSrc, setLastImgSrc] = useState<string>(resolvedSrc);
  if (lastImgSrc !== resolvedSrc) {
    setLastImgSrc(resolvedSrc);
    setImgLoadStatus('pending');
  }

  const showDisabled = isPlaceholder && !task && !imageGenerationEnabled;
  // A placeholder that hasn't been claimed by any task and has been spinning
  // long enough to be considered broken: treat as error so the user gets a
  // retry / dismiss option rather than an infinite skeleton.
  const showStuckPlaceholder =
    isPlaceholder && !task && imageGenerationEnabled && stuck;
  const showSkeleton =
    isPlaceholder &&
    !showDisabled &&
    !showStuckPlaceholder &&
    (!task || task.status === 'pending' || task.status === 'generating');
  const showTaskError = isPlaceholder && task?.status === 'failed';
  // For non-placeholder srcs (already-resolved URLs), surface load failures.
  const showUrlError = !isPlaceholder && imgLoadStatus === 'errored' && !!resolvedSrc;
  const showError = showTaskError || showStuckPlaceholder || showUrlError;

  return (
    <div
      className="absolute"
      style={{
        top: `${elementInfo.top}px`,
        left: `${elementInfo.left}px`,
        width: `${elementInfo.width}px`,
        height: `${elementInfo.height}px`,
      }}
    >
      <div className="w-full h-full" style={{ transform: `rotate(${elementInfo.rotate}deg)` }}>
        <div
          className="w-full h-full relative"
          style={{
            filter: shadowStyle ? `drop-shadow(${shadowStyle})` : '',
            transform: flipStyle,
          }}
        >
          <ImageOutline elementInfo={elementInfo} />

          <div
            className="w-full h-full overflow-hidden relative"
            style={{ clipPath: clipShape.style }}
          >
            {showDisabled ? (
              <div className="w-full h-full bg-gray-50 dark:bg-gray-900/30 flex items-center justify-center">
                <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                  <ImageOff className="w-3 h-3 shrink-0" />
                  <span>{t('settings.mediaGenerationDisabled')}</span>
                </div>
              </div>
            ) : showSkeleton ? (
              <div className="w-full h-full bg-gradient-to-br from-amber-50 via-orange-50/60 to-yellow-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-yellow-950/20 flex items-center justify-center">
                <style>{`
                  @keyframes img-pulse-ring { 0%, 100% { opacity: 0.15; transform: scale(0.85); } 50% { opacity: 0.35; transform: scale(1.1); } }
                `}</style>
                <div className="relative w-12 h-12">
                  <div
                    className="absolute inset-0 rounded-full border-2 border-amber-300/40 dark:border-amber-500/30"
                    style={{
                      animation: 'img-pulse-ring 2.4s ease-in-out infinite',
                    }}
                  />
                  <Paintbrush
                    className="absolute inset-0 m-auto w-5 h-5 text-amber-400/80 dark:text-amber-500/70"
                    strokeWidth={1.5}
                  />
                </div>
              </div>
            ) : showError ? (
              <div className="w-full h-full bg-red-50 dark:bg-red-900/20 flex flex-col items-center justify-center gap-1.5">
                {task?.errorCode === 'CONTENT_SENSITIVE' ? (
                  <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    <ShieldAlert className="w-3 h-3 shrink-0" />
                    <span>{t('settings.mediaContentSensitive')}</span>
                  </div>
                ) : task?.errorCode === 'GENERATION_DISABLED' ? (
                  <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                    <ImageOff className="w-3 h-3 shrink-0" />
                    <span>{t('settings.mediaGenerationDisabled')}</span>
                  </div>
                ) : showStuckPlaceholder || showUrlError ? (
                  // No live task to retry (NEW-005: old course with a
                  // never-completed placeholder, or an expired URL). Surface
                  // a clear "image unavailable" state instead of a button
                  // that would do nothing.
                  <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-red-600 dark:text-red-400">
                    <ImageOff className="w-3 h-3 shrink-0" />
                    <span>{t('settings.mediaUnavailable')}</span>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      retryMediaTask(elementInfo.src);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 rounded hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    {t('settings.mediaRetry')}
                  </button>
                )}
              </div>
            ) : resolvedSrc ? (
              <>
                <img
                  src={resolvedSrc}
                  draggable={false}
                  style={{
                    position: 'absolute',
                    top: imgPosition.top,
                    left: imgPosition.left,
                    width: imgPosition.width,
                    height: imgPosition.height,
                    filter,
                  }}
                  alt=""
                  onDragStart={(e) => e.preventDefault()}
                  onLoad={() => setImgLoadStatus('loaded')}
                  onError={() => setImgLoadStatus('errored')}
                />
                {elementInfo.colorMask && (
                  <div
                    className="absolute inset-0"
                    style={{ backgroundColor: elementInfo.colorMask }}
                  />
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
