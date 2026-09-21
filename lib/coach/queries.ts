import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/data/queries';
import { cumulativeGpa } from '@/lib/calculations/gpa';
import { computeCourseGrade, DEFAULT_GRADE_SCALE } from '@/lib/calculations/grades';
import { computeStreak, type ActivityDay } from '@/lib/momentum/engine';
import type { CoachSignals, CourseSignal } from './signals';
import type { RecommendationInput } from './recommend';

/**
 * Assembles the coach's view of a student from records that already exist.
 *
 * Every figure here is read or derived from a stored row. Nothing is estimated
 * and nothing is carried over from a previous read, which is what lets the
 * interface — and the AI coach — state numbers as fact.
 *
 * Study minutes come from `study_sessions` alone. A focus block writes both a
 * session row and an `activity_days.focus_minutes` increment, so adding the two
 * would count the same time twice.
 */

/** Credits a degree is assumed to need when the student has not said. */
export const DEFAULT_DEGREE_CREDITS = 120;

export interface CoachSnapshot {
  signals: CoachSignals;
  recommendationInput: RecommendationInput;
  studentName: string | null;
  semester: string | null;
  courseCount: number;
  /** Milestones already stored as reached, so one is celebrated only once. */
  storedMilestones: Array<{ code: string; status: string; celebratedAt: string | null }>;
}

