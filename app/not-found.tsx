import Link from 'next/link';
import { BookOpen } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full bg-[#f8fafc] dark:bg-[#111111] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-8 flex items-center justify-center gap-2.5">
          <div className="size-10 rounded-xl bg-[#073b4c] flex items-center justify-center shrink-0">
            <BookOpen className="size-5 text-[#ffd166]" />
          </div>
          <span className="text-2xl font-black text-[#073b4c] dark:text-[#f0f0f0] tracking-[-0.02em]">
            SLATE UP
          </span>
        </div>

        <p className="text-[#118ab2] font-bold text-sm uppercase tracking-wider mb-3">
          404
        </p>
        <h1 className="text-3xl sm:text-4xl font-black text-[#073b4c] dark:text-[#f0f0f0] tracking-[-0.02em] mb-3">
          This page could not be found.
        </h1>
        <p className="text-[#073b4c]/70 dark:text-[#a3a3a3] mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has moved. Let&apos;s get you back to your courses.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-[#073b4c] text-white font-bold text-sm hover:bg-[#073b4c]/90 transition-colors shadow-[3px_3px_0_rgba(7,59,76,0.15)]"
          >
            Back to Dashboard
          </Link>
          <Link
            href="/?tab=browse"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl border-2 border-[#073b4c]/15 dark:border-[#333333] bg-white dark:bg-[#1a1a1a] text-[#073b4c] dark:text-[#f0f0f0] font-bold text-sm hover:bg-[#f0f4f8] dark:hover:bg-[#222222] transition-colors"
          >
            Browse Courses
          </Link>
        </div>
      </div>
    </div>
  );
}
