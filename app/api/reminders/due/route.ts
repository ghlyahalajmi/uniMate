import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api/helpers';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Reminders whose moment has arrived and which have not been announced yet.
 *
 * The comparison happens here rather than in SQL because "now" belongs to the
 * student's own clock: a reminder set for 19:00 in Kuwait must not fire at
 * 19:00 in Virginia. The browser sends its own date and time, and the worst a
 * tampered value can do is show that student their own reminder early.
 *
 * Every row is read through the session, so row level security is what decides
 * whose reminders these are.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return apiError('unauthorised', 401);

  const url = new URL(request.url);
  const day = url.searchParams.get('day') ?? '';
  const time = url.searchParams.get('time') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return apiError('invalid_request', 400);
  }

  const { data, error } = await supabase
    .from('reminders')
    .select('id, title, body, remind_on, remind_at')
    .eq('status', 'scheduled')
    .is('notified_at', null)
    .lte('remind_on', day)
    .order('remind_on')
    .limit(20);

  if (error) return NextResponse.json({ ok: true, due: [] });

  const rows = (data ?? []) as Array<{
    id: string; title: string; body: string | null;
    remind_on: string; remind_at: string | null;
  }>;

  // A reminder with no time is due from the start of its day; one with a time
  // waits for it.
  const due = rows.filter((r) =>
    r.remind_on < day || !r.remind_at || r.remind_at.slice(0, 5) <= time,
  );

  return NextResponse.json({
    ok: true,
    due: due.map((r) => ({ id: r.id, title: r.title, body: r.body, at: r.remind_at })),
  });
}

/** Mark reminders as announced, so they do not fire again on the next load. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return apiError('unauthorised', 401);

  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((v): v is string => typeof v === 'string').slice(0, 20)
    : [];
  if (ids.length === 0) return NextResponse.json({ ok: true });

  await supabase
    .from('reminders')
    .update({ notified_at: new Date().toISOString() })
    .in('id', ids);

  return NextResponse.json({ ok: true });
}
