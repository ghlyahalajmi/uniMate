import { NextResponse } from 'next/server';
import { withUser, apiError, readJson } from '@/lib/api/helpers';
import { workflowPlanSemester } from '@/lib/workflows';
import { plannerRequestSchema } from '@/lib/validation/schemas';

export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  const body = await readJson<unknown>(request, 64 * 1024);
  const parsed = plannerRequestSchema.safeParse(body);
  if (!parsed.success) return apiError('invalid_request', 400, parsed.error.issues[0]?.message);

  const result = await workflowPlanSemester(auth.ctx, {
    semester: parsed.data.semester,
    candidateIds: parsed.data.candidate_course_ids,
  });
  if (!result.ok) return apiError('planning_failed', 200);

  return NextResponse.json({ ok: true, scheduleIds: result.data?.scheduleIds ?? [] });
}
