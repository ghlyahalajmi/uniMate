import 'server-only';
import { NextResponse } from 'next/server';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { agentContext } from '@/lib/workflows';
import type { AgentRunContext } from '@/lib/ai/run';

/** Standard JSON error. Never leaks a stack trace or an API key. */
export function apiError(code: string, status = 400, detail?: string) {
  return NextResponse.json({ ok: false, error: code, detail }, { status });
}

/**
 * Resolves the signed-in user and an agent context, or returns a 401 response.
 * Every AI route starts here, so none of them can run unauthenticated.
 */
export async function withUser(): Promise<
  { ok: true; ctx: AgentRunContext } | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, response: apiError('unauthorised', 401) };
  const supabase = await createClient();
  return { ok: true, ctx: agentContext(supabase, user.id) };
}

/** Guards a request body against oversized or malformed JSON. */
export async function readJson<T>(request: Request, maxBytes = 16 * 1024 * 1024): Promise<T | null> {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > maxBytes) return null;
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
