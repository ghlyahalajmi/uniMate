import { NextResponse } from 'next/server';
import { withUser, apiError, readJson } from '@/lib/api/helpers';
import { checkRunRate } from '@/lib/ai/rate-limit';
import { workflowPlanSemester } from '@/lib/workflows';
import { plannerRequestSchema } from '@/lib/validation/schemas';

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

  // A ceiling on how fast one student can spend a model quota. See
  // lib/ai/rate-limit.ts for why twenty in ten minutes.
  const rate = await checkRunRate(auth.ctx);
  if (rate.exceeded) return apiError('rate_limited', 429, String(rate.retryInMinutes));

  const body = await readJson<unknown>(request, 64 * 1024);
  const parsed = plannerRequestSchema.safeParse(body);
  if (!parsed.success) return apiError('invalid_request', 400, parsed.error.issues[0]?.message);

  const result = await workflowPlanSemester(auth.ctx, {
    semester: parsed.data.semester,
    candidateIds: parsed.data.candidate_course_ids,
    targetCourseCount: parsed.data.target_course_count ?? null,
  });
  if (!result.ok) return apiError('planning_failed', 200);

  return NextResponse.json({ ok: true, scheduleIds: result.data?.scheduleIds ?? [] });
}
