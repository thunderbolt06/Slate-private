'use client';

import { useEffect, useState } from 'react';
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

// NEW-005: Old courses can land in this component with a `gen_img_xxx`
// placeholder src and no associated task in the in-memory store (the original
// generation finished long ago and the result URL is no longer reachable, or
// the task was cleared). The skeleton paintbrush UI is otherwise shown
// indefinitely. After this many ms with no task progress we switch to a
// clearer "image unavailable" state so the slide doesn't look perpetually
// stuck mid-generation. 4s is enough time for legitimate in-progress tasks
// to register while keeping the wait short for orphaned/broken URLs.
const STALE_PLACEHOLDER_MS = 4_000;

export interface BaseImageElementProps {
  elementInfo: PPTImageElement;
}

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
  const showDisabled = isPlaceholder && !task && !imageGenerationEnabled;

  // NEW-005: track an "orphaned placeholder" - the slide carries a
  // gen_img_xxx src but no task ever appears in the store (old course where
  // the original image is gone). Flip to a stale state after a grace period
  // so we render an "Image unavailable" treatment instead of the indefinite
  // paintbrush skeleton.
  const noTaskYet = isPlaceholder && !task && !showDisabled && imageGenerationEnabled;
  const [staleOrphan, setStaleOrphan] = useState(false);
  // React-blessed "reset state on prop change" pattern: when the source or
  // task-presence changes, drop the stale flag synchronously during render
  // so the timer below restarts from a clean slate. Setting state during
  // render with the same value is bailed out, so this is cheap.
  const orphanKey = `${elementInfo.src}|${noTaskYet}`;
  const [trackedOrphanKey, setTrackedOrphanKey] = useState(orphanKey);
  if (trackedOrphanKey !== orphanKey) {
    setTrackedOrphanKey(orphanKey);
    setStaleOrphan(false);
  }
  useEffect(() => {
    if (!noTaskYet) return undefined;
    const timer = setTimeout(() => setStaleOrphan(true), STALE_PLACEHOLDER_MS);
    return () => clearTimeout(timer);
  }, [noTaskYet, elementInfo.src]);

  const showSkeleton =
    isPlaceholder &&
    !showDisabled &&
    !staleOrphan &&
    (!task || task.status === 'pending' || task.status === 'generating');
  const showError = (isPlaceholder && task?.status === 'failed') || staleOrphan;
  // BUG-002: track the first paint of a real image src so we can show a
  // subtle skeleton instead of a blank gap during the 5-10s URL fetch.
  const [imgLoaded, setImgLoaded] = useState(false);
  // NEW-005: track load failures for real (non-placeholder) URLs — e.g. a
  // truncated Supabase URL that returns nothing. Show "Image unavailable"
  // instead of an invisible broken-image icon.
  const [imgError, setImgError] = useState(false);
  const [trackedSrc, setTrackedSrc] = useState(resolvedSrc);
  if (trackedSrc !== resolvedSrc) {
    setTrackedSrc(resolvedSrc);
    setImgLoaded(false);
    setImgError(false);
  }
  const showImgLoadingOverlay = !!resolvedSrc && !isPlaceholder && !imgLoaded && !imgError;

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
                ) : staleOrphan && !task ? (
                  // NEW-005: orphaned placeholder with no recoverable task.
                  // Surface a clear "image unavailable" message rather than
                  // the indefinite paintbrush.
                  <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                    <ImageOff className="w-3 h-3 shrink-0" />
                    <span>Image unavailable</span>
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
            ) : resolvedSrc && !imgError ? (
              <>
                {/* BUG-002: subtle pulse while the real URL is being
                    fetched (5-10s on first paint), instead of a blank box. */}
                {showImgLoadingOverlay && (
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-50/80 via-orange-50/50 to-yellow-50/70 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-yellow-950/15 animate-pulse" />
                )}
                <img
                  src={resolvedSrc}
                  draggable={false}
                  loading="lazy"
                  style={{
                    position: 'absolute',
                    top: imgPosition.top,
                    left: imgPosition.left,
                    width: imgPosition.width,
                    height: imgPosition.height,
                    filter,
                    opacity: showImgLoadingOverlay ? 0 : 1,
                    transition: 'opacity 200ms ease-out',
                  }}
                  alt=""
                  onLoad={() => setImgLoaded(true)}
                  onError={() => { setImgLoaded(true); setImgError(true); }}
                  onDragStart={(e) => e.preventDefault()}
                />
                {elementInfo.colorMask && (
                  <div
                    className="absolute inset-0"
                    style={{ backgroundColor: elementInfo.colorMask }}
                  />
                )}
              </>
            ) : imgError ? (
              // NEW-005: real URL failed to load (e.g. truncated Supabase URL)
              <div className="w-full h-full bg-gray-50 dark:bg-gray-900/30 flex items-center justify-center">
                <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                  <ImageOff className="w-3 h-3 shrink-0" />
                  <span>Image unavailable</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
