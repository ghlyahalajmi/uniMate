import { NextResponse } from 'next/server';
import { withUser, apiError } from '@/lib/api/helpers';
import { workflowPlanTasks } from '@/lib/workflows';

/**
 * These agents call Claude with adaptive thinking, and the slowest of them —
 * reading a photographed timetable, or drafting a full practice set — take
 * well over the default function limit. Vercel kills the function at that
 * limit and the browser sees a bare 504 with no logged ai_run, so the ceiling
 * is raised here rather than discovered in production.
 */
export const maxDuration = 300;

export async function POST() {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  const result = await workflowPlanTasks(auth.ctx, 14);
  if (!result.ok) return apiError('planning_failed', 200);

  return NextResponse.json({ ok: true, created: result.data?.created ?? 0 });
}
