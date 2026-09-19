import { NextResponse } from 'next/server';
import { withUser, apiError, readJson } from '@/lib/api/helpers';

interface Body {
  session_id: string;
  correct: number;
  total: number;
  duration_minutes: number;
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
  return NextResponse.json({ ok: true });
}
