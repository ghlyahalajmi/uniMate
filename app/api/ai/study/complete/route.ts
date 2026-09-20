import { NextResponse } from 'next/server';
import { withUser, apiError, readJson } from '@/lib/api/helpers';
import { recordActivity } from '@/lib/momentum/record';

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
  correct: number;
  total: number;
  duration_minutes: number;
  timezone_offset_minutes?: number;
}

/** Closes a practice session and stores its score. */
export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  const body = await readJson<Body>(request, 8 * 1024);
  if (!body?.session_id) return apiError('invalid_request', 400);

  const total = Math.max(0, Number(body.total) || 0);
  const correct = Math.min(total, Math.max(0, Number(body.correct) || 0));

  const { error } = await auth.ctx.supabase
    .from('study_sessions')
    .update({
      completed_at: new Date().toISOString(),
      correct_answers: correct,
      total_questions: total,
      score: total > 0 ? Math.round((correct / total) * 10000) / 100 : null,
      duration_minutes: Math.max(0, Math.round(Number(body.duration_minutes) || 0)),
    })
    .eq('id', body.session_id)
    .eq('user_id', auth.ctx.userId);

  if (error) return apiError('save_failed', 200);

  const momentum = await recordActivity(
    auth.ctx.supabase,
    auth.ctx.userId,
    { kind: 'practice', correctAnswers: correct, questionsAnswered: total },
    { timezoneOffsetMinutes: body.timezone_offset_minutes },
  );

  return NextResponse.json({ ok: true, momentum });
}
