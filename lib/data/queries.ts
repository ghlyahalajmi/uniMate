import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  AiRun, CleaningLogEntry, Course, Grade, GradeScaleEntry, Profile,
  Question, Reminder, Schedule, ScheduleCourse, StudySession, Syllabus,
  SyllabusEvent, Task, Weekday,
} from '@/types/database';
import { DEFAULT_GRADE_SCALE } from '@/lib/calculations/grades';

/**
 * Read helpers for the screens. Every one of these runs as the signed-in user,
 * so row level security is doing the filtering; the explicit user_id filters
 * are for index selectivity, not for access control.
 */

export async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('NOT_AUTHENTICATED');
  return data.user.id;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const userId = await requireUserId();
  const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  return (data as Profile) ?? null;
}

export async function getGradeScale(): Promise<Pick<GradeScaleEntry, 'letter' | 'min_percent' | 'points'>[]> {
  const supabase = await createClient();
  const userId = await requireUserId();
  const { data } = await supabase
    .from('grade_scale_entries')
    .select('letter, min_percent, points')
    .eq('user_id', userId)
    .order('sort_order');
  return data?.length ? data : DEFAULT_GRADE_SCALE.map(({ letter, min_percent, points }) => ({ letter, min_percent, points }));
}

export async function getCourses(): Promise<Course[]> {
  const supabase = await createClient();
  const userId = await requireUserId();
  const { data } = await supabase
    .from('courses')
    .select('*')
    .eq('user_id', userId)
    .order('status')
    .order('course_code');
  return (data as Course[]) ?? [];
}

export async function getCourse(id: string): Promise<Course | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('courses').select('*').eq('id', id).maybeSingle();
  return (data as Course) ?? null;
}

export async function getGrades(courseId?: string): Promise<Grade[]> {
  const supabase = await createClient();
  const userId = await requireUserId();
  let q = supabase.from('grades').select('*').eq('user_id', userId);
  if (courseId) q = q.eq('course_id', courseId);
  const { data } = await q.order('due_date', { nullsFirst: false }).order('created_at');
  return (data as Grade[]) ?? [];
}

export async function getTasks(courseId?: string): Promise<Task[]> {
  const supabase = await createClient();
  const userId = await requireUserId();
  let q = supabase.from('tasks').select('*').eq('user_id', userId);
  if (courseId) q = q.eq('course_id', courseId);
  const { data } = await q.order('status').order('due_date', { nullsFirst: false });
  return (data as Task[]) ?? [];
}

export async function getSyllabi(courseId?: string): Promise<Syllabus[]> {
  const supabase = await createClient();
  const userId = await requireUserId();
  let q = supabase.from('syllabi').select('*').eq('user_id', userId);
  if (courseId) q = q.eq('course_id', courseId);
  const { data } = await q.order('uploaded_at', { ascending: false });
  return (data as Syllabus[]) ?? [];
}

export async function getSyllabusEvents(courseId?: string): Promise<SyllabusEvent[]> {
  const supabase = await createClient();
  const userId = await requireUserId();
  let q = supabase.from('syllabus_events').select('*').eq('user_id', userId);
  if (courseId) q = q.eq('course_id', courseId);
  const { data } = await q.order('event_date', { nullsFirst: false });
  return (data as SyllabusEvent[]) ?? [];
}

export async function getReminders(): Promise<Reminder[]> {
  const supabase = await createClient();
  const userId = await requireUserId();
  const { data } = await supabase
    .from('reminders').select('*').eq('user_id', userId).order('remind_on');
  return (data as Reminder[]) ?? [];
}

export async function getStudySessions(limit = 30): Promise<StudySession[]> {
  const supabase = await createClient();
  const userId = await requireUserId();
  const { data } = await supabase
    .from('study_sessions').select('*').eq('user_id', userId)
    .order('started_at', { ascending: false }).limit(limit);
  return (data as StudySession[]) ?? [];
}

export async function getSessionQuestions(sessionId: string): Promise<Question[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('questions').select('*').eq('session_id', sessionId).order('created_at');
  return (data as Question[]) ?? [];
}

export async function getQuestions(courseId?: string, limit = 50): Promise<Question[]> {
  const supabase = await createClient();
  const userId = await requireUserId();
  let q = supabase.from('questions').select('*').eq('user_id', userId);
  if (courseId) q = q.eq('course_id', courseId);
  const { data } = await q.order('created_at', { ascending: false }).limit(limit);
  return (data as Question[]) ?? [];
}

export async function getAiRuns(limit = 60): Promise<AiRun[]> {
  const supabase = await createClient();
  const userId = await requireUserId();
  const { data } = await supabase
    .from('ai_runs').select('*').eq('user_id', userId)
    .order('started_at', { ascending: false }).limit(limit);
  return (data as AiRun[]) ?? [];
}

export async function getCleaningLog(limit = 100): Promise<CleaningLogEntry[]> {
  const supabase = await createClient();
  const userId = await requireUserId();
  const { data } = await supabase
    .from('cleaning_log').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(limit);
  return (data as CleaningLogEntry[]) ?? [];
}

export async function getSchedules(): Promise<Array<Schedule & { courses: ScheduleCourse[] }>> {
  const supabase = await createClient();
  const userId = await requireUserId();
  const { data } = await supabase
    .from('schedules')
    .select('*, schedule_courses(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return ((data as Array<Schedule & { schedule_courses: ScheduleCourse[] }>) ?? []).map((s) => ({
    ...s,
    courses: s.schedule_courses ?? [],
  }));
}

/** Weekday key for a Date, matching the `days` column's values. */
export const WEEKDAY_KEYS: Weekday[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

export function weekdayOf(date: Date): Weekday {
  return WEEKDAY_KEYS[date.getDay()];
}

export function groupGradesByCourse(grades: Grade[]): Map<string, Grade[]> {
  const map = new Map<string, Grade[]>();
  for (const g of grades) {
    const list = map.get(g.course_id) ?? [];
    list.push(g);
    map.set(g.course_id, list);
  }
  return map;
}
