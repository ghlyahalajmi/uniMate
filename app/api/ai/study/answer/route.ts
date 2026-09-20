import { NextResponse } from 'next/server';
import { withUser, apiError, readJson } from '@/lib/api/helpers';

/**
 * These agents call Claude with adaptive thinking, and the slowest of them —
 * reading a photographed timetable, or drafting a full practice set — take
 * well over the default function limit. Vercel kills the function at that
 * limit and the browser sees a bare 504 with no logged ai_run, so the ceiling
 * is raised here rather than discovered in production.
 */
export const maxDuration = 300;

interface Body {
  session_id: string;
  question_id: string;
  given_answer: string;
  is_correct: boolean;
}

/** Records one answer. Attempts feed the adaptive difficulty on the next set. */
export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  const body = await readJson<Body>(request, 32 * 1024);
  if (!body?.question_id || !body?.session_id) return apiError('invalid_request', 400);

  const { error } = await auth.ctx.supabase.from('question_attempts').insert({
    user_id: auth.ctx.userId,
    question_id: body.question_id,
    session_id: body.session_id,
    given_answer: String(body.given_answer ?? '').slice(0, 2000),
    is_correct: Boolean(body.is_correct),
  });
  if (error) return apiError('save_failed', 200);

  return NextResponse.json({ ok: true });
}
