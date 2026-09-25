import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { sendEmptyPush, pushConfigured } from '@/lib/push/vapid';

/**
 * The minute hand.
 *
 * Called by the database itself — a pg_cron job every minute, posting through
 * pg_net — because a reminder set for 19:03 is wrong at 19:30, and the only
 * scheduler with minute precision this project already has is the one inside
 * Postgres.
 *
 * The database does the looking and hands over a list of addresses. This route
 * has no database credential of its own and could not read a reminder if it
 * wanted to: it signs a push, sends an empty one to each address, and reports
 * which addresses are dead so the caller can drop them. So the one piece of
 * this feature that runs on a schedule, unattended, with a shared secret, is
 * also the piece that can see the least.
 *
 * Nothing about a reminder is sent. The phone asks UniMate for the words
 * itself, with the student's own session — see public/sw.js.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** One minute of reminders across a class is nowhere near this. */
const MAX_ENDPOINTS = 500;

function authorised(request: Request): boolean {
  const secret = process.env.PUSH_CRON_SECRET;
  if (!secret || secret.length < 16) return false;

  const provided = request.headers.get('x-unimate-push') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  // Length first: timingSafeEqual throws when the two differ.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 });
  }
  if (!pushConfigured()) {
    return NextResponse.json({ ok: false, error: 'push_not_configured' }, { status: 200 });
  }

  const body = (await request.json().catch(() => null)) as { endpoints?: unknown } | null;
  const endpoints = Array.isArray(body?.endpoints)
    ? body.endpoints
        .filter((v): v is string => typeof v === 'string' && v.startsWith('https://'))
        .slice(0, MAX_ENDPOINTS)
    : [];

  if (endpoints.length === 0) return NextResponse.json({ ok: true, sent: 0, gone: [] });

  const results = await Promise.all(endpoints.map((e) => sendEmptyPush(e)));

  return NextResponse.json({
    ok: true,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok && !r.gone).length,
    // 404 and 410 mean the browser threw the subscription away — the app was
    // removed, or site data cleared. Naming them lets the caller stop trying.
    gone: results.filter((r) => r.gone).map((r) => r.endpoint),
  });
}
