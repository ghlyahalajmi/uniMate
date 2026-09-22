import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api/helpers';
import { getCurrentUser } from '@/lib/supabase/server';
import { searchRecords } from '@/lib/search/query';

export const dynamic = 'force-dynamic';

/**
 * The search box asks here.
 *
 * Signed in or nothing: an unauthenticated request never reaches the query, so
 * the box cannot be used to probe for other students' records from outside.
 * The term is the only input, and whose rows it runs against is decided by the
 * session rather than by anything the caller sends.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError('unauthorised', 401);

  const term = new URL(request.url).searchParams.get('q') ?? '';
  const hits = await searchRecords(term);

  return NextResponse.json({ ok: true, hits });
}
