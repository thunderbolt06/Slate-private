import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/utils/supabase/admin';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { getRequestUser } from '@/utils/supabase/auth-bridge';

/**
 * Certificates API
 * Handles certificate creation and storage.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      courseId,
      courseName,
      studentName,
      grade,
      score,
      topics,
      watchTimePercentage,
      quizScoreAverage,
      engagementCount
    } = body;

    if (!courseId || !courseName || !studentName) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing required certificate details');
    }

    const user = await getRequestUser(req);
    if (!user) {
      return apiError('UNAUTHORIZED', 401, 'You must be logged in to claim a certificate');
    }

    // Use admin client so writes work for both cookie- and bearer-authed callers.
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('certificates')
      .upsert({
        user_id: user.id,
        course_id: courseId,
        course_name: courseName,
        student_name: studentName,
        grade,
        score,
        topics: topics || [],
        watch_time_percentage: watchTimePercentage,
        quiz_score_average: quizScoreAverage,
        engagement_count: engagementCount,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,course_id'
      })
      .select('id')
      .single();

    if (error) {
      console.error('[api/certificates] DB Error:', error);
      throw error;
    }

    return apiSuccess({ id: data.id });
  } catch (error) {
    console.error('[api/certificates] Error:', error);
    return apiError('INTERNAL_ERROR', 500, 'Failed to save certificate');
  }
}

/**
 * GET /api/certificates?id=...   → fetch a certificate by ID (Public)
 * GET /api/certificates           → list the authenticated user's certificates
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const cookieStore = await cookies();
      const supabase = createClient(cookieStore);
      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return apiError('INVALID_REQUEST', 404, 'Certificate not found');
        throw error;
      }

      return apiSuccess(data);
    }

    // No id → list mine. Requires auth.
    const user = await getRequestUser(req);
    if (!user) {
      return apiError('UNAUTHORIZED', 401, 'Sign in to view certificates');
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('certificates')
      .select('id, course_id, course_name, student_name, grade, score, topics, created_at, pdf_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return apiSuccess({
      certificates: (data ?? []).map((c) => ({
        id: c.id,
        courseId: c.course_id,
        courseName: c.course_name,
        issuedAt: c.created_at,
        pdfUrl: c.pdf_url ?? undefined,
      })),
    });
  } catch (error) {
    console.error('[api/certificates] GET Error:', error);
    return apiError('INTERNAL_ERROR', 500, 'Failed to fetch certificate');
  }
}
