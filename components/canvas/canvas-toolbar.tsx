'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  PencilLine,
  LayoutList,
  MessageSquare,
  Volume1,
  Volume2,
  VolumeX,
  Maximize2,
  Home,
  Video,
  Loader2,
  Square,
  Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStageStore } from '@/lib/store';
import { useI18n } from '@/lib/hooks/use-i18n';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PLAYBACK_SPEEDS } from '@/lib/store/settings';

export interface CanvasToolbarProps {
  readonly currentSceneIndex: number;
  readonly scenesCount: number;
  readonly engineState: 'idle' | 'playing' | 'paused';
  readonly isLiveSession?: boolean;
  readonly whiteboardOpen: boolean;
  readonly sidebarCollapsed?: boolean;
  readonly chatCollapsed?: boolean;
  readonly onToggleSidebar?: () => void;
  readonly onToggleChat?: () => void;
  readonly onPrevSlide: () => void;
  readonly onNextSlide: () => void;
  readonly onPlayPause: () => void;
  readonly onWhiteboardClose: () => void;
  readonly showStopDiscussion?: boolean;
  readonly onStopDiscussion?: () => void;
  readonly isPresenting?: boolean;
  readonly onTogglePresentation?: () => void;
  readonly className?: string;
  // Audio/playback controls
  readonly ttsEnabled?: boolean;
  readonly ttsMuted?: boolean;
  readonly ttsVolume?: number;
  readonly onToggleMute?: () => void;
  readonly onVolumeChange?: (volume: number) => void;
  readonly playbackSpeed?: number;
  readonly onCycleSpeed?: () => void;
  readonly onHome?: () => void;
  // Admin-only
  readonly isAdmin?: boolean;
  // Video export
  readonly onExportVideo?: () => void;
  readonly onAbortExport?: () => void;
  readonly isExporting?: boolean;
  readonly exportProgress?: { sceneIndex: number; sceneTotal: number } | null;
}

/* Compact control button */
const ctrlBtn = cn(
  'relative w-8 h-8 sm:w-7 sm:h-7 rounded-md flex items-center justify-center',
  'transition-all duration-150 outline-none cursor-pointer',
  'hover:bg-gray-500/[0.08] dark:hover:bg-gray-400/[0.08] active:scale-90',
);

/* Subtle separator */
function CtrlDivider() {
  return <div className="w-px h-3 bg-gray-200/80 dark:bg-gray-700/60 mx-0.5 shrink-0" />;
}

/* Volume icon based on level */
function VolumeIcon({
  muted,
  volume,
  disabled,
}: {
  muted: boolean;
  volume: number;
  disabled: boolean;
}) {
  const cls = 'w-4 h-4 sm:w-3.5 sm:h-3.5';
  if (disabled || muted || volume === 0) return <VolumeX className={cls} />;
  if (volume < 0.5) return <Volume1 className={cls} />;
  return <Volume2 className={cls} />;
}