export async function getCoachSnapshot(): Promise<CoachSnapshot> {
  const supabase = await createClient();
  const userId = await requireUserId();

  const today = new Date();
  const todayIso = iso(today);
  const day7 = iso(addDays(today, -7));
  const day14 = iso(addDays(today, -14));
  const day28 = iso(addDays(today, -28));

  const [
    { data: profile }, { data: courses }, { data: grades }, { data: tasks },
    { data: sessions }, { data: activity }, { data: scaleRows },
    { data: plans }, { data: milestoneRows },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('courses').select('*').eq('user_id', userId),
    supabase.from('grades').select('*').eq('user_id', userId),
    supabase.from('tasks').select('*').eq('user_id', userId),
    supabase.from('study_sessions')
      .select('id, course_id, topic, mode, duration_minutes, score, total_questions, correct_answers, completed_at')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(200),
    supabase.from('activity_days')
      .select('day, tasks_completed, practice_sessions, questions_answered, focus_minutes, grades_logged, xp')
      .eq('user_id', userId)
      .gte('day', iso(addDays(today, -400)))
      .order('day', { ascending: false }),
    supabase.from('grade_scale_entries')
      .select('letter, min_percent, points').eq('user_id', userId).order('sort_order'),
    supabase.from('study_plans')
      .select('id, course_id, assessment_id, status').eq('user_id', userId),
    supabase.from('milestones')
      .select('code, status, celebrated_at').eq('user_id', userId),
  ]);

  // Flashcards due today, asked separately because the filter differs.
  const { count: flashcardsDue } = await supabase
    .from('flashcards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lte('due_on', todayIso);

  const courseRows = (courses as unknown as CourseRow[]) ?? [];
  const gradeRows = (grades as unknown as GradeRow[]) ?? [];
  const taskRows = (tasks as unknown as TaskRow[]) ?? [];
  const sessionRows = (sessions as unknown as SessionRow[]) ?? [];
  const days = (activity as ActivityDay[]) ?? [];
  const scale = scaleRows?.length
    ? scaleRows as Array<{ letter: string; min_percent: number; points: number }>
    : DEFAULT_GRADE_SCALE.map(({ letter, min_percent, points }) => ({ letter, min_percent, points }));
  const planRows = (plans as Array<{ id: string; course_id: string | null; assessment_id: string | null; status: string }>) ?? [];

  const active = courseRows.filter((c) => c.status === 'active');
  const streak = computeStreak(days, todayIso);

  // --- Sessions -------------------------------------------------------------
  // A practice set is a session that actually asked questions; a focus block
  // is time logged, not a quiz, so it is counted as minutes but never as a quiz.
  const inWindow = (s: SessionRow, from: string) => (s.completed_at ?? '') >= from;
  const isQuiz = (s: SessionRow) => (s.total_questions ?? 0) > 0;

  const quizzes = sessionRows.filter(isQuiz);
  const quizzesLast7 = quizzes.filter((s) => inWindow(s, day7));
  const scored = quizzes.filter((s) => s.score !== null);
  const recentScored = scored.slice(0, 5);
  const previousScored = scored.slice(5, 10);

  const studyMinutes = (from: string) => sessionRows
    .filter((s) => inWindow(s, from))
    .reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);

  const minutesLast7 = studyMinutes(day7);
  const minutesPrev7 = sessionRows
    .filter((s) => (s.completed_at ?? '') >= day14 && (s.completed_at ?? '') < day7)
    .reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);

  // --- Tasks ----------------------------------------------------------------
  const completedTasks = taskRows.filter((t) => t.status === 'completed');
  const openTasks = taskRows.filter((t) => t.status !== 'completed');
  const overdue = openTasks.filter((t) => t.due_date !== null && t.due_date < todayIso);

  const completedSince = (from: string) => completedTasks
    .filter((t) => (t.completed_at ?? '').slice(0, 10) >= from).length;

  // --- Courses --------------------------------------------------------------
  const gradesByCourse = new Map<string, GradeRow[]>();
  for (const g of gradeRows) {
    const list = gradesByCourse.get(g.course_id);
    if (list) list.push(g); else gradesByCourse.set(g.course_id, [g]);
  }

  const courseSignals: CourseSignal[] = active.map((c) => {
    const rows = gradesByCourse.get(c.id) ?? [];
    const breakdown = computeCourseGrade(rows as never, scale);

    // The soonest assessment that is still unmarked.
    const upcoming = rows
      .filter((g) => g.score === null && g.due_date && g.due_date >= todayIso)
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))[0];

    const courseSessions = quizzes.filter((s) => s.course_id === c.id && s.score !== null);
    const courseTasks = taskRows.filter((t) => t.course_id === c.id);

    return {
      id: c.id,
      code: c.course_code,
      name: c.course_name,
      weightGraded: Math.max(0, Math.min(1, breakdown.completedWeight / 100)),
      currentPercent: breakdown.currentPercent,
      quizAverage: courseSessions.length
        ? mean(courseSessions.map((s) => Number(s.score)))
        : null,
      tasksTotal: courseTasks.length,
      tasksCompleted: courseTasks.filter((t) => t.status === 'completed').length,
      daysToNextAssessment: upcoming?.due_date ? daysBetween(todayIso, upcoming.due_date) : null,
      nextAssessmentHasPlan: upcoming
        ? planRows.some((p) => p.assessment_id === upcoming.id || (p.course_id === c.id && p.status === 'active'))
        : false,
    };
  });

  // --- Exams ----------------------------------------------------------------
  const upcomingExams = gradeRows.filter((g) =>
    g.score === null && g.due_date && g.due_date >= todayIso && daysBetween(todayIso, g.due_date) <= 14,
  );
  const examsWithPlan = upcomingExams.filter((g) =>
    planRows.some((p) => p.assessment_id === g.id || (p.course_id === g.course_id && p.status === 'active')),
  ).length;

  // --- GPA and credits ------------------------------------------------------
  const cum = cumulativeGpa(courseRows as never, scale);
  const creditsRequired = Number(profile?.degree_credits ?? 0) > 0
    ? Number(profile?.degree_credits)
    : DEFAULT_DEGREE_CREDITS;

  const signals: CoachSignals = {
    today: todayIso,
    activeDaysLast28: days.filter((d) => d.day >= day28 && d.xp > 0).length,
    studyMinutesLast7: minutesLast7,
    studyMinutesPrev7: minutesPrev7,
    practiceSessionsLast7: quizzesLast7.length,
    practiceSessionsTotal: quizzes.length,
    questionsAnsweredLast7: quizzesLast7.reduce((sum, s) => sum + (s.total_questions ?? 0), 0),
    currentStreak: streak.current,
    longestStreak: streak.longest,
    streakActiveToday: streak.activeToday,
    streakAtRisk: streak.atRisk,
    tasksCompletedLast7: completedSince(day7),
    tasksCompletedPrev7: Math.max(0, completedSince(day14) - completedSince(day7)),
    tasksCompletedTotal: completedTasks.length,
    tasksOpen: openTasks.length,
    tasksOverdue: overdue.length,
    quizzesCompletedLast7: quizzesLast7.length,
    quizzesCompletedTotal: quizzes.length,
    quizAverage: recentScored.length ? mean(recentScored.map((s) => Number(s.score))) : null,
    quizAveragePrevious: previousScored.length ? mean(previousScored.map((s) => Number(s.score))) : null,
    courses: courseSignals,
    examsUpcoming: upcomingExams.length,
    examsWithPlan,
    creditsCompleted: cum.gradedCredits,
    creditsRequired,
    currentGpa: cum.gpa,
    targetGpa: profile?.target_gpa !== null && profile?.target_gpa !== undefined
      ? Number(profile.target_gpa) : null,
    gpaScale: Number(profile?.gpa_scale ?? 4),
  };

  // --- Weak topics ----------------------------------------------------------
  const weakTopics = await getWeakTopics(userId, courseRows);

  const codeOf = (id: string | null) =>
    id ? courseRows.find((c) => c.id === id)?.course_code ?? null : null;

  return {
    signals,
    recommendationInput: {
      signals,
      openTasks: openTasks
        .sort((a, b) => {
          const rank = { high: 0, medium: 1, low: 2 } as const;
          const ao = a.due_date !== null && a.due_date < todayIso;
          const bo = b.due_date !== null && b.due_date < todayIso;
          if (ao !== bo) return ao ? -1 : 1;
          if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
          return (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999');
        })
        .map((t) => ({
          id: t.id,
          title: t.title,
          courseId: t.course_id,
          courseCode: codeOf(t.course_id),
          priority: t.priority,
          dueDate: t.due_date,
          estimatedMinutes: t.estimated_minutes,
          overdue: t.due_date !== null && t.due_date < todayIso,
        })),
      weakTopics,
      flashcardsDue: flashcardsDue ?? 0,
      defaultSessionMinutes: Number(profile?.preferred_study_minutes ?? 45),
    },
    studentName: (profile?.full_name as string | null) ?? null,
    semester: active[0]?.semester ?? null,
    courseCount: active.length,
    storedMilestones: ((milestoneRows as Array<{ code: string; status: string; celebrated_at: string | null }>) ?? [])
      .map((m) => ({ code: m.code, status: m.status, celebratedAt: m.celebrated_at })),
  };
}

