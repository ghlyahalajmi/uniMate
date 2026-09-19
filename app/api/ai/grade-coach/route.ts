import { NextResponse } from 'next/server';
import { withUser, apiError, readJson } from '@/lib/api/helpers';
import { workflowAnalyseGrade } from '@/lib/workflows';

export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  const body = await readJson<{ course_id?: string }>(request, 8 * 1024);
  if (!body?.course_id) return apiError('invalid_request', 400);

  const result = await workflowAnalyseGrade(auth.ctx, { courseId: body.course_id });
  if (!result.ok) return apiError('analysis_failed', 200);

  return NextResponse.json({ ok: true, ...result.data });
}
