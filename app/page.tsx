'use client';

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  BookOpen,
  Compass,
  Trophy,
  MessageSquarePlus,
  Bell,
  User,
  Settings,
  Loader2,
  Trash2,
  Pencil,
  Clock,
  Check,
  Copy,
  ImagePlus,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  BotOff,
  Cloud,
  LogIn,
  LogOut,
  Search,
  Filter,
  Globe,
  Users,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Flame,
  Medal,
  Star,
  RefreshCw,
  MapPin,
  ChevronRight,
  Menu,
  X,
  BarChart2,
  Award,
  TrendingUp,
  ExternalLink,
  HelpCircle,
  FolderOpen,
  Folder,
  Minus,
} from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useAuth } from '@/lib/hooks/use-auth';
import { createLogger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Textarea as UITextarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SettingsDialog } from '@/components/settings';
import { GenerationToolbar } from '@/components/generation/generation-toolbar';
import { AgentBar } from '@/components/agent/agent-bar';
import { FeedbackModal } from '@/components/feedback/feedback-modal';
import { nanoid } from 'nanoid';
import { storePdfBlob } from '@/lib/utils/image-storage';
import type { UserRequirements } from '@/lib/types/generation';
import { useSettingsStore } from '@/lib/store/settings';
import { useUserProfileStore, AVATAR_OPTIONS } from '@/lib/store/user-profile';
import {
  StageListItem as LocalStageListItem,
  listStages,
  deleteStageData,
  renameStage,
  getFirstSlideByStages,
} from '@/lib/utils/stage-storage';
import { ThumbnailSlide } from '@/components/slide-renderer/components/ThumbnailSlide';
import posthog from 'posthog-js';
import type { Slide } from '@/lib/types/slides';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDraftCache } from '@/lib/hooks/use-draft-cache';
import { SpeechButton } from '@/components/audio/speech-button';
import {
  fetchUserCoursesFromSupabase,
  downloadCourseFromSupabase,
} from '@/lib/supabase/course-sync';
import { CoursesExhaustedModal } from '@/components/billing/courses-exhausted-modal';
import { setPendingIntroPayload } from '@/lib/classroom/pending-intro';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { usePlanStore } from '@/lib/store/user-plan';
import { PLAN_LIMITS } from '@/lib/stripe/plans';
import { CreateClassroomModal } from '@/components/classroom/create-classroom-modal';
import {
  ClassroomGenerationStatus,
  type ClassroomJobState,
} from '@/components/classroom/classroom-generation-status';
import { useCourseProgressStore } from '@/lib/store/course-progress';
import { useStarredCoursesStore } from '@/lib/store/starred-courses';
import { useSavedCoursesStore } from '@/lib/store/saved-courses';
import { useCourseGroupsStore, type CourseGroup } from '@/lib/store/course-groups';
import { AuthProfileModal } from '@/components/auth/auth-profile-modal';
import { HelpModal } from '@/components/help/help-modal';
import { COUNTRY_NAMES } from '@/lib/analytics/geo';
import { db } from '@/lib/utils/database';

const log = createLogger('Home');

const WEB_SEARCH_STORAGE_KEY = 'webSearchEnabled';
const LANGUAGE_STORAGE_KEY = 'generationLanguage';
const CLASSROOM_JOB_STORAGE_KEY = 'classroomJob';

export interface StageListItem extends LocalStageListItem {
  is_cloud?: boolean;
  supabase_id?: string;
}

type Tab = 'new-course' | 'my-courses' | 'browse' | 'achievements';

interface FormState {
  pdfFile: File | null;
  requirement: string;
  language: 'zh-CN' | 'en-US';
  webSearch: boolean;
}

const initialFormState: FormState = {
  pdfFile: null,
  requirement: '',
  language: 'en-US',
  webSearch: true,
};

// ── Course (Browse Courses) ────────────────────────────────────────────────
interface Course {
  id: string;
  title: string;
  headline?: string;
  description: string;
  slideCount: number;
  language: string;
  createdAt: string;
  tags: { subject?: string; age_range?: string; topic?: string; sub_topic?: string };
}

const SUBJECTS = ['All', 'Mathematics', 'Science', 'History', 'Language Arts', 'Technology', 'Art', 'Music', 'Business'];
const AGE_RANGES = ['All', '5-10', '11-14', '15-18', '18+'];
const PAGE_SIZE = 12;

// ── Leaderboard ────────────────────────────────────────────────────────────
interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string;
  total_score: number;
  quizzes_completed: number;
  country_code: string;
  rank: number;
}