/**
 * Topics the student's own answers show they are weakest on.
 *
 * Only topics with at least three answered questions are considered: one wrong
 * answer is not evidence of a weak topic, and telling a student otherwise would
 * be inventing a weakness.
 */
const MIN_ANSWERS_FOR_WEAKNESS = 3;

async function getWeakTopics(
  userId: string,
  courseRows: CourseRow[],
): Promise<RecommendationInput['weakTopics']> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('question_attempts')
    .select('is_correct, questions!inner(topic, course_id)')
    .eq('user_id', userId)
    .order('answered_at', { ascending: false })
    .limit(400);

  type Joined = { is_correct: boolean; questions: { topic: string | null; course_id: string | null } | null };
  const rows = (data as unknown as Joined[]) ?? [];

  const byTopic = new Map<string, { correct: number; total: number; courseId: string | null }>();
  for (const row of rows) {
    const topic = row.questions?.topic;
    if (!topic) continue;
    const entry = byTopic.get(topic) ?? { correct: 0, total: 0, courseId: row.questions?.course_id ?? null };
    entry.total += 1;
    if (row.is_correct) entry.correct += 1;
    byTopic.set(topic, entry);
  }

  return [...byTopic.entries()]
    .filter(([, v]) => v.total >= MIN_ANSWERS_FOR_WEAKNESS)
    .map(([topic, v]) => ({
      topic,
      courseId: v.courseId,
      courseCode: v.courseId ? courseRows.find((c) => c.id === v.courseId)?.course_code ?? null : null,
      percent: (v.correct / v.total) * 100,
    }))
    .sort((a, b) => a.percent - b.percent);
}

// --- row shapes --------------------------------------------------------------

interface CourseRow {
  id: string; course_code: string; course_name: string; status: string;
  semester: string | null; credits: number; final_points: number | null; final_grade: string | null;
}
interface GradeRow {
  id: string; course_id: string; weight: number; score: number | null;
  max_score: number; due_date: string | null; assessment_type: string;
}
interface TaskRow {
  id: string; course_id: string | null; title: string; status: string;
  priority: 'low' | 'medium' | 'high'; due_date: string | null;
  estimated_minutes: number | null; completed_at: string | null;
}
interface SessionRow {
  id: string; course_id: string | null; topic: string | null; mode: string | null;
  duration_minutes: number | null; score: number | null;
  total_questions: number | null; correct_answers: number | null; completed_at: string | null;
}

// --- helpers -----------------------------------------------------------------

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
}
