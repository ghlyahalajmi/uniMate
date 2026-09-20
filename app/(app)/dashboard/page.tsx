import { redirect } from 'next/navigation';
import { getDictionary } from '@/lib/i18n/server';
import {
  getProfile, getCourses, getGrades, getTasks, getSyllabusEvents,
  getGradeScale, groupGradesByCourse, weekdayOf,
} from '@/lib/data/queries';
import { cumulativeGpa, semesterGpa } from '@/lib/calculations/gpa';
import { computeCourseGrade, requiredForTarget } from '@/lib/calculations/grades';
import { getMomentum } from '@/lib/momentum/queries';
import { DashboardView } from '@/components/dashboard/dashboard-view';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const profile = await getProfile();
  if (profile && !profile.onboarding_completed) redirect('/onboarding');

  const [courses, grades, tasks, events, scale, momentum] = await Promise.all([
    getCourses(), getGrades(), getTasks(), getSyllabusEvents(), getGradeScale(), getMomentum(4),
  ]);
  const { t } = await getDictionary();

  const byCourse = groupGradesByCourse(grades);
  const active = courses.filter((c) => c.status === 'active');
  const today = new Date();
  const todayKey = weekdayOf(today);
  const todayIso = toIso(today);

  // Today's classes, in time order.
  const todayClasses = active
    .filter((c) => c.days.includes(todayKey))
    .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
    .map((c) => ({
      id: c.id, code: c.course_code, name: c.course_name,
      start: c.start_time, end: c.end_time, room: c.room,
    }));

  // Due today or already overdue, plus anything in progress.
  const todayTasks = tasks
    .filter((tk) =>
      tk.status !== 'completed' &&
      (tk.status === 'in_progress' || (tk.due_date !== null && tk.due_date <= todayIso)),
    )
    .slice(0, 6)
    .map((tk) => ({
      id: tk.id, title: tk.title, priority: tk.priority, status: tk.status,
      courseCode: courses.find((c) => c.id === tk.course_id)?.course_code ?? null,
      overdue: tk.due_date !== null && tk.due_date < todayIso,
      source: tk.source,
    }));

  const openTaskCount = tasks.filter((tk) => tk.status !== 'completed').length;

  // The next 30 days, from both syllabus events and unscored assessments.
  const upcoming = [
    ...events
      .filter((e) => e.event_date && e.event_date >= todayIso)
      .map((e) => ({
        key: `e-${e.id}`, title: e.title, date: e.event_date as string,
        courseCode: courses.find((c) => c.id === e.course_id)?.course_code ?? null,
        weight: e.weight, kind: e.event_type as string,
      })),
    ...grades
      .filter((g) => g.score === null && g.due_date && g.due_date >= todayIso)
      .map((g) => ({
        key: `g-${g.id}`, title: g.assessment_name, date: g.due_date as string,
        courseCode: courses.find((c) => c.id === g.course_id)?.course_code ?? null,
        weight: g.weight, kind: g.assessment_type as string,
      })),
  ]
    .filter((x) => daysBetween(todayIso, x.date) <= 30)
    .sort((a, b) => a.date.localeCompare(b.date))
    // A syllabus event and an assessment often name the same thing.
    .filter((x, i, arr) => arr.findIndex((y) => y.title === x.title && y.date === x.date) === i)
    .slice(0, 6)
    .map((x) => ({ ...x, days: daysBetween(todayIso, x.date) }));

  /**
   * One thing to do next, chosen by a fixed rule rather than by a model, so
   * the same records always produce the same answer and the reason can be
   * shown beside it: whatever is overdue, else what is due today, else the
   * next class, else the nearest assessment. Null when none of those exist —
   * an invented suggestion would be worse than an honest blank.
   */
  const focusTask =
    todayTasks.find((tk) => tk.overdue) ??
    todayTasks.find((tk) => tk.status !== 'completed') ??
    null;

  const nextClass = todayClasses[0] ?? null;
  const nextExam = upcoming[0] ?? null;
  const defaultBlock = profile?.preferred_study_minutes ?? 30;

  const focus: {
    title: string; courseCode: string | null; minutes: number;
    reason: 'overdue' | 'today' | 'class' | 'exam'; days: number | null;
  } | null =
    focusTask
      ? {
          title: focusTask.title,
          courseCode: focusTask.courseCode,
          minutes: tasks.find((tk) => tk.id === focusTask.id)?.estimated_minutes ?? defaultBlock,
          reason: focusTask.overdue ? 'overdue' : 'today',
          days: null,
        }
      : nextClass
        ? {
            title: nextClass.name,
            courseCode: nextClass.code,
            minutes: minutesBetween(nextClass.start, nextClass.end) ?? defaultBlock,
            reason: 'class',
            days: null,
          }
        : nextExam
          ? {
              title: nextExam.title,
              courseCode: nextExam.courseCode,
              minutes: defaultBlock,
              reason: 'exam',
              days: nextExam.days,
            }
          : null;

  const cum = cumulativeGpa(courses, scale);
  const sem = semesterGpa(courses, byCourse, scale);

  const progress = active.map((c) => {
    const cg = computeCourseGrade(byCourse.get(c.id) ?? [], scale);
    const req = requiredForTarget(byCourse.get(c.id) ?? [], c.target_grade, scale);
    return {
      id: c.id,
      code: c.course_code,
      name: c.course_name,
      current: cg.currentPercent,
      currentLetter: cg.currentLetter,
      target: c.target_grade,
      required: req.requiredAveragePercent,
      verdict: req.verdict as string,
      remainingWeight: cg.remainingWeight,
    };
  });

  return (
    <DashboardView
      name={profile?.full_name ?? null}
      isDemo={Boolean(profile?.is_demo)}
      hasAnyCourse={courses.length > 0}
      todayClasses={todayClasses}
      todayTasks={todayTasks}
      openTaskCount={openTaskCount}
      upcoming={upcoming}
      focus={focus}
      snapshot={{
        cumulativeGpa: cum.gpa,
        targetGpa: profile?.target_gpa ?? null,
        semesterGpa: sem.gpa,
        creditsCompleted: cum.gradedCredits,
        activeCourses: active.length,
      }}
      progress={progress}
      momentum={
        profile?.momentum_enabled === false
          ? null
          : {
              current: momentum.streak.current,
              atRisk: momentum.streak.atRisk,
              activeToday: momentum.streak.activeToday,
              level: momentum.level.level,
              xpToday: momentum.xpToday,
            }
      }
      greetingFallback={t.dashboard.goodAfternoon}
    />
  );
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Length of a timetabled class, when both ends are known. */
function minutesBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const toMinutes = (v: string) => {
    const [h, m] = v.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const span = toMinutes(end) - toMinutes(start);
  return span > 0 ? span : null;
}

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
}
