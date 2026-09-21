import { NextResponse } from 'next/server';
import { withUser, apiError, readJson } from '@/lib/api/helpers';
import { markCelebrated } from '@/lib/coach/service';

/** Marks a milestone celebration as shown, so it fires exactly once. */
export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  const body = await readJson<{ code?: string }>(request, 4 * 1024);
  const code = String(body?.code ?? '').slice(0, 64);
  if (!code) return apiError('invalid_request', 400);

  await markCelebrated(code);
  return NextResponse.json({ ok: true });
}