export function CanvasToolbar({
  currentSceneIndex,
  scenesCount,
  engineState,
  isLiveSession,
  whiteboardOpen,
  sidebarCollapsed,
  chatCollapsed,
  onToggleSidebar,
  onToggleChat,
  onPrevSlide,
  onNextSlide,
  onPlayPause,
  onWhiteboardClose,
  showStopDiscussion,
  onStopDiscussion,
  isPresenting,
  onTogglePresentation,
  className,
  ttsEnabled,
  ttsMuted,
  ttsVolume = 1,
  onToggleMute,
  onVolumeChange,
  playbackSpeed = 1,
  onCycleSpeed,
  onHome,
  isAdmin,
  onExportVideo,
  onAbortExport,
  isExporting,
  exportProgress,
}: CanvasToolbarProps) {
  const { t } = useI18n();
  const canGoPrev = currentSceneIndex > 0;
  // Allow "Next" on the last slide to trigger the congratulations flow
  const canGoNext = true;
  const showPlayPause = !isLiveSession;

  const whiteboardElementCount = useStageStore(
    (s) => s.stage?.whiteboard?.[0]?.elements?.length || 0,
  );

  // Home confirmation dialog state
  const [homeConfirmOpen, setHomeConfirmOpen] = useState(false);

  // Volume slider hover state
  const [volumeHover, setVolumeHover] = useState(false);
  const volumeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const volumeContainerRef = useRef<HTMLDivElement>(null);

  const handleVolumeEnter = useCallback(() => {
    clearTimeout(volumeTimerRef.current);
    setVolumeHover(true);
  }, []);

  const handleVolumeLeave = useCallback(() => {
    volumeTimerRef.current = setTimeout(() => setVolumeHover(false), 300);
  }, []);

  // Cleanup volume hover timer on unmount
  useEffect(() => () => clearTimeout(volumeTimerRef.current), []);

  // Effective volume for display
  const effectiveVolume = ttsMuted ? 0 : ttsVolume;
  const presentationLabel = isPresenting ? t('stage.exitFullscreen') : t('stage.fullscreen');

  const hasSettingsItems = !!(onCycleSpeed || onToggleChat);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* ── Left: sidebar toggle + page indicator ── */}
      <div className="flex items-center gap-1 shrink-0 pl-1">
        {onHome && (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setHomeConfirmOpen(true)}
                    className={cn(ctrlBtn, 'text-gray-500 hover:text-purple-600')}
                  >
                    <Home className="w-4 h-4 sm:w-4 sm:h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{t('common.home') || 'Home'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <AlertDialog open={homeConfirmOpen} onOpenChange={setHomeConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Leave classroom?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You can return to the home page or continue your current classroom session.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Continue classroom</AlertDialogCancel>
                  <AlertDialogAction onClick={onHome}>Go home</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={cn(
              ctrlBtn,
              'hidden sm:flex',
              sidebarCollapsed
                ? 'text-gray-400 dark:text-gray-500'
                : 'text-gray-600 dark:text-gray-300',
            )}
            aria-label="Toggle sidebar"
          >
            <LayoutList className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
        )}
        <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums select-none font-medium px-1">
          {currentSceneIndex + 1}
          <span className="opacity-35 mx-px">/</span>
          {scenesCount}
        </span>
      </div>

      <div className="hidden sm:block">
        <CtrlDivider />
      </div>

      {/* ── Center: unified playback controls ── */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        <div
          className={cn(
            'inline-flex items-center gap-0.5 px-1 h-8 sm:h-7',
            isPresenting
              ? '' /* Single visual layer in fullscreen - buttons sit inside outer pill directly */
              : 'bg-gray-100/60 dark:bg-gray-800/60 rounded-lg',
          )}
        >
          {/* Volume with vertical popover slider */}
          {onToggleMute && (
            <div
              ref={volumeContainerRef}
              className="relative flex items-center"
              onMouseEnter={handleVolumeEnter}
              onMouseLeave={handleVolumeLeave}
            >
              <button
                onClick={onToggleMute}
                disabled={!ttsEnabled}
                className={cn(
                  ctrlBtn,
                  !ttsEnabled
                    ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                    : ttsMuted
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-gray-500 dark:text-gray-400',
                )}
                aria-label={ttsMuted ? 'Unmute' : 'Mute'}
              >
                <VolumeIcon muted={!!ttsMuted} volume={ttsVolume} disabled={!ttsEnabled} />
              </button>

              {/* Vertical volume slider (pops up above) */}
              <div
                className={cn(
                  'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-col items-center',
                  'transition-all duration-200 ease-out pointer-events-none opacity-0',
                  volumeHover && ttsEnabled && 'pointer-events-auto opacity-100',
                )}
              >
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-2 py-2.5 flex flex-col items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums font-medium select-none">
                    {Math.round(effectiveVolume * 100)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={effectiveVolume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      onVolumeChange?.(v);
                      if (v > 0 && ttsMuted) onToggleMute?.();
                    }}
                    className={cn(
                      'appearance-none cursor-pointer',
                      'h-16 w-1 rounded-full',
                      'bg-gray-200 dark:bg-gray-600',
                      '[writing-mode:vertical-lr] [direction:rtl]',
                      '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3',
                      '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:dark:bg-violet-400',
                      '[&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer',
                      '[&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3',
                      '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-violet-500 [&::-moz-range-thumb]:border-0',
                    )}
                  />
                </div>
                {/* Arrow pointing down */}
                <div className="w-2 h-2 bg-white dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 rotate-45 -mt-[5px]" />
              </div>
            </div>
          )}

          <CtrlDivider />

          {/* Prev scene */}
          {scenesCount > 1 && (
            <button
              onClick={onPrevSlide}
              disabled={!canGoPrev}
              className={cn(
                ctrlBtn,
                'text-gray-500 dark:text-gray-400 disabled:opacity-20 disabled:pointer-events-none',
              )}
              aria-label="Previous scene"
            >
              <ChevronLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>
          )}

          {/* Play / Pause / Stop Discussion */}
          {showStopDiscussion && onStopDiscussion ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStopDiscussion();
              }}
              className={cn(
                'flex items-center gap-1.5 h-7 sm:h-6 px-2.5 rounded-md',
                'bg-red-500/10 dark:bg-red-400/10 text-red-600 dark:text-red-400',
                'text-[11px] font-semibold whitespace-nowrap',
                'hover:bg-red-500/20 dark:hover:bg-red-400/20 active:scale-95 transition-all cursor-pointer',
              )}
              title={t('roundtable.stopDiscussion')}
            >
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
              </span>
              {t('roundtable.stopDiscussion')}
            </button>
          ) : showPlayPause ? (
            <button
              onClick={onPlayPause}
              className={cn(
                ctrlBtn,
                engineState === 'playing'
                  ? 'text-violet-600 dark:text-violet-400'
                  : 'text-gray-500 dark:text-gray-400',
              )}
              aria-label={engineState === 'playing' ? 'Pause' : 'Play'}
            >
              {engineState === 'playing' ? (
                <Pause className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              ) : (
                <Play className="w-4 h-4 sm:w-3.5 sm:h-3.5 ml-px" />
              )}
            </button>
          ) : null}

          {/* Next scene */}
          {scenesCount > 1 && (
            <button
              onClick={onNextSlide}
              disabled={!canGoNext}
              className={cn(
                ctrlBtn,
                'text-gray-500 dark:text-gray-400 disabled:opacity-20 disabled:pointer-events-none',
              )}
              aria-label="Next scene"
            >
              <ChevronRight className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Right: settings popover + fullscreen + export ── */}
      <div className="flex items-center justify-end gap-px shrink-0 pr-1">
        <div className="hidden sm:block">
          <CtrlDivider />
        </div>

        {/* Settings popover - speed, whiteboard, chat */}
        {hasSettingsItems && (
          <Popover>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        ctrlBtn,
                        (whiteboardOpen || !chatCollapsed || playbackSpeed !== 1)
                          ? 'text-violet-600 dark:text-violet-400'
                          : 'text-gray-500 dark:text-gray-400',
                      )}
                      aria-label="Settings"
                    >
                      <Settings2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Settings
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <PopoverContent
              side="top"
              align="end"
              sideOffset={8}
              className="w-48 p-2 space-y-1"
            >
              {/* Speed */}
              {onCycleSpeed && (
                <div className="flex items-center justify-between px-1 py-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Speed</span>
                  <button
                    onClick={onCycleSpeed}
                    className={cn(
                      'h-6 px-2.5 rounded-md',
                      'text-[11px] font-semibold tabular-nums leading-none',
                      'transition-all duration-150 cursor-pointer active:scale-90',
                      playbackSpeed !== 1
                        ? 'text-violet-600 dark:text-violet-400 bg-violet-500/10 dark:bg-violet-400/10'
                        : 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
                    )}
                  >
                    {playbackSpeed === 1.5 ? '1.5×' : `${playbackSpeed}×`}
                  </button>
                </div>
              )}

              {/* Whiteboard */}
              {(whiteboardOpen || whiteboardElementCount > 0) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onWhiteboardClose();
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-1 py-1 rounded-md',
                    'text-xs transition-colors cursor-pointer',
                    'hover:bg-gray-100 dark:hover:bg-gray-700',
                    whiteboardOpen
                      ? 'text-violet-600 dark:text-violet-400'
                      : 'text-gray-600 dark:text-gray-300',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <PencilLine className="w-3.5 h-3.5" />
                    {t('whiteboard.open') || 'Whiteboard'}
                  </span>
                  <div className="relative">
                    <div
                      className={cn(
                        'w-7 h-4 rounded-full transition-colors',
                        whiteboardOpen ? 'bg-violet-500' : 'bg-gray-200 dark:bg-gray-600',
                      )}
                    />
                    <div
                      className={cn(
                        'absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform',
                        whiteboardOpen ? 'translate-x-3.5' : 'translate-x-0.5',
                      )}
                    />
                    {!whiteboardOpen && whiteboardElementCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-violet-500 dark:bg-violet-400 rounded-full" />
                    )}
                  </div>
                </button>
              )}

              {/* Chat */}
              {onToggleChat && (
                <button
                  onClick={onToggleChat}
                  className={cn(
                    'w-full flex items-center justify-between px-1 py-1 rounded-md',
                    'text-xs transition-colors cursor-pointer',
                    'hover:bg-gray-100 dark:hover:bg-gray-700',
                    !chatCollapsed
                      ? 'text-violet-600 dark:text-violet-400'
                      : 'text-gray-600 dark:text-gray-300',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Chat
                  </span>
                  <div className="relative">
                    <div
                      className={cn(
                        'w-7 h-4 rounded-full transition-colors',
                        !chatCollapsed ? 'bg-violet-500' : 'bg-gray-200 dark:bg-gray-600',
                      )}
                    />
                    <div
                      className={cn(
                        'absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform',
                        !chatCollapsed ? 'translate-x-3.5' : 'translate-x-0.5',
                      )}
                    />
                  </div>
                </button>
              )}
            </PopoverContent>
          </Popover>
        )}

        {onTogglePresentation && !isPresenting && (
          <button
            onClick={onTogglePresentation}
            className={cn(
              ctrlBtn,
              'text-gray-500 dark:text-gray-400',
            )}
            aria-label={presentationLabel}
            title={presentationLabel}
          >
            <Maximize2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
        )}

        {/* Export to MP4 / Stop & save - admin only */}
        {isAdmin && (onExportVideo || onAbortExport) && (
          <>
            <CtrlDivider />
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  {isExporting ? (
                    /* ── Exporting: show progress spinner + stop button ── */
                    <div className="flex items-center gap-0.5">
                      <Loader2 className="w-3 h-3 text-violet-500 dark:text-violet-400 animate-spin shrink-0" />
                      {exportProgress && (
                        <span className="text-[10px] tabular-nums text-violet-500 dark:text-violet-400 font-semibold leading-none min-w-[20px]">
                          {exportProgress.sceneIndex}/{exportProgress.sceneTotal}
                        </span>
                      )}
                      <button
                        onClick={onAbortExport}
                        className={cn(
                          ctrlBtn,
                          'ml-0.5 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300',
                        )}
                        aria-label="Stop and save partial video"
                      >
                        <Square className="w-3 h-3 fill-current" />
                      </button>
                    </div>
                  ) : (
                    /* ── Idle: start export ── */
                    <button
                      onClick={onExportVideo}
                      className={cn(ctrlBtn, 'text-gray-500 dark:text-gray-400')}
                      aria-label="Export to MP4"
                    >
                      <Video className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </button>
                  )}
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {isExporting && exportProgress
                    ? `Exporting ${exportProgress.sceneIndex}/${exportProgress.sceneTotal} - click ■ to stop & save`
                    : 'Export to MP4'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
      </div>
    </div>
  );
}
