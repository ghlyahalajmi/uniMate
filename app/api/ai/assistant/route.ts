import { NextResponse } from 'next/server';
import { withUser, apiError, readJson } from '@/lib/api/helpers';
import { runAgent } from '@/lib/ai/run';
import { unimateAssistant } from '@/lib/ai/agents';
import { loadStudentContext } from '@/lib/ai/context';
import { assistantRequestSchema } from '@/lib/validation/schemas';
import { isAiConfigured } from '@/lib/ai/client';

export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;
  if (!isAiConfigured()) return apiError('ai_not_configured', 200);

  const body = await readJson<unknown>(request, 128 * 1024);
  const parsed = assistantRequestSchema.safeParse(body);
  if (!parsed.success) return apiError('invalid_request', 400, parsed.error.issues[0]?.message);

  const context = await loadStudentContext(auth.ctx.supabase, auth.ctx.userId);
  const outcome = await runAgent(
    unimateAssistant,
    { context, message: parsed.data.message, history: parsed.data.history },
    auth.ctx,
  );

  if (!outcome.ok) return apiError('assistant_failed', 200);
  return NextResponse.json({ ok: true, answer: outcome.data.answer });
}
