import { NextResponse } from 'next/server';
import { withUser, apiError, readJson } from '@/lib/api/helpers';
import { recordActivity } from '@/lib/momentum/record';

interface Body {
  minutes: number;
  course_id?: string | null;
  topic?: string | null;
  timezone_offset_minutes?: number;
}

/**
 * Logs a completed focus block. It writes a real study_sessions row so the
 * time shows up in analytics and the records screen alongside everything
 * else, rather than living only in the momentum layer.
 */
export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  const body = await readJson<Body>(request, 8 * 1024);
  const minutes = Math.round(Number(body?.minutes ?? 0));

  // A block under a minute is a misfire, and one over four hours is a stuck
  // timer rather than a study session.
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) {
    return apiError('invalid_request', 400);
  }

  const { error } = await auth.ctx.supabase.from('study_sessions').insert({
    user_id: auth.ctx.userId,
    course_id: body?.course_id ?? null,
    topic: body?.topic?.slice(0, 200) ?? null,
    mode: 'focus',
    duration_minutes: minutes,
    total_questions: 0,
    correct_answers: 0,
    completed_at: new Date().toISOString(),
  });
  if (error) return apiError('save_failed', 200);

  const momentum = await recordActivity(
    auth.ctx.supabase,
    auth.ctx.userId,
    { kind: 'focus', focusMinutes: minutes },
    { timezoneOffsetMinutes: body?.timezone_offset_minutes },
  );

  return NextResponse.json({ ok: true, minutes, momentum });
}
