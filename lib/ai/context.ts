import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Course, Grade, GradeScaleEntry, Profile, Reminder, StudySession,
  Syllabus, SyllabusEvent, Task, QuestionAttempt,
} from '@/types/database';
import { computeCourseGrade, requiredForTarget, DEFAULT_GRADE_SCALE } from '@/lib/calculations/grades';
import { cumulativeGpa, semesterGpa } from '@/lib/calculations/gpa';

/**
 * Everything the agents are allowed to reason from. If a fact is not in here
 * it is not in the student's records, and the agent must say so rather than
 * fill the gap.
 */
export interface StudentContext {
  profile: Profile | null;
  courses: Course[];
  grades: Grade[];
  tasks: Task[];
  syllabi: Syllabus[];
  events: SyllabusEvent[];
  reminders: Reminder[];
  sessions: StudySession[];
  attempts: QuestionAttempt[];
  scale: Pick<GradeScaleEntry, 'letter' | 'min_percent' | 'points'>[];
}

export async function loadStudentContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<StudentContext> {
  const [
    profile, courses, grades, tasks, syllabi, events, reminders, sessions, attempts, scale,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('courses').select('*').eq('user_id', userId).order('course_code'),
    supabase.from('grades').select('*').eq('user_id', userId),
    supabase.from('tasks').select('*').eq('user_id', userId).order('due_date', { nullsFirst: false }),
    supabase.from('syllabi').select('*').eq('user_id', userId),
    supabase.from('syllabus_events').select('*').eq('user_id', userId).order('event_date'),
    supabase.from('reminders').select('*').eq('user_id', userId).order('remind_on'),
    supabase.from('study_sessions').select('*').eq('user_id', userId).order('started_at', { ascending: false }).limit(40),
    supabase.from('question_attempts').select('*').eq('user_id', userId).order('answered_at', { ascending: false }).limit(200),
    supabase.from('grade_scale_entries').select('*').eq('user_id', userId).order('sort_order'),
  ]);

  return {
    profile: (profile.data as Profile) ?? null,
    courses: (courses.data as Course[]) ?? [],
    grades: (grades.data as Grade[]) ?? [],
    tasks: (tasks.data as Task[]) ?? [],
    syllabi: (syllabi.data as Syllabus[]) ?? [],
    events: (events.data as SyllabusEvent[]) ?? [],
    reminders: (reminders.data as Reminder[]) ?? [],
    sessions: (sessions.data as StudySession[]) ?? [],
    attempts: (attempts.data as QuestionAttempt[]) ?? [],
    scale: (scale.data as GradeScaleEntry[])?.length
      ? (scale.data as GradeScaleEntry[])
      : DEFAULT_GRADE_SCALE.map((e) => ({ ...e })),
  };
}

export function gradesByCourse(ctx: StudentContext): Map<string, Grade[]> {
  const map = new Map<string, Grade[]>();
  for (const g of ctx.grades) {
    const list = map.get(g.course_id) ?? [];
    list.push(g);
    map.set(g.course_id, list);
  }
  return map;
}

function daysFromToday(date: string | null): number | null {
  if (!date) return null;
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(target) - startOfDay(new Date())) / 86_400_000);
}

/**
 * Renders the context as the plain-text record the agents read.
 *
 * It is written as a factual dossier on purpose: the prompts instruct the
 * model to answer only from it, so anything absent here is something the model
 * must decline to state rather than guess at.
 */
