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

// NEW-005: How long the loading skeleton may show without a task being
// enqueued before we treat the image as abandoned. For older courses where
// generation never completed (or its result was lost), the placeholder paint-
// brush previously stayed up forever — this caps it.
const ABANDONED_PLACEHOLDER_TIMEOUT_MS = 10_000;

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

  // NEW-005: track real-image load failures (expired/deleted URLs) so we can
  // show a graceful fallback instead of a broken-image icon. Reset using the
  // "adjust state during render" pattern keyed on src — avoids the
  // setState-in-useEffect anti-pattern.
  const [imgLoadFailed, setImgLoadFailed] = useState(false);
  const [trackedSrc, setTrackedSrc] = useState(resolvedSrc);
  if (trackedSrc !== resolvedSrc) {
    setTrackedSrc(resolvedSrc);
    setImgLoadFailed(false);
  }

  // NEW-005: if the src is a placeholder ID but no generation task ever gets
  // enqueued (older course where generation was abandoned or its result was
  // lost), treat the image as unavailable after a short timeout instead of
  // showing the loading skeleton indefinitely. Reset via render-time state
  // adjustment when the placeholder/task identity changes.
  const [abandoned, setAbandoned] = useState(false);
  const watchKey = isPlaceholder && !task ? 'waiting' : 'resolved';
  const [trackedWatchKey, setTrackedWatchKey] = useState(watchKey);
  if (trackedWatchKey !== watchKey) {
    setTrackedWatchKey(watchKey);
    setAbandoned(false);
  }
  useEffect(() => {
    if (watchKey !== 'waiting') return;
    const handle = window.setTimeout(() => setAbandoned(true), ABANDONED_PLACEHOLDER_TIMEOUT_MS);
    return () => window.clearTimeout(handle);
  }, [watchKey]);

  const showDisabled = isPlaceholder && !task && !imageGenerationEnabled;
  const showSkeleton =
    isPlaceholder &&
    !showDisabled &&
    !abandoned &&
    (!task || task.status === 'pending' || task.status === 'generating');
  const showAbandoned = isPlaceholder && !task && abandoned && !showDisabled;
  const showError = (isPlaceholder && task?.status === 'failed') || imgLoadFailed;

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
            ) : showAbandoned ? (
              <div className="w-full h-full bg-gray-50 dark:bg-gray-900/30 flex flex-col items-center justify-center gap-1.5">
                <ImageOff className="w-5 h-5 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 px-2 text-center">
                  {t('settings.mediaUnavailable')}
                </span>
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
                ) : imgLoadFailed && !task ? (
                  // Real URL that failed to load (expired or deleted).
                  <div className="flex flex-col items-center gap-1">
                    <ImageOff className="w-5 h-5 text-red-400 dark:text-red-500" strokeWidth={1.5} />
                    <span className="text-[10px] font-medium text-red-500 dark:text-red-400 px-2 text-center">
                      {t('settings.mediaUnavailable')}
                    </span>
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
                  onError={() => setImgLoadFailed(true)}
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
