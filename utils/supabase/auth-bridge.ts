import type { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

/**
 * Returns the authenticated user using either the Supabase session cookie
 * (browser / Next pages) or an `Authorization: Bearer <jwt>` header (mobile
 * client). Falls back to null on either failure path.
 *
 * Webapp cookie auth keeps working unchanged. Mobile attaches the supabase
 * access_token returned by `supabase.auth.getSession()` and the bearer is
 * verified via the admin client (`auth.getUser(token)`), which bypasses RLS
 * to avoid coupling auth to RLS policies.
 *
 * Add this to any /api/* route that previously used the cookie path.
 */
export async function getRequestUser(req: NextRequest): Promise<User | null> {
  const auth = req.headers.get('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token) {
      try {
        const admin = createAdminClient();
        const { data, error } = await admin.auth.getUser(token);
        if (!error && data.user) return data.user;
      } catch {
        // fall through to cookie path
      }
    }
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
}