export function renderContext(ctx: StudentContext, opts: { focusCourseId?: string } = {}): string {
  const byCourse = gradesByCourse(ctx);
  const lines: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  lines.push(`TODAY: ${today}`);

  if (ctx.profile) {
    lines.push('', 'STUDENT');
    lines.push(`  Name: ${ctx.profile.full_name ?? 'not recorded'}`);
    lines.push(`  University: ${ctx.profile.university ?? 'not recorded'}`);
    lines.push(`  Major: ${ctx.profile.major ?? 'not recorded'}`);
    lines.push(`  Year: ${ctx.profile.academic_year ?? 'not recorded'}`);
    lines.push(`  Target GPA: ${ctx.profile.target_gpa ?? 'not set'}`);
    lines.push(`  Preferred study block: ${ctx.profile.preferred_study_minutes} minutes`);
    if (ctx.profile.study_availability) {
      lines.push(`  Usual study times: ${ctx.profile.study_availability}`);
    }
  }

  const cum = cumulativeGpa(ctx.courses, ctx.scale);
  const sem = semesterGpa(ctx.courses, byCourse, ctx.scale);
  lines.push('', 'GPA');
  lines.push(`  Cumulative (completed courses): ${cum.gpa ?? 'no completed courses recorded'} over ${cum.gradedCredits} credits`);
  lines.push(`  Semester (projected from marked assessments): ${sem.gpa ?? 'no marks recorded yet'}`);

  const active = ctx.courses.filter((c) => c.status === 'active');
  const done = ctx.courses.filter((c) => c.status === 'completed');

  lines.push('', `ACTIVE COURSES (${active.length})`);
  if (active.length === 0) lines.push('  none recorded');
  for (const c of active) {
    if (opts.focusCourseId && c.id !== opts.focusCourseId) continue;
    const cg = computeCourseGrade(byCourse.get(c.id) ?? [], ctx.scale);
    const req = requiredForTarget(byCourse.get(c.id) ?? [], c.target_grade, ctx.scale);
    lines.push(
      `  ${c.course_code} — ${c.course_name} (${c.credits} credits)` +
      `${c.instructor ? `, ${c.instructor}` : ''}`,
    );
    lines.push(
      `    Schedule: ${c.days.length ? c.days.join('/') : 'not recorded'}` +
      `${c.start_time ? ` ${c.start_time.slice(0, 5)}–${(c.end_time ?? '').slice(0, 5)}` : ''}` +
      `${c.room ? `, ${c.room}` : ''}`,
    );
    lines.push(
      `    Standing: ${cg.currentPercent === null ? 'no marks yet' : `${cg.currentPercent}% (${cg.currentLetter}) across ${cg.completedWeight}% of the course`}` +
      `; ${cg.remainingWeight}% still to be assessed` +
      `${cg.unaccountedWeight > 0 ? `; ${cg.unaccountedWeight}% of weight not entered` : ''}`,
    );
    if (c.target_grade) {
      lines.push(
        `    Target ${c.target_grade}: ${
          req.verdict === 'reachable' ? `needs ~${req.requiredAveragePercent}% across what remains`
          : req.verdict === 'impossible' ? 'no longer mathematically reachable'
          : req.verdict === 'already_achieved' ? 'already secured'
          : 'nothing left to assess'
        }`,
      );
    }
    const assessments = byCourse.get(c.id) ?? [];
    for (const a of assessments) {
      const when = a.due_date ? ` due ${a.due_date}` : '';
      lines.push(
        `    - ${a.assessment_name} [${a.assessment_type}] weight ${a.weight}%` +
        `${a.score === null ? ', not completed' : `, scored ${a.score}/${a.max_score}`}${when}`,
      );
    }
  }

  if (done.length) {
    lines.push('', `COMPLETED COURSES (${done.length})`);
    for (const c of done) {
      lines.push(
        `  ${c.course_code} — ${c.course_name}, ${c.credits} credits, ${c.semester ?? 'semester not recorded'}` +
        `, final ${c.final_grade ?? 'not recorded'}` +
        `${c.difficulty ? `, difficulty ${c.difficulty}/5` : ''}`,
      );
    }
  }

  const upcoming = ctx.events
    .filter((e) => e.event_date && (daysFromToday(e.event_date) ?? -1) >= 0)
    .slice(0, 25);
  lines.push('', 'UPCOMING SYLLABUS DATES');
  if (!upcoming.length) lines.push('  none recorded');
  for (const e of upcoming) {
    const course = ctx.courses.find((c) => c.id === e.course_id);
    lines.push(
      `  ${e.event_date} — ${course?.course_code ?? 'unlinked'}: ${e.title} [${e.event_type}]` +
      `${e.weight ? `, worth ${e.weight}%` : ''} (in ${daysFromToday(e.event_date)} days)`,
    );
  }

  const openTasks = ctx.tasks.filter((t) => t.status !== 'completed');
  lines.push('', `OPEN TASKS (${openTasks.length})`);
  if (!openTasks.length) lines.push('  none');
  for (const t of openTasks.slice(0, 30)) {
    const course = ctx.courses.find((c) => c.id === t.course_id);
    const d = daysFromToday(t.due_date);
    lines.push(
      `  ${t.title}${course ? ` (${course.course_code})` : ''} — ${t.priority} priority, ${t.status}` +
      `${t.due_date ? `, due ${t.due_date}${d !== null ? ` (${d < 0 ? `${-d} days overdue` : `in ${d} days`})` : ''}` : ', no due date'}` +
      `${t.estimated_minutes ? `, ~${t.estimated_minutes} min` : ''}`,
    );
  }

  if (ctx.sessions.length) {
    lines.push('', 'RECENT PRACTICE SESSIONS');
    for (const s of ctx.sessions.slice(0, 12)) {
      const course = ctx.courses.find((c) => c.id === s.course_id);
      lines.push(
        `  ${(s.completed_at ?? s.started_at).slice(0, 10)} — ${course?.course_code ?? 'general'}` +
        `${s.topic ? ` / ${s.topic}` : ''}: ${s.correct_answers}/${s.total_questions}` +
        `${s.score !== null ? ` (${s.score}%)` : ''}`,
      );
    }
  }

  if (ctx.syllabi.length) {
    lines.push('', 'SYLLABI ON FILE');
    for (const s of ctx.syllabi) {
      const course = ctx.courses.find((c) => c.id === s.course_id);
      lines.push(
        `  ${course?.course_code ?? 'unlinked'} — ${s.file_name ?? 'uploaded file'} [${s.processing_status}]` +
        `${s.topics.length ? `, topics: ${s.topics.join(', ')}` : ''}` +
        `${s.office_hours ? `, office hours: ${s.office_hours}` : ''}`,
      );
    }
  }

  return lines.join('\n');
}

/**
 * Topics the student has been getting wrong, worst first. Drives the adaptive
 * difficulty and the "what should I revise" answers.
 */
export function weakTopics(ctx: StudentContext, courseId?: string): Array<{ topic: string; correct: number; total: number; rate: number }> {
  const relevant = ctx.sessions.filter((s) => !courseId || s.course_id === courseId);
  const tally = new Map<string, { correct: number; total: number }>();

  for (const s of relevant) {
    if (!s.topic || s.total_questions === 0) continue;
    const entry = tally.get(s.topic) ?? { correct: 0, total: 0 };
    entry.correct += s.correct_answers;
    entry.total += s.total_questions;
    tally.set(s.topic, entry);
  }

  return [...tally.entries()]
    .map(([topic, v]) => ({ topic, ...v, rate: v.total ? v.correct / v.total : 0 }))
    .sort((a, b) => a.rate - b.rate);
}
