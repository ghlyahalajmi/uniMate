import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Search across the student's own records.
 *
 * Every query here runs on the request's session, so row level security is
 * what decides which rows exist to be searched — there is no service-role read
 * in this path and no user id taken from the request. A student searching
 * "midterm" can only ever match their own midterm.
 */

export type SearchKind =
  | 'course' | 'task' | 'note' | 'grade' | 'event' | 'reminder' | 'flashcard';

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

/** Per table, so one noisy kind cannot fill the list. */
const PER_KIND = 4;

/**
 * What is safe to put inside an `ilike` pattern.
 *
 * `%` and `_` are wildcards and would turn a typo into a scan; a comma ends a
 * term in PostgREST's `or()` syntax and would change which columns are
 * searched. None of them are worth supporting in a search box.
 */
function sanitise(raw: string): string {
  return raw.replace(/[%_,()*\\]/g, ' ').trim().slice(0, 80);
}

export async function searchRecords(raw: string): Promise<SearchHit[]> {
  const term = sanitise(raw);
  if (term.length < 2) return [];

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const like = `%${term}%`;

  const [courses, tasks, notes, grades, events, reminders, cards] = await Promise.all([
    supabase.from('courses')
      .select('id, course_code, course_name, instructor, room')
      .or(`course_code.ilike.${like},course_name.ilike.${like},instructor.ilike.${like}`)
      .limit(PER_KIND),
    supabase.from('tasks')
      .select('id, title, description, status, due_date')
      .or(`title.ilike.${like},description.ilike.${like}`)
      .limit(PER_KIND),
    supabase.from('notes')
      .select('id, title')
      .ilike('title', like)
      .eq('is_archived', false)
      .limit(PER_KIND),
    supabase.from('grades')
      .select('id, assessment_name, assessment_type, score, max_score')
      .ilike('assessment_name', like)
      .limit(PER_KIND),
    supabase.from('syllabus_events')
      .select('id, title, event_type, event_date')
      .ilike('title', like)
      .limit(PER_KIND),
    supabase.from('reminders')
      .select('id, title, remind_on')
      .ilike('title', like)
      .limit(PER_KIND),
    supabase.from('flashcards')
      .select('id, front, topic')
      .or(`front.ilike.${like},topic.ilike.${like}`)
      .limit(PER_KIND),
  ]);

  const hits: SearchHit[] = [];

  for (const c of courses.data ?? []) {
    hits.push({
      kind: 'course',
      id: c.id,
      title: `${c.course_code} · ${c.course_name}`,
      subtitle: c.instructor ?? c.room ?? null,
      href: `/courses/${c.id}`,
    });
  }

  for (const tk of tasks.data ?? []) {
    hits.push({
      kind: 'task', id: tk.id, title: tk.title,
      subtitle: tk.due_date ?? null, href: '/tasks',
    });
  }

  for (const n of notes.data ?? []) {
    hits.push({ kind: 'note', id: n.id, title: n.title, subtitle: null, href: '/notes' });
  }

  for (const g of grades.data ?? []) {
    hits.push({
      kind: 'grade', id: g.id, title: g.assessment_name,
      subtitle: g.score === null ? null : `${g.score}/${g.max_score}`,
      href: '/grades',
    });
  }

  for (const e of events.data ?? []) {
    hits.push({
      kind: 'event', id: e.id, title: e.title,
      subtitle: e.event_date ?? null, href: '/calendar',
    });
  }

  for (const r of reminders.data ?? []) {
    hits.push({
      kind: 'reminder', id: r.id, title: r.title,
      subtitle: r.remind_on ?? null, href: '/calendar',
    });
  }

  for (const f of cards.data ?? []) {
    hits.push({
      kind: 'flashcard', id: f.id, title: f.front,
      subtitle: f.topic ?? null, href: '/flashcards',
    });
  }

  return hits;
}
