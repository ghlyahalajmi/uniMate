import { NextResponse } from 'next/server';
import { withUser, apiError } from '@/lib/api/helpers';
import { runAgent } from '@/lib/ai/run';
import { dashboardInsight } from '@/lib/ai/agents';
import { loadStudentContext } from '@/lib/ai/context';
import { isAiConfigured } from '@/lib/ai/client';

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
