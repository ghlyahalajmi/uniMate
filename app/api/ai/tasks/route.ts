import { NextResponse } from 'next/server';
import { withUser, apiError } from '@/lib/api/helpers';
import { workflowPlanTasks } from '@/lib/workflows';

export async function POST() {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  const result = await workflowPlanTasks(auth.ctx, 14);
  if (!result.ok) return apiError('planning_failed', 200);

  return NextResponse.json({ ok: true, created: result.data?.created ?? 0 });
}
