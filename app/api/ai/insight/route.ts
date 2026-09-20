import { NextResponse } from 'next/server';
import { withUser, apiError } from '@/lib/api/helpers';
import { runAgent } from '@/lib/ai/run';
import { dashboardInsight } from '@/lib/ai/agents';
import { loadStudentContext } from '@/lib/ai/context';
import { isAiConfigured } from '@/lib/ai/client';

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

  const context = await loadStudentContext(auth.ctx.supabase, auth.ctx.userId);
  const outcome = await runAgent(dashboardInsight, { context }, auth.ctx);

  if (!outcome.ok) {
    return apiError(isAiConfigured() ? 'insight_failed' : 'ai_not_configured', 200);
  }
  return NextResponse.json({ ok: true, ...outcome.data, source: outcome.source });
}
