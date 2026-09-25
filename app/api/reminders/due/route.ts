import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api/helpers';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/server';
import { formatDate } from '@/lib/i18n/format';

export const dynamic = 'force-dynamic';

/**
 * Everything the app owes the student's attention right now: a reminder whose
 * moment has arrived, and a task whose day has gone.
 *
 * The comparison happens here rather than in SQL because "now" belongs to the
 * student's own clock: a reminder set for 19:00 in Kuwait must not fire at
 * 19:00 in Virginia, and a task due today is not late until today is over
 * where the student is. The browser sends its own date and time, and the worst
 * a tampered value can do is show that student their own reminder early.
 *
 * Every row is read through the session, so row level security is what decides
 * whose reminders and whose tasks these are.
 *
 * Ids come back prefixed — `reminder:<id>`, `task:<id>` — because two tables
 * now share one queue and an id on its own no longer says which table it came
 * from. A bare id is still read as a reminder, so a service worker cached from
 * before this change keeps working.
 */

interface Item {
  id: string;
  kind: 'reminder' | 'task';
  title: string;
  body: string | null;
  at: string | null;
}

/** Enough for one nudge; more than this on a screen is noise, not a notice. */
const MAX_TASKS = 3;

/**
 * How far back a missed deadline is still worth mentioning.
 *
 * A task that slipped past yesterday is a thing to go and finish. One from two
 * months ago is a thing the student has already decided about, and announcing
 * it now — with a chime, on their phone — teaches them that the alert is not
 * worth reading. The same window is written into the push job, so the database
 * never wakes a device for something this route would not show.
 */
const STILL_WORTH_SAYING_DAYS = 14;

/** `day` moved back by `days`, kept as a bare `YYYY-MM-DD`. */
function daysBefore(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

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

  const [reminders, tasks] = await Promise.all([
    supabase
      .from('reminders')
      .select('id, title, body, remind_on, remind_at')
      .eq('status', 'scheduled')
      .is('notified_at', null)
      .lte('remind_on', day)
      .order('remind_on')
      .limit(20),
    /*
     * A task is late only once the whole of its day has gone — `lt`, not
     * `lte`. Due today is not missed; it is today, and telling somebody they
     * have missed something they still have the evening to do is the fastest
     * way to teach them to ignore the alert.
     */
    supabase
      .from('tasks')
      .select('id, title, due_date')
      .neq('status', 'completed')
      .is('overdue_notified_at', null)
      .not('due_date', 'is', null)
      .lt('due_date', day)
      .gte('due_date', daysBefore(day, STILL_WORTH_SAYING_DAYS))
      // Most recently missed first: that is the one still worth rescuing.
      .order('due_date', { ascending: false })
      .limit(MAX_TASKS),
  ]);

  const due: Item[] = [];

  if (!reminders.error) {
    const rows = (reminders.data ?? []) as Array<{
      id: string; title: string; body: string | null;
      remind_on: string; remind_at: string | null;
    }>;

    // A reminder with no time is due from the start of its day; one with a
    // time waits for it.
    for (const r of rows) {
      if (r.remind_on < day || !r.remind_at || r.remind_at.slice(0, 5) <= time) {
        due.push({ id: `reminder:${r.id}`, kind: 'reminder', title: r.title, body: r.body, at: r.remind_at });
      }
    }
  }

  if (!tasks.error && (tasks.data ?? []).length > 0) {
    /*
     * The words are built here, in the student's own language, because the
     * other reader of this route is the service worker — which shows these on
     * a lock screen with no React, no provider and no dictionary of its own.
     */
    const { locale, t } = await getDictionary();
    const rows = (tasks.data ?? []) as Array<{ id: string; title: string; due_date: string }>;

    for (const task of rows) {
      due.push({
        id: `task:${task.id}`,
        kind: 'task',
        title: task.title,
        body: t.tasks.overdueBody.replace('{date}', formatDate(task.due_date, locale)),
        at: null,
      });
    }
  }

  return NextResponse.json({ ok: true, due });
}

/** Mark items as announced, so they do not fire again on the next load. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return apiError('unauthorised', 401);

  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((v): v is string => typeof v === 'string').slice(0, 30)
    : [];
  if (ids.length === 0) return NextResponse.json({ ok: true });

  const reminderIds = ids
    .filter((id) => !id.startsWith('task:'))
    .map((id) => id.replace(/^reminder:/, ''));
  const taskIds = ids.filter((id) => id.startsWith('task:')).map((id) => id.slice(5));

  const now = new Date().toISOString();

  await Promise.all([
    reminderIds.length > 0
      ? supabase.from('reminders').update({ notified_at: now }).in('id', reminderIds)
      : Promise.resolve(),
    taskIds.length > 0
      ? supabase.from('tasks').update({ overdue_notified_at: now }).in('id', taskIds)
      : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true });
}
