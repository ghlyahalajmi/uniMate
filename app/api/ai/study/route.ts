import { NextResponse } from 'next/server';
import { withUser, apiError, readJson } from '@/lib/api/helpers';
import { workflowGenerateQuestions } from '@/lib/workflows';
import { studyRequestSchema } from '@/lib/validation/schemas';
import { isAiConfigured } from '@/lib/ai/client';
import { createClient } from '@/lib/supabase/server';

/**
 * These agents call Claude with adaptive thinking, and the slowest of them —
 * reading a photographed timetable, or drafting a full practice set — take
 * well over the default function limit. Vercel kills the function at that
 * limit and the browser sees a bare 504 with no logged ai_run, so the ceiling
 * is raised here rather than discovered in production.
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;
  if (!isAiConfigured()) return apiError('ai_not_configured', 200);

  const body = await readJson<unknown>(request, 64 * 1024);
  const parsed = studyRequestSchema.safeParse(body);
  if (!parsed.success) return apiError('invalid_request', 400, parsed.error.issues[0]?.message);

  const result = await workflowGenerateQuestions(auth.ctx, {
    courseId: parsed.data.course_id,
    mode: parsed.data.mode,
    difficulty: parsed.data.difficulty,
    topic: parsed.data.topic,
  });
  if (!result.ok || !result.data) return apiError('generation_failed', 200);

  // Return the saved rows so the client renders exactly what is stored.
  const supabase = await createClient();
  const { data: questions } = await supabase
    .from('questions').select('*').eq('session_id', result.data.sessionId).order('created_at');

  return NextResponse.json({
    ok: true,
    sessionId: result.data.sessionId,
    questions: questions ?? [],
  });
}
