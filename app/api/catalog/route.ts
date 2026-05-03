import { type NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/admin';
import { getRequestUser } from '@/utils/supabase/auth-bridge';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('CatalogAPI');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const anonSupabase = createSupabaseClient(supabaseUrl, supabaseKey);

type CourseTagRowLike = { tag_type: string; tag_value: string };
type CourseRowLike = {
  id: string;
  user_id: string | null;
  name?: string | null;
  title?: string | null;
  headline?: string | null;
  description?: string | null;
  slide_count?: number | null;
  language?: string | null;
  created_at?: string | null;
  subject?: string | null;
  topic?: string | null;
  sub_topic?: string | null;
  age_range?: string | null;
  course_tags?: CourseTagRowLike[] | null;
  [key: string]: unknown;
};
type UserPlanVisibilityLike = { user_id: string; is_public: boolean };

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const subject = searchParams.get('subject');
    const topic = searchParams.get('topic');
    const age = searchParams.get('age');
    const query = searchParams.get('q');
    const filter = searchParams.get('filter') || 'public'; // 'public' | 'my'
    const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');

    // For "my courses" we need the authenticated user
    let currentUserId: string | null = null;
    if (filter === 'my') {
      try {
        const user = await getRequestUser(req);
        currentUserId = user?.id ?? null;
      } catch { /* ignore */ }

      if (!currentUserId) {
        return apiSuccess({ courses: [], total: 0, offset, limit, hasMore: false });
      }
    }

    let supabaseQuery = anonSupabase
      .from('courses')
      .select('*, course_tags(*)', { count: 'exact' });

    // ── Filter by ownership or public visibility ──────────────────────────────
    if (filter === 'my' && currentUserId) {
      supabaseQuery = supabaseQuery.eq('user_id', currentUserId);
    } else {
      // Public: only courses from users marked is_public=true in user_plans
      // We join via a sub-select using the user_id on courses
      supabaseQuery = supabaseQuery.not('user_id', 'is', null);
      // We'll filter by public users after fetching (Supabase anon client can't
      // do server-side JOINs across RLS-protected tables from the catalog query)
    }

    // ── Full-text search ──────────────────────────────────────────────────────
    if (query) {
      supabaseQuery = supabaseQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
    }

    const { data: courses, count, error } = await supabaseQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      log.error('Supabase query error:', error);
      return apiError('INTERNAL_ERROR', 500, 'Failed to fetch catalog');
    }

    const rawCourses = (courses || []) as CourseRowLike[];
    const rawCount = rawCourses.length;
    let filteredCourses = rawCourses;

    // ── For public filter: restrict to public users ───────────────────────────
    if (filter !== 'my' && filteredCourses.length > 0) {
      const userIds = [...new Set(filteredCourses.map((c) => c.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        // IMPORTANT: user_plans is typically RLS-protected; use admin client to evaluate
        // visibility without leaking anything beyond the boolean + user_id.
        const admin = createAdminClient();
        const { data: anyPlans } = await admin
          .from('user_plans')
          .select('user_id,is_public')
          .in('user_id', userIds);
        const anyPlansArr = (anyPlans ?? []) as UserPlanVisibilityLike[];
        const publicUserSet = new Set(anyPlansArr.filter((p) => p.is_public).map((p) => p.user_id));
        filteredCourses = filteredCourses.filter(
          (c) => !c.user_id || publicUserSet.has(c.user_id),
        );
      } else {
        filteredCourses = [];
      }
    }

    // ── Post-filter for subject / topic / age ─────────────────────────────────
    if (subject || topic || age) {
      filteredCourses = filteredCourses.filter((course) => {
        const tags = (course.course_tags || []) as CourseTagRowLike[];
        const tagSubject = tags.find((t) => t.tag_type === 'subject')?.tag_value;
        const tagTopic   = tags.find((t) => t.tag_type === 'topic')?.tag_value;
        const matchesSubject = !subject || course.subject === subject || tagSubject === subject;
        const matchesTopic = !topic || course.topic === topic || tagTopic === topic;

        let matchesAge = true;
        if (age) {
          const ageNum = parseInt(age);
          if (course.age_range) {
            const [min, max] = course.age_range.split('-').map(Number);
            matchesAge = !isNaN(min) && !isNaN(max) && ageNum >= min && ageNum <= max;
          } else {
            const tags = course.course_tags || [];
            matchesAge = tags.some((t: { tag_type: string; tag_value: string }) => {
              if (t.tag_type === 'age_range') {
                const [min, max] = t.tag_value.split('-').map(Number);
                return !isNaN(min) && !isNaN(max) && ageNum >= min && ageNum <= max;
              }
              return false;
            });
          }
        }

        return matchesSubject && matchesTopic && matchesAge;
      });
    }

    const result = filteredCourses.map((c) => ({
      id: c.id,
      title: c.name || c.title,
      headline: c.headline,
      description: c.description,
      slideCount: c.slide_count,
      language: c.language,
      createdAt: c.created_at,
      tags: {
        subject: c.subject,
        age_range: c.age_range,
        topic: c.topic,
        sub_topic: c.sub_topic,
        ...(c.course_tags || []).reduce((acc: Record<string, string>, t: { tag_type: string; tag_value: string }) => {
          acc[t.tag_type] = t.tag_value;
          return acc;
        }, {}),
      },
    }));

    return apiSuccess({
      courses: result,
      total: count,
      offset,
      limit,
      hasMore: rawCount === limit,
    });
  } catch (error) {
    log.error('Catalog processing error:', error);
    return apiError('INTERNAL_ERROR', 500, 'An unexpected error occurred');
  }
}
