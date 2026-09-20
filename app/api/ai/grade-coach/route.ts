import { NextResponse } from 'next/server';
import { withUser, apiError, readJson } from '@/lib/api/helpers';
import { workflowAnalyseGrade } from '@/lib/workflows';

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

  const body = await readJson<{ course_id?: string }>(request, 8 * 1024);
  if (!body?.course_id) return apiError('invalid_request', 400);

  const result = await workflowAnalyseGrade(auth.ctx, { courseId: body.course_id });
  if (!result.ok) return apiError('analysis_failed', 200);

  return NextResponse.json({ ok: true, ...result.data });
}
