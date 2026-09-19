import { NextResponse } from 'next/server';
import { withUser, apiError } from '@/lib/api/helpers';
import { workflowAnalyseRecord } from '@/lib/workflows';
import { isAiConfigured } from '@/lib/ai/client';

export async function POST() {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  const result = await workflowAnalyseRecord(auth.ctx);
  if (!result.ok) {
    return apiError(isAiConfigured() ? 'analysis_failed' : 'ai_not_configured', 200);
  }
  return NextResponse.json({ ok: true, ...result.data });
}