// ── Sidebar ────────────────────────────────────────────────────────────────
// Inline sidebar notification row — matches sidebar item style, opens the same panel
function SidebarNotificationRow() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; type: string; title: string; body: string | null; action_url: string | null; is_read: boolean; created_at: string }[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetch$ = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/notifications?unread_only=false&limit=20', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) { setNotifications(json.notifications); setUnreadCount(json.unreadCount); }
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetch$();
    const id = setInterval(fetch$, 30_000);
    return () => clearInterval(id);
  }, [user, fetch$]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open && unreadCount > 0) {
      setUnreadCount(0);
      fetch('/api/notifications', { method: 'PATCH' }).catch(() => {});
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }
  };

  if (!user) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleOpen}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold text-sm text-[#073b4c]/60 hover:bg-[#f0f4f8] hover:text-[#073b4c] dark:text-[#a3a3a3] dark:hover:bg-[#222222] dark:hover:text-[#f0f0f0] transition-all"
      >
        <div className="relative shrink-0">
          <Bell className="size-4.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-[#ef476f] text-white text-[8px] font-black flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <span>Notifications</span>
        {unreadCount > 0 && (
          <span className="ml-auto shrink-0 size-5 rounded-full bg-[#ef476f] text-white text-[10px] font-black flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 8, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute left-full bottom-0 ml-3 w-80 bg-white dark:bg-[#1a1a1a] border-[3px] border-[#073b4c] dark:border-[#333333] rounded-2xl shadow-[6px_6px_0_#073b4c] dark:shadow-[6px_6px_0_rgba(0,0,0,0.5)] z-[300] overflow-hidden"
          >
            <div className="px-4 py-3 border-b-2 border-[#073b4c]/10 dark:border-[#2a2a2a] flex items-center justify-between">
              <span className="text-sm font-black text-[#073b4c] dark:text-[#f0f0f0] uppercase tracking-wide">Notifications</span>
              {notifications.some((n) => !n.is_read) && (
                <button className="text-[11px] font-bold text-[#ef476f] hover:underline"
                  onClick={() => {
                    fetch('/api/notifications', { method: 'PATCH' }).catch(() => {});
                    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
                    setUnreadCount(0);
                  }}>
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="size-8 text-[#073b4c]/20 dark:text-[#525252] mx-auto mb-2" />
                  <p className="text-sm font-medium text-[#073b4c]/40 dark:text-[#737373]">No notifications yet</p>
                </div>
              ) : notifications.map((n) => (
                <button key={n.id} type="button"
                  onClick={() => {
                    setOpen(false);
                    if (!n.is_read) fetch(`/api/notifications/${n.id}`, { method: 'PATCH' }).catch(() => {});
                    if (n.action_url) router.push(n.action_url);
                  }}
                  className={cn(
                    'w-full text-left px-4 py-3 flex gap-3 transition-colors border-b border-[#073b4c]/5 dark:border-[#2a2a2a] last:border-0',
                    n.is_read ? 'hover:bg-slate-50 dark:hover:bg-[#222222]' : 'bg-[#ef476f]/5 dark:bg-[#ef476f]/10 hover:bg-[#ef476f]/8 dark:hover:bg-[#ef476f]/15',
                  )}>
                  <div className={cn('shrink-0 mt-1.5 size-2 rounded-full', n.is_read ? 'bg-transparent' : 'bg-[#ef476f]')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#073b4c] dark:text-[#f0f0f0] leading-tight">{n.title}</p>
                    {n.body && <p className="text-xs text-[#073b4c]/50 dark:text-[#a3a3a3] mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-[#073b4c]/30 dark:text-[#525252] mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ClassroomSplitButtonProps {
  canGenerate: boolean;
  canInstantClassroom: boolean;
  createClassroomLoading: boolean;
  enterClassroomLoading: boolean;
  onBasicClassroom: () => void;
  onInstantClassroom: () => void;
  onUpgradeToUltra: () => void;
}

function Sidebar({
  activeTab,
  setActiveTab,
  classroomJob,
  onReopenJob,
  onClearJob,
  isAdmin,
  mobileOpen,
  onMobileClose,
}: {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  classroomJob: ClassroomJobState | null;
  onReopenJob: () => void;
  onClearJob: () => void;
  isAdmin: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const { user, loading: authLoading } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const avatar = useUserProfileStore((s) => s.avatar);
  const nickname = useUserProfileStore((s) => s.nickname);
  const router = useRouter();

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const initials = fullName
    ? fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email || '??').slice(0, 2).toUpperCase();

  const displayName = nickname || fullName || user?.email?.split('@')[0] || '';

  const navItems: { id: Tab; icon: React.ReactNode; label: string; color: string }[] = [
    { id: 'new-course', icon: <Plus className="size-5" />, label: 'New Course', color: '#8338ec' },
    { id: 'my-courses', icon: <BookOpen className="size-5" />, label: 'My Courses', color: '#118ab2' },
    { id: 'browse', icon: <Compass className="size-5" />, label: 'Browse Courses', color: '#06d6a0' },
    { id: 'achievements', icon: <Award className="size-5" />, label: 'Achievements', color: '#ffd166' },
  ];

  const handleNav = (tab: Tab) => {
    setActiveTab(tab);
    onMobileClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={onMobileClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full z-50 w-64 bg-white dark:bg-[#0d0d0d] border-r-[3px] border-[#073b4c] dark:border-[#2a2a2a] flex flex-col',
          'lg:relative lg:translate-x-0 lg:z-10',
          'transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className="px-5 pt-5 pb-4 border-b-[3px] border-[#073b4c] dark:border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-[#073b4c] flex items-center justify-center shrink-0">
                <BookOpen className="size-4 text-[#ffd166]" />
              </div>
              <span className="text-xl font-black text-[#073b4c] dark:text-[#f0f0f0] tracking-[-0.02em]">SLATE UP</span>
            </div>
            <button
              onClick={onMobileClose}
              className="lg:hidden size-7 rounded-full hover:bg-[#f0f4f8] dark:hover:bg-[#222222] flex items-center justify-center transition-colors"
            >
              <X className="size-4 text-[#073b4c] dark:text-[#a3a3a3]" />
            </button>
          </div>

          {classroomJob && (
            <div className="mt-3">
              <ClassroomGenerationStatus job={classroomJob} onReopen={onReopenJob} onClear={onClearJob} />
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all text-left',
                  active
                    ? 'bg-[#073b4c] dark:bg-[#2a2a2a] text-white dark:text-[#f0f0f0] shadow-[3px_3px_0_rgba(7,59,76,0.15)] dark:shadow-[3px_3px_0_rgba(0,0,0,0.5)]'
                    : 'text-[#073b4c]/55 hover:bg-[#f0f4f8] hover:text-[#073b4c] dark:text-[#a3a3a3] dark:hover:bg-[#222222] dark:hover:text-[#f0f0f0]',
                )}
              >
                <span className="shrink-0" style={active ? { color: 'white' } : { color: item.color }}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* ── Bottom utility section ── */}
        <div className="border-t-[3px] border-[#073b4c] dark:border-[#2a2a2a]">
          {/* Utility actions */}
          <div className="px-3 pt-2 pb-2 flex flex-col gap-0.5">
            {/* Settings — admin only */}
            {isAdmin && (
              <button
                onClick={() => setSettingsOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold text-sm text-[#073b4c]/55 hover:bg-[#f0f4f8] hover:text-[#073b4c] dark:text-[#a3a3a3] dark:hover:bg-[#222222] dark:hover:text-[#f0f0f0] transition-all"
              >
                <Settings className="size-4.5 shrink-0" />
                Settings
              </button>
            )}

            {/* Give Feedback */}
            <button
              onClick={() => setFeedbackOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold text-sm text-[#073b4c]/55 hover:bg-[#f0f4f8] hover:text-[#073b4c] dark:text-[#a3a3a3] dark:hover:bg-[#222222] dark:hover:text-[#f0f0f0] transition-all"
            >
              <MessageSquarePlus className="size-4.5 shrink-0" />
              Give Feedback
            </button>

            {/* Get Help */}
            <button
              onClick={() => setHelpOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold text-sm text-[#073b4c]/55 hover:bg-[#f0f4f8] hover:text-[#073b4c] dark:text-[#a3a3a3] dark:hover:bg-[#222222] dark:hover:text-[#f0f0f0] transition-all"
            >
              <HelpCircle className="size-4.5 shrink-0" />
              Get Help
            </button>

            {/* Notifications — custom sidebar row */}
            <SidebarNotificationRow />
          </div>

          {/* Profile card — always visible at bottom */}
          <div className="px-3 pb-4 pt-1">
            {authLoading ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[#073b4c]/10 dark:border-[#2a2a2a]">
                <div className="size-9 rounded-full bg-[#f0f4f8] dark:bg-[#2a2a2a] animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 bg-[#f0f4f8] dark:bg-[#2a2a2a] rounded-full animate-pulse" />
                  <div className="h-2.5 w-32 bg-[#f0f4f8] dark:bg-[#2a2a2a] rounded-full animate-pulse" />
                </div>
              </div>
            ) : user ? (
              <button
                onClick={() => setProfileOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[#073b4c]/10 hover:border-[#073b4c]/30 hover:bg-[#f8f9fa] dark:border-[#2a2a2a] dark:hover:border-[#4a4a4a] dark:hover:bg-[#222222] transition-all group"
              >
                {/* Avatar */}
                <div className="size-9 rounded-full border-2 border-[#073b4c]/20 group-hover:border-[#073b4c]/50 dark:border-[#333333] overflow-hidden shrink-0 transition-all">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="size-full bg-gradient-to-br from-[#118AB2] to-[#06D6A0] flex items-center justify-center">
                      <span className="text-[11px] font-black text-white">{initials}</span>
                    </div>
                  )}
                </div>

                {/* Name + email */}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-bold text-[#073b4c] dark:text-[#f0f0f0] truncate leading-tight">
                    {displayName || 'My Profile'}
                  </p>
                  <p className="text-[11px] text-[#073b4c]/40 dark:text-[#737373] truncate leading-tight mt-0.5">
                    {user.email}
                  </p>
                </div>

                {/* Chevron */}
                <ChevronRight className="size-3.5 text-[#073b4c]/25 group-hover:text-[#073b4c]/50 dark:text-[#525252] dark:group-hover:text-slate-400 shrink-0 transition-colors" />
              </button>
            ) : (
              <button
                onClick={() => router.push('/auth/login')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-[#073b4c]/15 hover:border-[#073b4c] hover:bg-[#073b4c] hover:text-white transition-all group font-bold text-sm text-[#073b4c]/60"
              >
                <div className="size-9 rounded-full border-2 border-[#073b4c]/20 group-hover:border-white/30 bg-[#f0f4f8] group-hover:bg-white/10 flex items-center justify-center shrink-0 transition-all">
                  <User className="size-4 text-[#073b4c]/40 group-hover:text-white transition-colors" />
                </div>
                <span className="flex-1 text-left">Sign In</span>
                <LogIn className="size-4 shrink-0 opacity-40 group-hover:opacity-80 transition-opacity" />
              </button>
            )}
          </div>
        </div>
      </aside>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AuthProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}

// ── Classroom Split Button ─────────────────────────────────────────────────
function ClassroomSplitButton({
  canGenerate,
  canInstantClassroom,
  createClassroomLoading,
  enterClassroomLoading,
  onBasicClassroom,
  onInstantClassroom,
  onUpgradeToUltra,
}: ClassroomSplitButtonProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isLoading = createClassroomLoading || enterClassroomLoading;

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const active = canGenerate && !isLoading;

  if (!canInstantClassroom) {
    return (
      <div ref={containerRef} className="relative shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'flex items-center h-10 rounded-full border-2 overflow-hidden transition-all duration-200',
                active
                  ? 'border-[#073b4c] dark:border-[#333333] bg-[#8338ec] text-[#fff0db] shadow-[3px_3px_0_#073b4c] dark:shadow-[3px_3px_0_rgba(0,0,0,0.5)] hover:-translate-y-px hover:shadow-[4px_4px_0_#073b4c]'
                  : 'border-[#073b4c]/20 dark:border-[#2a2a2a] bg-[#f0f4f8] dark:bg-[#1a1a1a] text-[#073b4c]/30 dark:text-[#525252]',
                isLoading && 'opacity-80',
              )}
            >
              <button
                type="button"
                onClick={onBasicClassroom}
                disabled={!active}
                className="h-full pl-5 pr-3 flex items-center gap-2 font-bold cursor-pointer disabled:cursor-not-allowed"
              >
                <span className="text-xs font-bold">Basic Classroom</span>
                {createClassroomLoading ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Clock className="size-3.5" aria-hidden />
                )}
              </button>
              <div className={cn('w-px h-5 shrink-0', active ? 'bg-white/20' : 'bg-[#073b4c]/10')} />
              <button
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                disabled={isLoading}
                className="h-full w-9 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                aria-label="More classroom options"
              >
                <ChevronDown className={cn('size-3.5 transition-transform', dropdownOpen && 'rotate-180')} aria-hidden />
              </button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            {canGenerate ? (
              <p className="text-xs">Generate in the background — ready in 3–5 min</p>
            ) : (
              <p className="text-xs">Write a prompt above to get started</p>
            )}
          </TooltipContent>
        </Tooltip>
        {dropdownOpen && (
          <div className="absolute right-0 top-12 z-50 min-w-[210px] rounded-2xl border-2 border-[#073b4c]/10 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] shadow-[4px_4px_0_rgba(7,59,76,0.08)] dark:shadow-[4px_4px_0_rgba(0,0,0,0.5)] overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                onUpgradeToUltra();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#fffdf0] dark:hover:bg-[#222222] transition-colors cursor-pointer"
            >
              <span className="size-5 rounded-md bg-amber-100 flex items-center justify-center shrink-0 text-[11px]">⚡</span>
              <div className="text-left">
                <p className="font-semibold text-[#073b4c] dark:text-[#f0f0f0] text-xs flex items-center gap-1.5">
                  Instant Classroom
                  <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-[#ffd166] text-[#073b4c] uppercase tracking-wide">Ultra</span>
                </p>
                <p className="text-[10px] text-[#073b4c]/40 dark:text-[#737373]">Streams live · upgrade to unlock</p>
              </div>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center h-10 rounded-full border-2 overflow-hidden transition-all duration-200',
              active
                ? 'border-[#073b4c] dark:border-[#333333] bg-[#ffd166] text-[#073b4c] shadow-[3px_3px_0_#073b4c] dark:shadow-[3px_3px_0_rgba(0,0,0,0.5)] hover:-translate-y-px hover:shadow-[4px_4px_0_#073b4c]'
                : 'border-[#073b4c]/20 dark:border-[#2a2a2a] bg-[#f0f4f8] dark:bg-[#1a1a1a] text-[#073b4c]/30 dark:text-[#525252]',
              isLoading && 'opacity-80',
            )}
          >
            {/* Primary action — Instant Classroom */}
            <button
              type="button"
              onClick={onInstantClassroom}
              disabled={!active}
              aria-busy={enterClassroomLoading}
              className="h-full pl-5 pr-3 flex items-center gap-2 font-bold cursor-pointer disabled:cursor-not-allowed"
            >
              <span className="text-xs font-bold">Instant Classroom</span>
              {enterClassroomLoading ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <ArrowUp className="size-3.5" aria-hidden />
              )}
            </button>
            {/* Divider */}
            <div className={cn('w-px h-5 shrink-0', active ? 'bg-white/20' : 'bg-[#073b4c]/10')} />
            {/* Chevron */}
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              disabled={isLoading}
              className="h-full w-9 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
              aria-label="More classroom options"
            >
              <ChevronDown className={cn('size-3.5 transition-transform', dropdownOpen && 'rotate-180')} />
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          {canGenerate ? (
            <p className="text-xs">Stream live — enter the classroom instantly</p>
          ) : (
            <p className="text-xs">Write a prompt above to get started</p>
          )}
        </TooltipContent>
      </Tooltip>

      {/* Dropdown — Standard Classroom */}
      {dropdownOpen && (
        <div className="absolute right-0 top-12 z-50 min-w-[200px] rounded-2xl border-2 border-[#073b4c]/10 bg-white shadow-[4px_4px_0_rgba(7,59,76,0.08)] overflow-hidden">
          <button
            type="button"
            onClick={() => { setDropdownOpen(false); onBasicClassroom(); }}
            disabled={!canGenerate || createClassroomLoading}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f0f4f8] transition-colors cursor-pointer disabled:opacity-50"
          >
            <Clock className="size-3.5 text-[#8338ec] shrink-0" />
            <div className="text-left">
              <p className="font-semibold text-[#073b4c] text-xs">Standard Classroom</p>
              <p className="text-[10px] text-[#073b4c]/40">Background · 3–5 min</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

// ── New Course Tab ─────────────────────────────────────────────────────────
function NewCourseTab({
  form,
  updateForm,
  handleGenerate,
  handleCreateClassroom,
  enterClassroomLoading,
  createClassroomLoading,
  canGenerate,
  canInstantClassroom,
  error,
  settingsOpen,
  setSettingsOpen,
}: {
  form: FormState;
  updateForm: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  handleGenerate: () => void;
  handleCreateClassroom: () => void;
  enterClassroomLoading: boolean;
  createClassroomLoading: boolean;
  canGenerate: boolean;
  canInstantClassroom: boolean;
  error: string | null;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { cachedValue: cachedRequirement, updateCache: updateRequirementCache } =
    useDraftCache<string>({ key: 'requirementDraft' });
  const [prevCached, setPrevCached] = useState(cachedRequirement);
  const router = useRouter();

  if (cachedRequirement !== prevCached) {
    setPrevCached(cachedRequirement);
    if (cachedRequirement && !form.requirement) {
      updateForm('requirement', cachedRequirement);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (canGenerate && !enterClassroomLoading) handleGenerate();
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-[#073b4c] dark:text-[#f0f0f0] tracking-tight mb-2">
          Create New Course
        </h1>
        <p className="text-[#073b4c]/60 dark:text-[#a3a3a3] font-medium">
          Describe what you want to learn and Slate AI will build an interactive classroom for you.
        </p>
      </div>

      {/* Agent bar */}
      <div className="mb-4 flex justify-end">
        <AgentBar />
      </div>

      {/* Input card */}
      <div className="w-full rounded-3xl border-[3px] border-[#073b4c] dark:border-[#333333] bg-white dark:bg-[#1a1a1a] shadow-[8px_8px_0_#073b4c] dark:shadow-[8px_8px_0_rgba(0,0,0,0.5)] transition-all hover:shadow-[10px_10px_0_#073b4c] dark:hover:shadow-[10px_10px_0_rgba(0,0,0,0.5)] focus-within:shadow-[10px_10px_0_#073b4c] dark:focus-within:shadow-[10px_10px_0_rgba(0,0,0,0.5)] flex flex-col pb-2">
        <textarea
          ref={textareaRef}
          placeholder={t('upload.requirementPlaceholder')}
          className="w-full resize-none border-0 bg-transparent px-5 pt-5 pb-2 text-base font-medium leading-relaxed placeholder:text-[#073b4c]/40 dark:placeholder:text-slate-500 focus:outline-none min-h-[180px] max-h-[400px] text-[#073b4c] dark:text-[#f0f0f0]"
          value={form.requirement}
          onChange={(e) => {
            updateForm('requirement', e.target.value);
            updateRequirementCache(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          rows={5}
        />
        <div className="px-4 pb-3 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <GenerationToolbar
              language={form.language}
              onLanguageChange={(lang) => updateForm('language', lang)}
              webSearch={form.webSearch}
              onWebSearchChange={(v) => updateForm('webSearch', v)}
              onSettingsOpen={() => setSettingsOpen(true)}
              pdfFile={form.pdfFile}
              onPdfFileChange={(f) => updateForm('pdfFile', f)}
              onPdfError={() => {}}
            />
          </div>
          <SpeechButton
            size="md"
            onTranscription={(text) => {
              const next = form.requirement + (form.requirement ? ' ' : '') + text;
              updateForm('requirement', next);
              updateRequirementCache(next);
            }}
          />
          <ClassroomSplitButton
            canGenerate={canGenerate}
            canInstantClassroom={canInstantClassroom}
            createClassroomLoading={createClassroomLoading}
            enterClassroomLoading={enterClassroomLoading}
            onBasicClassroom={handleCreateClassroom}
            onInstantClassroom={handleGenerate}
            onUpgradeToUltra={() => router.push('/pricing#ultra')}
          />
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 w-full p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
          >
            <p className="text-sm text-destructive">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick prompt suggestions */}
      <div className="mt-8">
        <p className="text-xs font-bold text-[#073b4c]/40 dark:text-[#525252] uppercase tracking-widest mb-3">
          Popular Topics
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            'Introduction to Machine Learning',
            'World War II History',
            'Basic Calculus for Beginners',
            'Python for Data Science',
            'Climate Change & Environment',
            'Human Anatomy Basics',
          ].map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                updateForm('requirement', prompt);
                updateRequirementCache(prompt);
                textareaRef.current?.focus();
              }}
              className="px-3 py-1.5 text-xs font-bold rounded-full border-2 border-[#073b4c]/15 dark:border-[#2a2a2a] text-[#073b4c]/60 dark:text-[#a3a3a3] hover:border-[#073b4c]/40 dark:hover:border-[#4a4a4a] hover:text-[#073b4c] dark:hover:text-[#e5e5e5] hover:bg-[#f0f4f8] dark:hover:bg-[#222222] transition-all"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Course Group Components ─────────────────────────────────────────────────

function CourseGroupFolder({
  group,
  classrooms,
  thumbnails,
  onSelectCourse,
  onRenameGroup,
  onRemoveCourse,
  onDeleteGroup,
  onDragOverGroup,
  onDropOnGroup,
  isDragOver,
}: {
  group: CourseGroup;
  classrooms: StageListItem[];
  thumbnails: Record<string, Slide>;
  onSelectCourse: (c: StageListItem) => void;
  onRenameGroup: (id: string, name: string) => void;
  onRemoveCourse: (groupId: string, courseId: string) => void;
  onDeleteGroup: (id: string) => void;
  onDragOverGroup: (e: React.DragEvent) => void;
  onDropOnGroup: (e: React.DragEvent, groupId: string) => void;
  isDragOver: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbWidth, setThumbWidth] = useState(0);

  useEffect(() => {
    const el = thumbRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setThumbWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (editing) nameRef.current?.focus();
  }, [editing]);

  const courses = group.courseIds
    .map((id) => classrooms.find((c) => c.id === id))
    .filter(Boolean) as StageListItem[];

  const previewIds = group.courseIds.slice(0, 4);

  const commitRename = () => {
    if (nameDraft.trim()) onRenameGroup(group.id, nameDraft.trim());
    setEditing(false);
  };

  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border-[3px] transition-all duration-200 overflow-hidden',
        isDragOver
          ? 'border-[#8338ec] shadow-[0_0_0_4px_rgba(131,56,236,0.2)] scale-[1.02]'
          : 'border-[#073b4c]/20 dark:border-[#333333] hover:border-[#073b4c]/50 dark:hover:border-[#4a4a4a]',
      )}
      onDragOver={onDragOverGroup}
      onDrop={(e) => onDropOnGroup(e, group.id)}
    >
      {/* Folder thumbnail grid */}
      <div
        ref={thumbRef}
        className="relative w-full aspect-[16/9] bg-gradient-to-br from-violet-50 to-purple-100 dark:from-slate-700 dark:to-slate-600 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* 2×2 thumbnail grid */}
        <div className="absolute inset-1.5 grid grid-cols-2 grid-rows-2 gap-1 rounded-xl overflow-hidden">
          {previewIds.map((id, i) => {
            const slide = thumbnails[id];
            return (
              <div key={id} className="bg-slate-200 dark:bg-slate-600 rounded-lg overflow-hidden">
                {slide && thumbWidth > 0 ? (
                  <ThumbnailSlide
                    slide={slide}
                    size={thumbWidth / 2}
                    viewportSize={slide.viewportSize ?? 1000}
                    viewportRatio={slide.viewportRatio ?? 0.5625}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="size-3 text-slate-400 dark:text-[#737373]" />
                  </div>
                )}
              </div>
            );
          })}
          {/* Empty slots if fewer than 4 */}
          {previewIds.length < 4 && Array.from({ length: 4 - previewIds.length }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-slate-100 dark:bg-[#2a2a2a] rounded-lg" />
          ))}
        </div>

        {/* Expand icon */}
        <div className="absolute top-2 right-2 size-6 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center">
          {expanded ? <FolderOpen className="size-3 text-white" /> : <Folder className="size-3 text-white" />}
        </div>

        {/* Course count */}
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/20 backdrop-blur-sm">
          <span className="text-[9px] font-black text-white uppercase tracking-wide">{group.courseIds.length} courses</span>
        </div>
      </div>

      {/* Folder name */}
      <div className="px-3 py-2.5 flex items-center gap-2">
        {editing ? (
          <input
            ref={nameRef}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
            onBlur={commitRename}
            maxLength={60}
            className="flex-1 bg-transparent border-b-2 border-[#8338ec] text-[13px] font-bold text-[#073b4c] dark:text-[#f0f0f0] outline-none"
          />
        ) : (
          <p
            className="flex-1 text-[13px] font-bold text-[#073b4c] dark:text-[#f0f0f0] truncate cursor-text"
            onClick={(e) => { e.stopPropagation(); setNameDraft(group.name); setEditing(true); }}
          >
            {group.name}
          </p>
        )}
      </div>

      {/* Expanded courses list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t-2 border-[#073b4c]/8 dark:border-[#2a2a2a]"
          >
            <div className="p-2 space-y-1">
              {courses.map((course) => (
                <div key={course.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-[#f0f4f8] dark:hover:bg-[#2a2a2a] transition-colors group">
                  <button
                    className="flex-1 text-left text-xs font-semibold text-[#073b4c] dark:text-[#e5e5e5] truncate"
                    onClick={() => onSelectCourse(course)}
                  >
                    {course.name}
                  </button>
                  <button
                    onClick={() => onRemoveCourse(group.id, course.id)}
                    className="shrink-0 size-5 rounded-full opacity-0 group-hover:opacity-100 bg-[#ef476f]/10 hover:bg-[#ef476f] text-[#ef476f] hover:text-white flex items-center justify-center transition-all"
                    title="Remove from group"
                  >
                    <Minus className="size-2.5" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── My Courses Tab ─────────────────────────────────────────────────────────
function MyCoursesTab({
  classrooms,
  thumbnails,
  onSelectCourse,
  onDeleteCourse,
  onRenameCourse,
  pendingDeleteId,
  onConfirmDelete,
  onCancelDelete,
  loading,
}: {
  classrooms: StageListItem[];
  thumbnails: Record<string, Slide>;
  onSelectCourse: (c: StageListItem) => void;
  onDeleteCourse: (id: string, e: React.MouseEvent) => void;
  onRenameCourse: (id: string, name: string) => void;
  pendingDeleteId: string | null;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  loading: boolean;
}) {
  const getProgressPercent = useCourseProgressStore((s) => s.getProgressPercent);
  const getVisitedCount = useCourseProgressStore((s) => s.getVisitedCount);
  const { starredIds, toggle: toggleStar } = useStarredCoursesStore();
  const { groups, createGroup, addToGroup, removeFromGroup, renameGroup, deleteGroup, getGroupedCourseIds } = useCourseGroupsStore();

  // DnD state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null); // course id or group id

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor(Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const groupedIds = new Set(getGroupedCourseIds());

  // Standalone courses (not in any group)
  const standalone = classrooms.filter((c) => !groupedIds.has(c.id));

  // Sort standalone: starred non-completed → unstarred non-completed → completed
  const sorted = [...standalone].sort((a, b) => {
    const aPct = getProgressPercent(a.id, a.sceneCount);
    const bPct = getProgressPercent(b.id, b.sceneCount);
    const aCompleted = aPct === 100;
    const bCompleted = bPct === 100;
    if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
    const aStarred = starredIds.includes(a.id);
    const bStarred = starredIds.includes(b.id);
    if (aStarred !== bStarred) return aStarred ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

  const groupList = Object.values(groups).sort((a, b) => a.createdAt - b.createdAt);

  // DnD handlers
  const handleDragStart = (e: React.DragEvent, courseId: string) => {
    setDraggingId(courseId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', courseId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDropOnCourse = (e: React.DragEvent, targetCourseId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggingId;
    if (!sourceId || sourceId === targetCourseId) { setDragOverId(null); return; }
    // Check if source is already in a group
    const sourceGroupEntry = Object.values(groups).find((g) => g.courseIds.includes(sourceId));
    if (sourceGroupEntry) {
      // Move from its group to a new group with target (or add target to source group)
      addToGroup(sourceGroupEntry.id, targetCourseId);
    } else {
      // Check if target is in a group — add source to that group
      const targetGroupEntry = Object.values(groups).find((g) => g.courseIds.includes(targetCourseId));
      if (targetGroupEntry) {
        addToGroup(targetGroupEntry.id, sourceId);
      } else {
        // Neither is grouped — create a new group
        createGroup(sourceId, targetCourseId);
      }
    }
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDropOnGroup = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggingId;
    if (!sourceId) { setDragOverId(null); return; }
    // Remove from old group if needed
    const oldGroup = Object.values(groups).find((g) => g.courseIds.includes(sourceId));
    if (oldGroup && oldGroup.id !== groupId) removeFromGroup(oldGroup.id, sourceId);
    addToGroup(groupId, sourceId);
    setDraggingId(null);
    setDragOverId(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="size-10 text-[#118ab2] animate-spin" />
        <p className="font-bold text-[#073b4c]/40">Loading your courses…</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-[#073b4c] dark:text-[#f0f0f0] tracking-tight">My Courses</h1>
          <p className="text-[#073b4c]/50 dark:text-[#a3a3a3] font-medium mt-1">
            {classrooms.length} course{classrooms.length !== 1 ? 's' : ''}
            {classrooms.length > 0 && <span className="ml-2 text-[11px] font-medium text-[#073b4c]/30 dark:text-[#525252]">· drag one onto another to group</span>}
          </p>
        </div>
      </div>

      {classrooms.length === 0 ? (
        <div className="h-80 flex flex-col items-center justify-center border-[3px] border-dashed border-[#073b4c]/15 dark:border-[#2a2a2a] rounded-3xl">
          <div className="size-20 bg-slate-100 dark:bg-[#1a1a1a] rounded-full flex items-center justify-center mb-4">
            <BookOpen className="size-10 text-[#073b4c]/20 dark:text-[#525252]" />
          </div>
          <h3 className="text-xl font-black text-[#073b4c] dark:text-[#f0f0f0] mb-2">No courses yet</h3>
          <p className="text-[#073b4c]/50 dark:text-[#a3a3a3] font-medium text-sm">Create your first course with AI</p>
        </div>
      ) : (
        <>
          {/* Groups section */}
          {groupList.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs font-black text-[#073b4c]/40 dark:text-[#737373] uppercase tracking-widest mb-4">
                Groups · {groupList.length}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {groupList.map((group) => (
                  <CourseGroupFolder
                    key={group.id}
                    group={group}
                    classrooms={classrooms}
                    thumbnails={thumbnails}
                    onSelectCourse={onSelectCourse}
                    onRenameGroup={renameGroup}
                    onRemoveCourse={removeFromGroup}
                    onDeleteGroup={deleteGroup}
                    isDragOver={dragOverId === group.id}
                    onDragOverGroup={(e) => { e.preventDefault(); setDragOverId(group.id); }}
                    onDropOnGroup={handleDropOnGroup}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Individual courses */}
          {sorted.length > 0 && (
            <>
              {groupList.length > 0 && (
                <h2 className="text-xs font-black text-[#073b4c]/40 dark:text-[#737373] uppercase tracking-widest mb-4">
                  Courses · {sorted.length}
                </h2>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {sorted.map((classroom) => {
                  const pct = getProgressPercent(classroom.id, classroom.sceneCount);
                  const visited = getVisitedCount(classroom.id);
                  return (
                    <div
                      key={classroom.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, classroom.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => { e.preventDefault(); setDragOverId(classroom.id); }}
                      onDragLeave={() => setDragOverId(null)}
                      onDrop={(e) => handleDropOnCourse(e, classroom.id)}
                      className={cn(
                        'rounded-2xl transition-all duration-150',
                        draggingId === classroom.id && 'opacity-40 scale-95',
                        dragOverId === classroom.id && draggingId !== classroom.id && 'ring-4 ring-[#8338ec]/50 scale-[1.02]',
                      )}
                    >
                      <MyCourseCard
                        classroom={classroom}
                        slide={thumbnails[classroom.id]}
                        progressPercent={pct}
                        visitedScenes={visited}
                        formatDate={formatDate}
                        onDelete={onDeleteCourse}
                        onRename={onRenameCourse}
                        confirmingDelete={pendingDeleteId === classroom.id}
                        onConfirmDelete={() => onConfirmDelete(classroom.id)}
                        onCancelDelete={onCancelDelete}
                        isStarred={starredIds.includes(classroom.id)}
                        onToggleStar={(e) => { e.stopPropagation(); toggleStar(classroom.id); }}
                        onClick={() => onSelectCourse(classroom)}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function MyCourseCard({
  classroom,
  slide,
  progressPercent,
  visitedScenes,
  formatDate,
  onDelete,
  onRename,
  confirmingDelete,
  onConfirmDelete,
  onCancelDelete,
  isStarred,
  onToggleStar,
  onClick,
}: {
  classroom: StageListItem;
  slide?: Slide;
  progressPercent: number;
  visitedScenes: number;
  formatDate: (ts: number) => string;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onRename: (id: string, name: string) => void;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  isStarred: boolean;
  onToggleStar: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const [syncing, setSyncing] = useState(false);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbWidth, setThumbWidth] = useState(0);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleCardClick = async () => {
    if (confirmingDelete || syncing) return;
    if (classroom.is_cloud && classroom.supabase_id) {
      setSyncing(true);
      const success = await downloadCourseFromSupabase(classroom.supabase_id);
      setSyncing(false);
      if (!success) { toast.error('Failed to sync course from cloud'); return; }
    }
    onClick();
  };

  useEffect(() => {
    const el = thumbRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setThumbWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (editing) nameInputRef.current?.focus();
  }, [editing]);

  const commitRename = () => {
    if (!editing) return;
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== classroom.name) onRename(classroom.id, trimmed);
    setEditing(false);
  };

  const statusLabel = progressPercent === 0 ? 'Not Started' : progressPercent === 100 ? 'Completed' : 'In Progress';
  const statusColor = progressPercent === 0 ? '#073b4c' : progressPercent === 100 ? '#06d6a0' : '#8338ec';

  return (
    <div className="group flex flex-col">
      {/* Thumbnail */}
      <div
        ref={thumbRef}
        onClick={handleCardClick}
        className="relative w-full aspect-[16/9] rounded-2xl bg-slate-100 dark:bg-[#1a1a1a]/80 overflow-hidden transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:shadow-[4px_4px_0_#073b4c] border-[2px] border-transparent hover:border-[#073b4c]"
      >
        <AnimatePresence>
          {syncing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/40 backdrop-blur-md">
              <div className="size-6 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
              <span className="text-[11px] font-bold text-white tracking-wider uppercase">Syncing</span>
            </motion.div>
          )}
        </AnimatePresence>

        {slide && thumbWidth > 0 ? (
          <ThumbnailSlide slide={slide} size={thumbWidth} viewportSize={slide.viewportSize ?? 1000} viewportRatio={slide.viewportRatio ?? 0.5625} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-12 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center">
              <span className="text-xl opacity-50">📄</span>
            </div>
          </div>
        )}

        {classroom.is_cloud && (
          <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 flex items-center gap-1">
            <Cloud className="size-3 text-white/90" />
            <span className="text-[9px] font-bold text-white/90 uppercase tracking-tighter">Cloud</span>
          </div>
        )}

        {/* Star button (always visible when starred, hover otherwise) */}
        <button
          onClick={onToggleStar}
          className={cn(
            'absolute top-2 left-2 z-10 size-7 flex items-center justify-center rounded-full backdrop-blur-sm transition-all',
            isStarred
              ? 'bg-[#ffd166] text-[#073b4c] opacity-100 border border-[#073b4c]/20'
              : 'bg-black/30 text-white opacity-0 group-hover:opacity-100 group-hover:bg-[#ffd166] group-hover:text-[#073b4c]',
          )}
        >
          <Star className={cn('size-3.5', isStarred && 'fill-current')} />
        </button>

        {/* Action buttons */}
        <AnimatePresence>
          {!confirmingDelete && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Button size="icon" variant="ghost"
                className="absolute top-2 right-2 size-7 opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 hover:bg-destructive/80 text-white hover:text-white backdrop-blur-sm rounded-full"
                onClick={(e) => { e.stopPropagation(); onDelete(classroom.id, e); }}>
                <Trash2 className="size-3.5" />
              </Button>
              <Button size="icon" variant="ghost"
                className="absolute top-2 right-11 size-7 opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm rounded-full"
                onClick={(e) => { e.stopPropagation(); setNameDraft(classroom.name); setEditing(true); }}>
                <Pencil className="size-3.5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {confirmingDelete && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/50 backdrop-blur-[6px]"
              onClick={(e) => e.stopPropagation()}>
              <span className="text-[13px] font-medium text-white/90">Delete this course?</span>
              <div className="flex gap-2">
                <button className="px-3.5 py-1 rounded-lg text-[12px] font-medium bg-white/15 text-white/80 hover:bg-white/25 transition-colors" onClick={onCancelDelete}>Cancel</button>
                <button className="px-3.5 py-1 rounded-lg text-[12px] font-medium bg-red-500/90 text-white hover:bg-red-500 transition-colors" onClick={onConfirmDelete}>Delete</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Info */}
      <div className="mt-3 flex-1 flex flex-col gap-2 px-0.5">
        {editing ? (
          <input ref={nameInputRef} value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
            maxLength={100}
            className="w-full bg-transparent border-b-2 border-[#8338ec] text-[14px] font-bold text-[#073b4c] outline-none"
          />
        ) : (
          <p
            className="font-bold text-[14px] text-[#073b4c] dark:text-[#f0f0f0] line-clamp-2 leading-snug cursor-text hover:text-[#8338ec] transition-colors"
            onClick={() => { setNameDraft(classroom.name); setEditing(true); }}
          >{classroom.name}</p>
        )}

        <div className="flex items-center justify-between text-[11px] text-[#073b4c]/40 dark:text-[#737373] font-medium">
          <span>{classroom.sceneCount} slides</span>
          <span>{formatDate(classroom.updatedAt)}</span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span style={{ color: statusColor }}>{statusLabel}</span>
            <span className="text-[#073b4c]/40 dark:text-[#737373]">{visitedScenes}/{classroom.sceneCount} scenes</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#073b4c]/8 dark:bg-[#2a2a2a] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{
                background: progressPercent === 100
                  ? '#06d6a0'
                  : progressPercent > 0
                  ? 'linear-gradient(90deg, #8338ec, #118ab2)'
                  : '#073b4c20',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Course Outline Page ─────────────────────────────────────────────────────
interface SceneInfo { id: string; title: string; type: string }

function CourseOutlinePage({
  title, description, headline, language, tags, slideCount,
  scenes, thumbnail, isMyCourse, isSaved, savingCourse,
  onBack, onEnterClassroom, onSaveCourse,
}: {
  title: string;
  description?: string;
  headline?: string;
  language?: string;
  tags?: { subject?: string; age_range?: string; topic?: string };
  slideCount?: number;
  scenes?: SceneInfo[];
  thumbnail?: Slide;
  isMyCourse: boolean;
  isSaved?: boolean;
  savingCourse?: boolean;
  onBack: () => void;
  onEnterClassroom: () => void;
  onSaveCourse?: () => void;
}) {
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbWidth, setThumbWidth] = useState(0);

  useEffect(() => {
    const el = thumbRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setThumbWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showEnterBtn = isMyCourse || isSaved;

  const actionBtn = (fullWidth = false) =>
    showEnterBtn ? (
      <button
        onClick={onEnterClassroom}
        className={cn(
          'flex items-center gap-2 px-6 py-3 bg-[#073b4c] text-white font-black rounded-2xl border-[3px] border-[#073b4c] shadow-[4px_4px_0_rgba(7,59,76,0.25)] hover:shadow-[6px_6px_0_rgba(7,59,76,0.25)] hover:-translate-y-0.5 transition-all text-sm',
          fullWidth && 'w-full justify-center',
        )}
      >
        <BookOpen className="size-4" />
        Enter Classroom
      </button>
    ) : (
      <button
        onClick={onSaveCourse}
        disabled={savingCourse}
        className={cn(
          'flex items-center gap-2 px-6 py-3 bg-[#ef476f] text-white font-black rounded-2xl border-[3px] border-[#073b4c] shadow-[4px_4px_0_rgba(7,59,76,0.25)] hover:shadow-[6px_6px_0_rgba(7,59,76,0.25)] hover:-translate-y-0.5 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-[4px_4px_0_rgba(7,59,76,0.25)]',
          fullWidth && 'w-full justify-center',
        )}
      >
        {savingCourse ? <Loader2 className="size-4 animate-spin" /> : <BookOpen className="size-4" />}
        {savingCourse ? 'Saving…' : 'Save Course'}
      </button>
    );

  const sceneIcon = (type: string) =>
    type === 'video' ? '🎬' : type === 'quiz' ? '❓' : '📄';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-[#073b4c]/20 dark:border-[#333333] text-[#073b4c]/60 dark:text-[#a3a3a3] hover:border-[#073b4c] dark:hover:border-[#4a4a4a] hover:text-[#073b4c] dark:hover:text-[#e5e5e5] font-bold text-sm transition-all"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        {actionBtn(false)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: info + scene list */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title + tags */}
          <div>
            <h1 className="text-3xl font-black text-[#073b4c] dark:text-[#f0f0f0] tracking-tight leading-tight mb-4">{title}</h1>
            <div className="flex flex-wrap gap-2 mb-4">
              {tags?.subject && (
                <span className="px-3 py-1 bg-[#ffd166] text-[#073b4c] text-xs font-black uppercase tracking-wide rounded-lg border-2 border-[#073b4c]">
                  {tags.subject}
                </span>
              )}
              {tags?.age_range && (
                <span className="px-3 py-1 bg-[#118ab2] text-white text-xs font-black uppercase tracking-wide rounded-lg border-2 border-[#073b4c]">
                  Ages {tags.age_range}
                </span>
              )}
              {language && (
                <span className="px-3 py-1 bg-[#f0f4f8] dark:bg-[#2a2a2a] text-[#073b4c] dark:text-[#e5e5e5] text-xs font-bold rounded-lg border-2 border-[#073b4c]/20 dark:border-[#333333]">
                  {language === 'zh-CN' ? '中文' : language === 'en-US' ? 'English' : language}
                </span>
              )}
              {slideCount != null && (
                <span className="px-3 py-1 bg-[#f0f4f8] dark:bg-[#2a2a2a] text-[#073b4c] dark:text-[#e5e5e5] text-xs font-bold rounded-lg border-2 border-[#073b4c]/20 dark:border-[#333333]">
                  {slideCount} slides
                </span>
              )}
            </div>
            {(description || headline) && (
              <p className="text-[#073b4c]/70 dark:text-[#a3a3a3] font-medium leading-relaxed text-[14px]">
                {description || headline}
              </p>
            )}
          </div>

          {/* Scene list — My Courses */}
          {scenes && scenes.length > 0 && (
            <div>
              <h2 className="text-xs font-black text-[#073b4c]/40 dark:text-[#737373] uppercase tracking-widest mb-3">
                Course Contents · {scenes.length} scenes
              </h2>
              <div className="space-y-1.5">
                {scenes.map((scene, i) => (
                  <div key={scene.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#f0f4f8] dark:bg-[#1a1a1a] border-2 border-transparent hover:border-[#073b4c]/10 dark:hover:border-[#3a3a3a] transition-colors">
                    <span className="shrink-0 text-[11px] font-black text-[#073b4c]/30 dark:text-[#525252] w-5 text-right tabular-nums">{i + 1}</span>
                    <span className="text-sm shrink-0">{sceneIcon(scene.type)}</span>
                    <span className="font-semibold text-sm text-[#073b4c] dark:text-[#e5e5e5] truncate">{scene.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scene count placeholder while browse scenes are loading */}
          {(!scenes || scenes.length === 0) && slideCount != null && (
            <div>
              <h2 className="text-xs font-black text-[#073b4c]/40 dark:text-[#737373] uppercase tracking-widest mb-3">
                Course Contents · {slideCount} slides
              </h2>
              <div className="h-24 flex items-center justify-center border-[3px] border-dashed border-[#073b4c]/10 dark:border-[#2a2a2a] rounded-2xl">
                <Loader2 className="size-5 text-[#073b4c]/30 animate-spin" />
              </div>
            </div>
          )}

          {/* Bottom CTA */}
          <div className="pt-2">{actionBtn(true)}</div>
        </div>

        {/* Right: thumbnail */}
        <div className="lg:col-span-1">
          <div
            ref={thumbRef}
            className="w-full aspect-[16/9] rounded-2xl border-[3px] border-[#073b4c] dark:border-[#333333] overflow-hidden bg-slate-100 dark:bg-[#1a1a1a] shadow-[6px_6px_0_#073b4c] dark:shadow-[6px_6px_0_rgba(0,0,0,0.5)]"
          >
            {thumbnail && thumbWidth > 0 ? (
              <ThumbnailSlide
                slide={thumbnail}
                size={thumbWidth}
                viewportSize={thumbnail.viewportSize ?? 1000}
                viewportRatio={thumbnail.viewportRatio ?? 0.5625}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen className="size-12 text-[#073b4c]/10" />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Browse Courses Tab ──────────────────────────────────────────────────────
function BrowseCoursesTab({ onSelectCourse }: { onSelectCourse: (course: Course) => void }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedAge, setSelectedAge] = useState('All');
  const sentinelRef = useRef<HTMLDivElement>(null);

  const buildParams = useCallback((extra: Record<string, string | number> = {}) => {
    const params = new URLSearchParams();
    params.set('filter', 'public');
    params.set('limit', String(PAGE_SIZE));
    if (searchQuery) params.set('q', searchQuery);
    if (selectedSubject !== 'All') params.set('subject', selectedSubject);
    if (selectedAge !== 'All') {
      const [min] = selectedAge.replace('+', '-99').split('-');
      params.set('age', min);
    }
    Object.entries(extra).forEach(([k, v]) => params.set(k, String(v)));
    return params;
  }, [searchQuery, selectedSubject, selectedAge]);

  const fetchCatalog = useCallback(async (reset = true, q?: string) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    const currentOffset = reset ? 0 : offsetRef.current;
    try {
      const params = buildParams({ offset: currentOffset });
      if (q !== undefined) params.set('q', q);
      const res = await fetch(`/api/catalog?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        if (reset) {
          setCourses(json.courses);
          offsetRef.current = json.courses.length;
        } else {
          setCourses((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            const fresh = (json.courses as Course[]).filter((c) => !existingIds.has(c.id));
            return [...prev, ...fresh];
          });
          offsetRef.current += json.courses.length;
        }
        setHasMore(json.hasMore ?? false);
      }
    } catch { /* ignore */ } finally {
      if (reset) setLoading(false); else setLoadingMore(false);
    }
  }, [buildParams]);

  useEffect(() => {
    offsetRef.current = 0; setCourses([]); fetchCatalog(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject, selectedAge]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) fetchCatalog(false); },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, fetchCatalog]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-[#073b4c] dark:text-[#f0f0f0] tracking-tight flex items-center gap-3">
            Browse Courses
            <Sparkles className="size-6 text-[#ef476f]" />
          </h1>
          <p className="text-[#073b4c]/50 dark:text-[#a3a3a3] font-medium mt-1">Discover courses from the community</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={(e) => { e.preventDefault(); setOffset(0); setCourses([]); fetchCatalog(true, searchQuery); }}
        className="mb-6">
        <div className="relative flex items-center max-w-2xl">
          <Search className="absolute left-4 size-5 text-[#073b4c]/40" />
          <Input
            type="text"
            placeholder="Search courses by topic, title, or keywords..."
            className="h-12 pl-12 pr-28 text-base font-medium border-[3px] border-[#073b4c] rounded-2xl shadow-[5px_5px_0_#073b4c] focus-visible:ring-0 focus-visible:shadow-[7px_7px_0_#073b4c] transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button type="submit"
            className="absolute right-2 h-8 px-4 bg-[#ef476f] hover:bg-[#ef476f]/90 text-white font-bold rounded-xl border-2 border-[#073b4c] shadow-[2px_2px_0_#073b4c] active:shadow-none active:translate-x-px active:translate-y-px transition-all text-xs">
            Search
          </Button>
        </div>
      </form>

      <div className="flex gap-8">
        {/* Filters */}
        <aside className="hidden lg:block w-52 shrink-0 space-y-6">
          <div>
            <h3 className="text-xs font-black text-[#073b4c]/40 dark:text-[#737373] uppercase tracking-widest mb-3 flex items-center gap-2">
              <Filter className="size-3.5" /> Subjects
            </h3>
            <div className="flex flex-col gap-1">
              {SUBJECTS.map((sub) => (
                <button key={sub} onClick={() => setSelectedSubject(sub)}
                  className={cn('px-3 py-2 text-left text-sm font-bold rounded-xl border-2 transition-all',
                    selectedSubject === sub
                      ? 'bg-[#ffd166] text-[#073b4c] border-[#073b4c] shadow-[3px_3px_0_#073b4c]'
                      : 'bg-transparent text-[#073b4c]/50 dark:text-[#737373] border-transparent hover:border-[#073b4c]/15 dark:hover:border-[#3a3a3a] hover:bg-[#f0f4f8] dark:hover:bg-[#222222] dark:hover:text-[#d4d4d4]',
                  )}>
                  {sub}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-black text-[#073b4c]/40 dark:text-[#737373] uppercase tracking-widest mb-3 flex items-center gap-2">
              <Users className="size-3.5" /> Age Range
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {AGE_RANGES.map((age) => (
                <button key={age} onClick={() => setSelectedAge(age)}
                  className={cn('px-2 py-2 text-center text-xs font-bold rounded-xl border-2 transition-all',
                    selectedAge === age
                      ? 'bg-[#118ab2] text-white border-[#073b4c] shadow-[3px_3px_0_#073b4c]'
                      : 'bg-transparent text-[#073b4c]/50 dark:text-[#737373] border-transparent hover:border-[#073b4c]/15 dark:hover:border-[#3a3a3a] hover:bg-[#f0f4f8] dark:hover:bg-[#222222] dark:hover:text-[#d4d4d4]',
                  )}>
                  {age}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Course grid */}
        <div className="flex-1">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4">
              <Loader2 className="size-10 text-[#118ab2] animate-spin" />
              <p className="font-bold text-[#073b4c]/40 dark:text-[#737373]">Scanning library…</p>
            </div>
          ) : courses.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {courses.map((course, i) => (
                  <BrowseCourseCard key={course.id} course={course} index={i}
                    onClick={() => onSelectCourse(course)} />
                ))}
              </div>
              <div ref={sentinelRef} className="h-1" />
              {loadingMore && <div className="flex justify-center py-8"><Loader2 className="size-8 text-[#118ab2] animate-spin" /></div>}
              {!hasMore && courses.length > 0 && <p className="text-center text-sm text-[#073b4c]/30 dark:text-[#525252] font-medium py-8">All courses loaded</p>}
            </>
          ) : (
            <div className="h-80 flex flex-col items-center justify-center border-[3px] border-dashed border-[#073b4c]/15 dark:border-[#2a2a2a] rounded-3xl">
              <div className="size-20 bg-slate-100 dark:bg-[#1a1a1a] rounded-full flex items-center justify-center mb-4">
                <BookOpen className="size-10 text-[#073b4c]/20 dark:text-[#525252]" />
              </div>
              <h3 className="text-xl font-black text-[#073b4c] dark:text-[#f0f0f0] mb-2">No courses found</h3>
              <p className="text-[#073b4c]/50 dark:text-[#a3a3a3] font-medium text-sm">Try adjusting your filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BrowseCourseCard({ course, index, onClick }: { course: Course; index: number; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.25) }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="group cursor-pointer flex flex-col bg-white dark:bg-[#1a1a1a] border-[3px] border-[#073b4c] dark:border-[#333333] rounded-2xl overflow-hidden shadow-[5px_5px_0_#073b4c] dark:shadow-[5px_5px_0_rgba(0,0,0,0.5)] hover:shadow-[8px_8px_0_#073b4c] dark:hover:shadow-[8px_8px_0_rgba(0,0,0,0.5)] transition-all"
    >
      <div className="h-32 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 border-b-[3px] border-[#073b4c] dark:border-[#333333] flex items-center justify-center relative overflow-hidden">
        <BookOpen className="size-10 text-[#073b4c]/10 group-hover:scale-110 group-hover:text-[#073b4c]/20 transition-all duration-500" />
        <div className="absolute bottom-2 left-3 flex flex-wrap gap-1.5">
          {course.tags.subject && (
            <span className="px-2 py-0.5 bg-[#ffd166] text-[#073b4c] text-[9px] font-black uppercase tracking-wide rounded-lg border border-[#073b4c]">
              {course.tags.subject}
            </span>
          )}
          {course.tags.age_range && (
            <span className="px-2 py-0.5 bg-[#118ab2] text-white text-[9px] font-black uppercase tracking-wide rounded-lg border border-[#073b4c]">
              Ages {course.tags.age_range}
            </span>
          )}
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-[15px] font-black text-[#073b4c] dark:text-[#f0f0f0] mb-2 line-clamp-2 leading-tight group-hover:text-[#ef476f] transition-colors">
          {course.title}
        </h3>
        <p className="text-[#073b4c]/60 dark:text-[#a3a3a3] text-xs font-medium line-clamp-2 mb-4 flex-1">
          {course.headline || course.description}
        </p>
        <div className="pt-3 border-t-2 border-[#073b4c]/8 dark:border-[#2a2a2a] flex items-center justify-between">
          <span className="text-[11px] font-black text-[#073b4c]/30 dark:text-[#737373] uppercase tracking-widest">
            {course.slideCount} Slides
          </span>
          <div className="size-7 bg-[#073b4c] dark:bg-slate-600 rounded-full flex items-center justify-center text-white group-hover:bg-[#ef476f] transition-colors">
            <ArrowRight className="size-3.5" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Achievements Tab ────────────────────────────────────────────────────────
interface UserStats {
  totalScore?: number;
  globalRank?: number;
  currentStreak?: number;
  highestStreak?: number;
  totalWatchTime?: number;
  coursesCompleted?: number;
  certificates?: { id: string; courseId: string; courseName: string; createdAt: string }[];
}

function AchievementsTab() {
  const { user } = useAuth();
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [lbTab, setLbTab] = useState<'global' | 'local'>('global');
  const [lbLoading, setLbLoading] = useState(true);
  const [lbRefreshing, setLbRefreshing] = useState(false);
  const [lbData, setLbData] = useState<LeaderboardEntry[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [searchCountry, setSearchCountry] = useState('');
  const [lbRefreshTick, setLbRefreshTick] = useState(0);
  const [certsOpen, setCertsOpen] = useState(false);

  useEffect(() => {
    if (!user) { setStatsLoading(false); return; }
    setStatsLoading(true);
    fetch('/api/analytics/user-stats')
      .then((r) => r.json())
      .then((json) => { if (json.success) setStats(json.stats); })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [user]);

  useEffect(() => {
    let active = true;
    const fetchLb = async (isManual = false) => {
      if (isManual) setLbRefreshing(true); else setLbLoading(true);
      try {
        let url = `/api/leaderboard?type=${lbTab}`;
        if (lbTab === 'local' && selectedCountry) url += `&country=${selectedCountry}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!active) return;
        if (json.success) {
          setLbData(json.leaderboard);
          if (json.meta?.totalCount) setTotalStudents(json.meta.totalCount);
          if (json.meta?.countryCode && !detectedCountry) setDetectedCountry(json.meta.countryCode);
        }
      } catch { /* ignore */ } finally {
        if (active) { setLbLoading(false); setLbRefreshing(false); }
      }
    };
    fetchLb(lbRefreshTick > 0);
    const interval = setInterval(() => fetchLb(), 30_000);
    return () => { active = false; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lbTab, selectedCountry, lbRefreshTick]);

  const currentUserEntry = user ? lbData.find((e) => e.user_id === user.id) : null;
  const allCountries = Object.entries(COUNTRY_NAMES).sort(([, a], [, b]) => a.localeCompare(b));
  const filteredCountries = searchCountry
    ? allCountries.filter(([code, name]) =>
        name.toLowerCase().includes(searchCountry.toLowerCase()) ||
        code.toLowerCase().includes(searchCountry.toLowerCase()),
      )
    : allCountries;

  const watchMins = Math.floor((stats?.totalWatchTime ?? 0) / 60);
  const watchDisplay = watchMins >= 60 ? `${Math.floor(watchMins / 60)}h ${watchMins % 60}m` : `${watchMins}m`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-[#073b4c] dark:text-[#f0f0f0] tracking-tight flex items-center gap-3">
          Achievements
          <Award className="size-7 text-[#ffd166]" />
        </h1>
        <p className="text-[#073b4c]/50 dark:text-[#a3a3a3] font-medium mt-1">Your learning milestones and leaderboard ranking</p>
      </div>

      {/* ── Personal stats ── */}
      <section>
        <p className="text-[11px] font-black text-[#073b4c]/35 dark:text-[#525252] uppercase tracking-widest mb-4">Your Stats</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {([
            {
              icon: <Flame className="size-6" />,
              label: 'Current Streak',
              value: statsLoading ? null : `${stats?.currentStreak ?? 0}`,
              unit: 'days',
              sub: `Best: ${stats?.highestStreak ?? 0} days`,
              color: '#ff9f1c',
              bgClass: 'from-orange-50 to-amber-50',
            },
            {
              icon: <Clock className="size-6" />,
              label: 'Watch Time',
              value: statsLoading ? null : watchDisplay,
              unit: '',
              sub: 'Total study time',
              color: '#118ab2',
              bgClass: 'from-sky-50 to-blue-50',
            },
            {
              icon: <BookOpen className="size-6" />,
              label: 'Courses Completed',
              value: statsLoading ? null : `${stats?.coursesCompleted ?? 0}`,
              unit: '',
              sub: `${totalStudents.toLocaleString()} total learners`,
              color: '#06d6a0',
              bgClass: 'from-emerald-50 to-teal-50',
            },
            {
              icon: <Award className="size-6" />,
              label: 'Certificates',
              value: statsLoading ? null : `${stats?.certificates?.length ?? 0}`,
              unit: '',
              sub: 'Tap to view',
              color: '#8338ec',
              bgClass: 'from-violet-50 to-purple-50',
              onClick: () => setCertsOpen((v) => !v),
            },
          ] satisfies Array<{ icon: React.ReactNode; label: string; value: string | null; unit: string; sub: string; color: string; bgClass: string; onClick?: () => void }>).map((card) => (
            <motion.div
              key={card.label}
              whileHover={card.onClick ? { y: -3 } : {}}
              onClick={card.onClick}
              className={cn(
                'relative rounded-2xl border-[3px] border-[#073b4c] dark:border-[#333333] bg-gradient-to-br dark:bg-none dark:bg-[#1a1a1a] p-5 flex flex-col gap-3',
                card.bgClass,
                card.onClick
                  ? 'cursor-pointer shadow-[4px_4px_0_#8338ec] hover:shadow-[6px_6px_0_#8338ec] transition-all'
                  : 'shadow-[4px_4px_0_#073b4c]',
              )}
            >
              <div className="size-11 rounded-xl flex items-center justify-center" style={{ background: `${card.color}18`, color: card.color }}>
                {card.icon}
              </div>
              <div>
                {card.value === null ? (
                  <div className="h-8 w-14 bg-white/60 rounded-lg animate-pulse mb-1" />
                ) : (
                  <p className="text-3xl font-black text-[#073b4c] dark:text-[#f0f0f0] leading-none">
                    {card.value}
                    {card.unit && <span className="text-base font-bold text-[#073b4c]/50 dark:text-[#737373] ml-1">{card.unit}</span>}
                  </p>
                )}
                <p className="text-xs font-black text-[#073b4c]/60 dark:text-[#a3a3a3] uppercase tracking-wide mt-1">{card.label}</p>
                <p className="text-[10px] text-[#073b4c]/35 dark:text-[#525252] font-medium mt-0.5">{card.sub}</p>
              </div>
              {card.onClick && <ChevronRight className="absolute top-4 right-4 size-4 text-[#8338ec]/40" />}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Certificates panel ── */}
      <AnimatePresence>
        {certsOpen && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border-[3px] border-[#8338ec] bg-white dark:bg-[#1a1a1a] shadow-[5px_5px_0_#8338ec] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-[#8338ec]/15 bg-violet-50/60 dark:bg-[#8338ec]/10">
                <h3 className="font-black text-[#073b4c] flex items-center gap-2 text-sm">
                  <Award className="size-4.5 text-[#8338ec]" /> Your Certificates
                </h3>
                <button onClick={() => setCertsOpen(false)}
                  className="size-7 rounded-full border-2 border-[#073b4c]/15 flex items-center justify-center hover:bg-white transition-colors">
                  <X className="size-3.5 text-[#073b4c]/50" />
                </button>
              </div>
              <div className="p-5">
                {!stats?.certificates?.length ? (
                  <div className="flex flex-col items-center py-10 gap-3">
                    <div className="size-14 rounded-2xl bg-violet-50 border-2 border-violet-100 flex items-center justify-center">
                      <Award className="size-7 text-[#8338ec]/30" />
                    </div>
                    <p className="text-sm font-bold text-[#073b4c]/40 text-center max-w-xs">
                      Complete a course to earn your first certificate.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {stats.certificates.map((c) => (
                      <a key={c.id} href={`/c/${c.id}`}
                        className="flex items-start gap-3 rounded-xl border-2 border-[#073b4c]/10 bg-[#f8fafc] px-4 py-3.5 hover:border-[#8338ec]/40 hover:bg-violet-50/60 transition-all group">
                        <div className="size-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                          <Award className="size-4.5 text-[#8338ec]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#073b4c] group-hover:text-[#8338ec] line-clamp-2 transition-colors">{c.courseName}</p>
                          <p className="text-[10px] font-bold text-[#073b4c]/35 uppercase tracking-wide mt-1">
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                          </p>
                        </div>
                        <ExternalLink className="size-3.5 text-[#073b4c]/20 group-hover:text-[#8338ec] shrink-0 mt-0.5 transition-colors" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── Your rank ── */}
      {currentUserEntry && (
        <div className="p-5 rounded-2xl border-[3px] border-[#ffd166] bg-gradient-to-r from-[#fffbea] to-[#fffef5] dark:from-[#8338ec]/10 dark:to-[#8338ec]/5 dark:bg-none shadow-[4px_4px_0_#ffd166] dark:shadow-[4px_4px_0_rgba(131,56,236,0.3)] flex items-center gap-5">
          <div className="size-14 rounded-2xl border-[3px] border-[#073b4c] bg-[#ffd166] flex items-center justify-center shrink-0">
            <Medal className="size-7 text-[#073b4c]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-[#073b4c]/40 dark:text-[#737373] uppercase tracking-widest">Your Global Rank</p>
            <p className="text-4xl font-black text-[#073b4c] dark:text-[#f0f0f0] leading-tight">#{currentUserEntry.rank}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] font-black text-[#073b4c]/40 dark:text-[#737373] uppercase tracking-widest">Quiz Score</p>
            <p className="text-2xl font-black text-[#073b4c] dark:text-[#f0f0f0]">{currentUserEntry.total_score.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-[#073b4c]/30 dark:text-[#525252]">{currentUserEntry.quizzes_completed} quizzes</p>
          </div>
        </div>
      )}

      {/* ── Leaderboard ── */}
      <section>
        <p className="text-[11px] font-black text-[#073b4c]/35 dark:text-[#525252] uppercase tracking-widest mb-4">Leaderboard</p>
        <div className="rounded-2xl border-[3px] border-[#073b4c] dark:border-[#333333] bg-white dark:bg-[#1a1a1a] shadow-[5px_5px_0_#073b4c] dark:shadow-[5px_5px_0_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b-[3px] border-[#073b4c] dark:border-[#2a2a2a]">
            <div className="flex gap-2">
              {(['global', 'local'] as const).map((t) => (
                <button key={t} onClick={() => setLbTab(t)}
                  className={cn('px-4 py-2 rounded-xl font-bold text-sm border-2 transition-all',
                    lbTab === t ? 'bg-[#073b4c] text-white border-[#073b4c]' : 'text-[#073b4c]/60 dark:text-[#a3a3a3] border-transparent hover:border-[#073b4c]/20 dark:hover:border-[#3a3a3a] dark:hover:bg-[#222222]',
                  )}>
                  {t === 'global' ? <><Globe className="size-3.5 inline mr-1.5" />Global</> : <><MapPin className="size-3.5 inline mr-1.5" />Local</>}
                </button>
              ))}
            </div>
            <button onClick={() => setLbRefreshTick((v) => v + 1)} disabled={lbRefreshing}
              className="size-8 rounded-full border-2 border-[#073b4c]/15 flex items-center justify-center hover:bg-[#f0f4f8] transition-colors disabled:opacity-40">
              <RefreshCw className={cn('size-3.5 text-[#073b4c]', lbRefreshing && 'animate-spin')} />
            </button>
          </div>

          {lbTab === 'local' && (
            <div className="px-5 py-3 border-b-2 border-[#073b4c]/10 dark:border-[#2a2a2a] bg-[#f8fafc] dark:bg-[#1a1a1a]/50">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-black text-[#073b4c]/40 dark:text-[#737373] uppercase tracking-widest shrink-0">Country:</span>
                <button onClick={() => setSelectedCountry(detectedCountry)}
                  className={cn('px-3 py-1 rounded-full border-2 text-xs font-bold transition-all',
                    selectedCountry === detectedCountry ? 'bg-[#073b4c] text-white border-[#073b4c]' : 'border-[#073b4c]/20 text-[#073b4c]/60 hover:border-[#073b4c]/50',
                  )}>
                  📍 My Country
                </button>
                <div className="flex-1 min-w-0 relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#073b4c]/30" />
                  <input value={searchCountry} onChange={(e) => setSearchCountry(e.target.value)}
                    placeholder="Search country…"
                    className="w-full h-7 pl-8 pr-3 text-xs font-medium border-2 border-[#073b4c]/20 dark:border-[#333333] rounded-full focus:outline-none focus:border-[#073b4c]/50 dark:focus:border-slate-400 bg-white dark:bg-[#2a2a2a] text-[#073b4c] dark:text-[#e5e5e5] placeholder:text-[#073b4c]/40 dark:placeholder:text-slate-500" />
                </div>
              </div>
              {searchCountry && (
                <div className="mt-2 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {filteredCountries.slice(0, 20).map(([code, name]) => (
                    <button key={code} onClick={() => { setSelectedCountry(code); setSearchCountry(''); }}
                      className={cn('px-2.5 py-1 rounded-full border-2 text-[11px] font-bold transition-all',
                        selectedCountry === code ? 'bg-[#073b4c] text-white border-[#073b4c]' : 'border-[#073b4c]/15 text-[#073b4c]/60 hover:border-[#073b4c]/40',
                      )}>
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {lbLoading ? (
            <div className="h-56 flex items-center justify-center">
              <Loader2 className="size-8 text-[#118ab2] animate-spin" />
            </div>
          ) : lbData.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2">
              <Trophy className="size-10 text-[#073b4c]/10 dark:text-slate-700" />
              <p className="text-sm font-bold text-[#073b4c]/30 dark:text-[#525252]">No data yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[#073b4c]/6 dark:divide-slate-700/60">
              {lbData.map((entry, i) => {
                const isCurrentUser = user?.id === entry.user_id;
                return (
                  <motion.div key={entry.user_id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.025 }}
                    className={cn('flex items-center gap-4 px-5 py-3.5 transition-colors',
                      isCurrentUser ? 'bg-[#fffbea] dark:bg-[#8338ec]/10' : 'hover:bg-[#f8fafc] dark:hover:bg-[#222222]',
                    )}>
                    <div className="w-8 text-center shrink-0 font-black text-sm text-[#073b4c]/50 dark:text-[#737373]">
                      {i < 3 ? <span className="text-xl">{['🥇','🥈','🥉'][i]}</span> : `#${entry.rank}`}
                    </div>
                    <div className="size-9 rounded-full overflow-hidden border-2 border-[#073b4c]/15 dark:border-[#333333] shrink-0 bg-gradient-to-br from-[#118ab2] to-[#06d6a0] flex items-center justify-center">
                      {entry.avatar_url
                        ? <img src={entry.avatar_url} alt="" className="size-full object-cover" />
                        : <span className="text-white font-black text-xs">{(entry.display_name || '?').slice(0, 2).toUpperCase()}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('font-bold text-sm text-[#073b4c] dark:text-[#e5e5e5] truncate', isCurrentUser && 'text-[#8338ec]')}>
                        {entry.display_name || 'Anonymous'}
                        {isCurrentUser && <span className="ml-2 text-[9px] bg-[#8338ec] text-white rounded-full px-1.5 py-0.5 font-black">You</span>}
                      </p>
                      <p className="text-[11px] text-[#073b4c]/35 dark:text-[#525252] font-medium">{entry.quizzes_completed} quiz{entry.quizzes_completed !== 1 ? 'zes' : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-[#073b4c] dark:text-[#e5e5e5] text-sm">{entry.total_score.toLocaleString()}</p>
                      <p className="text-[9px] text-[#073b4c]/25 dark:text-[#525252] font-bold uppercase tracking-wide">pts</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────────
function DashboardPage() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isAdmin = searchParams.get('admin') === 'true';
  const [activeTab, setActiveTab] = useState<Tab>('new-course');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const pendingGeneration = searchParams.get('pending_generation');
  const pendingHandled = useRef(false);

  const [form, setForm] = useState<FormState>(initialFormState);
  const [enterClassroomLoading, setEnterClassroomLoading] = useState(false);
  const [createClassroomLoading, setCreateClassroomLoading] = useState(false);
  const [classroomJob, setClassroomJobRaw] = useState<ClassroomJobState | null>(() => {
    try {
      const saved = localStorage.getItem(CLASSROOM_JOB_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as ClassroomJobState) : null;
    } catch { return null; }
  });

  const setClassroomJob = (updater: ClassroomJobState | null | ((prev: ClassroomJobState | null) => ClassroomJobState | null)) => {
    setClassroomJobRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        if (next) localStorage.setItem(CLASSROOM_JOB_STORAGE_KEY, JSON.stringify(next));
        else localStorage.removeItem(CLASSROOM_JOB_STORAGE_KEY);
      } catch { /* ignore */ }
      return next;
    });
  };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const jobPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const plan = usePlanStore((s) => s.plan);
  const canInstantClassroom = plan ? (PLAN_LIMITS[plan.account_type]?.canInstantClassroom ?? false) : false;

  const { cachedValue: cachedRequirement, updateCache: updateRequirementCache } =
    useDraftCache<string>({ key: 'requirementDraft' });

  const currentModelId = useSettingsStore((s) => s.modelId);
  const [error, setError] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<StageListItem[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [showExhaustedModal, setShowExhaustedModal] = useState(false);
  const [exhaustedReason, setExhaustedReason] = useState<string | undefined>(undefined);
  const [thumbnails, setThumbnails] = useState<Record<string, Slide>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // ── Course outline ─────────────────────────────────────────────────────────
  type OutlineCourse = { source: 'my'; item: StageListItem } | { source: 'browse'; item: Course };
  const [outlineCourse, setOutlineCourse] = useState<OutlineCourse | null>(null);
  const [outlineScenes, setOutlineScenes] = useState<SceneInfo[]>([]);
  const [outlineSaving, setOutlineSaving] = useState(false);
  const [outlineBrowseThumbnail, setOutlineBrowseThumbnail] = useState<Slide | undefined>(undefined);
  const savedCoursesStore = useSavedCoursesStore();

  // Hydrate form defaults
  useEffect(() => {
    try {
      const savedWebSearch = localStorage.getItem(WEB_SEARCH_STORAGE_KEY);
      const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      const updates: Partial<FormState> = {};
      if (savedWebSearch !== null) updates.webSearch = savedWebSearch === 'true';
      if (savedLanguage === 'zh-CN' || savedLanguage === 'en-US') updates.language = savedLanguage;
      else { const detected = navigator.language?.startsWith('zh') ? 'zh-CN' : 'en-US'; updates.language = detected; }
      const pendingPrompt = localStorage.getItem('pendingPrompt');
      if (pendingPrompt) { updates.requirement = pendingPrompt; localStorage.removeItem('pendingPrompt'); }
      if (Object.keys(updates).length > 0) setForm((prev) => ({ ...prev, ...updates }));
    } catch { /* ignore */ }
    // restore draft
    if (cachedRequirement) setForm((prev) => ({ ...prev, requirement: prev.requirement || cachedRequirement }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadClassrooms = async () => {
    setCoursesLoading(true);
    try {
      const localList = await listStages();
      const localMap = new Map(localList.map((c) => [c.id, c]));
      const mergedList: StageListItem[] = [...localList];
      if (user) {
        const supabaseList = await fetchUserCoursesFromSupabase(user.id);
        for (const sCourse of supabaseList) {
          if (!localMap.has(sCourse.stage_id)) {
            mergedList.push({
              id: sCourse.stage_id, name: sCourse.name, description: '',
              sceneCount: sCourse.slide_count,
              createdAt: new Date(sCourse.created_at).getTime(),
              updatedAt: new Date(sCourse.updated_at).getTime(),
              is_cloud: true, supabase_id: sCourse.id,
            });
          }
        }
      }
      mergedList.sort((a, b) => b.updatedAt - a.updatedAt);
      setClassrooms(mergedList);

      const localIds = mergedList.filter((c) => !c.is_cloud).map((c) => c.id);
      if (localIds.length > 0) {
        const slides = await getFirstSlideByStages(localIds);
        setThumbnails(slides);
      }
    } catch (err) {
      log.error('Failed to load classrooms:', err);
    } finally {
      setCoursesLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadClassrooms();
      if (user) usePlanStore.getState().refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  useEffect(() => {
    useMediaGenerationStore.getState().revokeObjectUrls();
    useMediaGenerationStore.setState({ tasks: {} });
    loadClassrooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for background classroom job
  useEffect(() => {
    if (!classroomJob || classroomJob.phase !== 'background') {
      if (jobPollRef.current) { clearInterval(jobPollRef.current); jobPollRef.current = null; }
      return;
    }
    const poll = async () => {
      try {
        const res = await fetch('/api/notifications?unread_only=false&limit=20', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        const match = (json.notifications ?? []).find(
          (n: { type: string; metadata?: { job_id?: string }; action_url?: string }) =>
            n.type === 'classroom_ready' && n.metadata?.job_id === classroomJob.jobId,
        );
        if (match) {
          setClassroomJob((prev) => prev ? { ...prev, phase: 'done', classroomUrl: match.action_url ?? '' } : prev);
          if (jobPollRef.current) { clearInterval(jobPollRef.current); jobPollRef.current = null; }
        }
      } catch { /* ignore */ }
    };
    poll();
    jobPollRef.current = setInterval(poll, 10_000);
    return () => { if (jobPollRef.current) clearInterval(jobPollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroomJob?.phase, classroomJob?.jobId]);

  // Handle pending generation after login redirect
  useEffect(() => {
    if (pendingGeneration === 'true' && !pendingHandled.current && !authLoading && user && form.requirement.trim()) {
      pendingHandled.current = true;
      const timer = setTimeout(() => handleGenerate(), 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingGeneration, authLoading, user, form.requirement]);

  const updateForm = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    try {
      if (field === 'webSearch') localStorage.setItem(WEB_SEARCH_STORAGE_KEY, String(value));
      if (field === 'language') localStorage.setItem(LANGUAGE_STORAGE_KEY, String(value));
      if (field === 'requirement') updateRequirementCache(value as string);
    } catch { /* ignore */ }
  };

  const showSetupToast = (title: string, desc: string) => {
    toast.custom((id) => (
      <div onClick={() => { toast.dismiss(id); setSettingsOpen(true); }}
        className="w-[356px] rounded-xl border border-amber-200/60 bg-gradient-to-r from-amber-50 via-white to-amber-50 shadow-lg p-4 flex items-start gap-3 cursor-pointer">
        <div className="shrink-0 mt-0.5 size-9 rounded-lg bg-amber-100 flex items-center justify-center ring-1 ring-amber-200/50">
          <Settings className="size-4.5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900 leading-tight">{title}</p>
          <p className="text-xs text-amber-700/80 mt-0.5 leading-relaxed">{desc}</p>
        </div>
      </div>
    ), { duration: 4000 });
  };

  const handleGenerate = async () => {
    if (enterClassroomLoading) return;
    if (!authLoading && !user) {
      setEnterClassroomLoading(true);
      try { localStorage.setItem('pendingPrompt', form.requirement); } catch { /* ignore */ }
      router.push(`/auth/login?redirect=${encodeURIComponent('/?pending_generation=true')}`);
      return;
    }
    if (!currentModelId) {
      showSetupToast(t('settings.modelNotConfigured'), t('settings.setupNeeded'));
      setSettingsOpen(true);
      return;
    }
    if (!form.requirement.trim()) { setError(t('upload.requirementRequired')); return; }
    setEnterClassroomLoading(true);
    if (user) {
      try {
        const planRes = await fetch('/api/user/plan', { cache: 'no-store' });
        if (planRes.ok) {
          const planJson = await planRes.json();
          if (planJson.success && planJson.credits) {
            const remaining = planJson.credits.remaining;
            if (remaining !== 'unlimited' && remaining <= 0) {
              const reason = planJson.plan?.account_type === 'FREE' ? 'free_limit_reached' : 'monthly_limit_reached';
              setExhaustedReason(reason); setShowExhaustedModal(true); setEnterClassroomLoading(false); return;
            }
          }
        }
      } catch { /* non-fatal */ }
    }
    setError(null);
    posthog.capture('classroom_generation_started', { has_pdf: !!form.pdfFile, web_search: !!form.webSearch, language: form.language });
    try {
      const isPortrait = window.matchMedia('(orientation: portrait)').matches;
      const userProfile = useUserProfileStore.getState();
      const requirements: UserRequirements = {
        requirement: form.requirement, language: form.language,
        userNickname: userProfile.nickname || undefined, userBio: userProfile.bio || undefined,
        webSearch: form.webSearch || undefined, aspectRatio: isPortrait ? 'portrait' : 'landscape',
      };
      let pdfStorageKey: string | undefined, pdfFileName: string | undefined,
        pdfProviderId: string | undefined, pdfProviderConfig: { apiKey?: string; baseUrl?: string } | undefined;
      if (form.pdfFile) {
        pdfStorageKey = await storePdfBlob(form.pdfFile);
        pdfFileName = form.pdfFile.name;
        const settings = useSettingsStore.getState();
        pdfProviderId = settings.pdfProviderId;
        const providerCfg = settings.pdfProvidersConfig?.[settings.pdfProviderId];
        if (providerCfg) pdfProviderConfig = { apiKey: providerCfg.apiKey, baseUrl: providerCfg.baseUrl };
      }
      const sessionState = {
        sessionId: nanoid(), requirements, pdfText: '', pdfImages: [], imageStorageIds: [],
        pdfStorageKey, pdfFileName, pdfProviderId, pdfProviderConfig, sceneOutlines: null, currentStep: 'generating' as const,
      };
      sessionStorage.setItem('generationSession', JSON.stringify(sessionState));
      router.push('/generation-preview');
    } catch (err) {
      log.error('Error preparing generation:', err);
      setError(err instanceof Error ? err.message : t('upload.generateFailed'));
      setEnterClassroomLoading(false);
    }
  };

  const handleCreateClassroom = async () => {
    if (createClassroomLoading) return;
    if (!authLoading && !user) {
      try { localStorage.setItem('pendingPrompt', form.requirement); } catch { /* ignore */ }
      router.push(`/auth/login?redirect=${encodeURIComponent('/?pending_generation=true')}`);
      return;
    }
    if (!form.requirement.trim()) { setError(t('upload.requirementRequired')); return; }
    setCreateClassroomLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/create-classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirement: form.requirement, language: form.language,
          enableWebSearch: form.webSearch, enableImageGeneration: true,
          enableVideoGeneration: false, enableTTS: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to queue classroom');
      }
      const json = await res.json();
      setClassroomJob({ jobId: json.jobId as string, requirement: form.requirement, phase: 'background' });
      setShowCreateModal(true);
    } catch (err) {
      log.error('Create classroom error:', err);
      setError(err instanceof Error ? err.message : 'Failed to queue classroom generation');
    } finally {
      setCreateClassroomLoading(false);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setPendingDeleteId(id); };
  const confirmDelete = async (id: string) => {
    setPendingDeleteId(null);
    try { await deleteStageData(id); await loadClassrooms(); }
    catch (err) { log.error('Failed to delete classroom:', err); toast.error('Failed to delete classroom'); }
  };
  const handleRename = async (id: string, newName: string) => {
    try { await renameStage(id, newName); setClassrooms((prev) => prev.map((c) => c.id === id ? { ...c, name: newName } : c)); }
    catch (err) { log.error('Failed to rename classroom:', err); toast.error(t('classroom.renameFailed')); }
  };
  const handleOpenCourse = (classroom: StageListItem) => {
    setPendingIntroPayload({ stageId: classroom.id, name: classroom.name, description: classroom.description ?? '', language: form.language });
    router.push(`/classroom/${classroom.id}`);
  };

  // Load scenes when a My Course outline opens; fetch first slide for Browse courses
  useEffect(() => {
    if (!outlineCourse) { setOutlineScenes([]); setOutlineBrowseThumbnail(undefined); return; }
    if (outlineCourse.source === 'my') {
      setOutlineBrowseThumbnail(undefined);
      db.scenes
        .where('stageId').equals(outlineCourse.item.id)
        .sortBy('order')
        .then((scenes) => setOutlineScenes(scenes.map((s) => ({ id: s.id, title: s.title, type: s.type }))));
    } else {
      setOutlineScenes([]);
      setOutlineBrowseThumbnail(undefined);
      // Fetch course content: use all scenes for the scene list + first slide for thumbnail
      fetch(`/api/courses/${outlineCourse.item.id}/content`)
        .then((r) => r.json())
        .then((data) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const allScenes = (data.scenes ?? []) as any[];
          // Populate scene list
          setOutlineScenes(
            allScenes.map((s: any) => ({
              id: s.id ?? s.scene_id ?? '',
              title: s.title ?? s.name ?? 'Untitled',
              type: s.type ?? s.content?.type ?? 'slide',
            })),
          );
          // First slide canvas → thumbnail
          const firstSlide = allScenes.find((s: any) => s.content?.type === 'slide');
          if (firstSlide?.content?.canvas) setOutlineBrowseThumbnail(firstSlide.content.canvas as Slide);
        })
        .catch(() => {});
    }
  }, [outlineCourse]);

  const handleMyOutlineOpen = (classroom: StageListItem) => {
    setOutlineCourse({ source: 'my', item: classroom });
  };

  const handleBrowseOutlineOpen = (course: Course) => {
    setOutlineCourse({ source: 'browse', item: course });
  };

  const handleOutlineEnterClassroom = () => {
    if (!outlineCourse) return;
    if (outlineCourse.source === 'my') {
      handleOpenCourse(outlineCourse.item);
    } else {
      const c = outlineCourse.item;
      setPendingIntroPayload({ stageId: c.id, name: c.title, description: c.description, language: c.language });
      router.push(`/classroom/${c.id}`);
    }
  };

  const handleSaveCourse = async () => {
    if (!outlineCourse || outlineCourse.source !== 'browse') return;
    const course = outlineCourse.item;
    setOutlineSaving(true);
    try {
      const stageId = await downloadCourseFromSupabase(course.id);
      if (stageId) {
        savedCoursesStore.markSaved(course.id);
        await loadClassrooms();
        toast.success('Course saved to My Courses!');
      } else {
        toast.error('Failed to save course');
      }
    } finally {
      setOutlineSaving(false);
    }
  };

  const canGenerate = !!form.requirement.trim();

  return (
    <div className="h-[100dvh] w-full bg-[#f8fafc] dark:bg-[#111111] flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(t) => { setActiveTab(t); setOutlineCourse(null); }}
        classroomJob={classroomJob}
        onReopenJob={() => setShowCreateModal(true)}
        onClearJob={() => setClassroomJob(null)}
        isAdmin={isAdmin}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile menu — no top bar; floating control only */}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open menu"
          className="lg:hidden fixed top-4 left-4 z-30 size-10 rounded-xl border-2 border-[#073b4c]/15 dark:border-[#333333] bg-white dark:bg-[#1a1a1a] shadow-sm flex items-center justify-center hover:bg-[#f0f4f8] dark:hover:bg-[#2a2a2a] transition-colors"
        >
          <Menu className="size-5 text-[#073b4c]" />
        </button>

        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

        {/* Scrollable content area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-8 max-lg:pt-20">
            <AnimatePresence mode="wait">
              {outlineCourse ? (
                <motion.div
                  key="outline"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <CourseOutlinePage
                    title={outlineCourse.source === 'my' ? outlineCourse.item.name : outlineCourse.item.title}
                    description={outlineCourse.source === 'my' ? outlineCourse.item.description : outlineCourse.item.description}
                    headline={outlineCourse.source === 'browse' ? outlineCourse.item.headline : undefined}
                    language={outlineCourse.source === 'my' ? undefined : outlineCourse.item.language}
                    tags={outlineCourse.source === 'browse' ? outlineCourse.item.tags : undefined}
                    slideCount={outlineCourse.source === 'my' ? outlineCourse.item.sceneCount : outlineCourse.item.slideCount}
                    scenes={outlineScenes}
                    thumbnail={outlineCourse.source === 'my' ? thumbnails[outlineCourse.item.id] : outlineBrowseThumbnail}
                    isMyCourse={outlineCourse.source === 'my'}
                    isSaved={outlineCourse.source === 'browse' && savedCoursesStore.isSaved(outlineCourse.item.id)}
                    savingCourse={outlineSaving}
                    onBack={() => setOutlineCourse(null)}
                    onEnterClassroom={handleOutlineEnterClassroom}
                    onSaveCourse={handleSaveCourse}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  {activeTab === 'new-course' && (
                    <NewCourseTab
                      form={form}
                      updateForm={updateForm}
                      handleGenerate={handleGenerate}
                      handleCreateClassroom={handleCreateClassroom}
                      enterClassroomLoading={enterClassroomLoading}
                      createClassroomLoading={createClassroomLoading}
                      canGenerate={canGenerate}
                      canInstantClassroom={canInstantClassroom}
                      error={error}
                      settingsOpen={settingsOpen}
                      setSettingsOpen={setSettingsOpen}
                    />
                  )}
                  {activeTab === 'my-courses' && (
                    <MyCoursesTab
                      classrooms={classrooms}
                      thumbnails={thumbnails}
                      onSelectCourse={handleMyOutlineOpen}
                      onDeleteCourse={handleDelete}
                      onRenameCourse={handleRename}
                      pendingDeleteId={pendingDeleteId}
                      onConfirmDelete={confirmDelete}
                      onCancelDelete={() => setPendingDeleteId(null)}
                      loading={coursesLoading}
                    />
                  )}
                  {activeTab === 'browse' && <BrowseCoursesTab onSelectCourse={handleBrowseOutlineOpen} />}
                  {activeTab === 'achievements' && <AchievementsTab />}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Modals */}
      <CoursesExhaustedModal open={showExhaustedModal} reason={exhaustedReason} onClose={() => setShowExhaustedModal(false)} />
      <CreateClassroomModal open={showCreateModal} requirement={classroomJob?.requirement ?? ''} onClose={() => setShowCreateModal(false)} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="h-screen w-full flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="size-10 text-[#118ab2] animate-spin" />
      </div>
    }>
      <DashboardPage />
    </Suspense>
  );
}
