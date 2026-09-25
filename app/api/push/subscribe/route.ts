import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api/helpers';
import { createClient } from '@/lib/supabase/server';

/**
 * A device saying where to reach it, and later saying stop.
 *
 * Written through the student's own session, so row level security decides
 * whose device this is. The endpoint is not a secret worth guarding — it is
 * unguessable by construction and useless without the VAPID key — but it is
 * still theirs, and it is stored where only they can read it.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return apiError('unauthorised', 401);

  const body = (await request.json().catch(() => null)) as {
    endpoint?: unknown; p256dh?: unknown; auth?: unknown; userAgent?: unknown;
  } | null;

  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
  // A push endpoint is always an https URL on the browser vendor's own host.
  if (!endpoint.startsWith('https://') || endpoint.length > 1000) {
    return apiError('invalid_request', 400);
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: auth.user.id,
        endpoint,
        p256dh: typeof body?.p256dh === 'string' ? body.p256dh.slice(0, 200) : null,
        auth: typeof body?.auth === 'string' ? body.auth.slice(0, 200) : null,
        user_agent: typeof body?.userAgent === 'string' ? body.userAgent.slice(0, 300) : null,
      },
      { onConflict: 'endpoint' },
    );

  if (error) return apiError('save_failed', 200);
  return NextResponse.json({ ok: true });
}

/** Turning it off on this device, without touching any other. */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return apiError('unauthorised', 401);

  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
  if (!endpoint) return apiError('invalid_request', 400);

  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  return NextResponse.json({ ok: true });
}
