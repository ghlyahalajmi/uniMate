import { redirect } from 'next/navigation';
import {
  getProfile, getCourses, getGrades, getTasks, getSyllabusEvents,
  getGradeScale, groupGradesByCourse, weekdayOf,
} from '@/lib/data/queries';
import { cumulativeGpa, semesterGpa } from '@/lib/calculations/gpa';
import { computeCourseGrade, requiredForTarget } from '@/lib/calculations/grades';
import { getMomentum } from '@/lib/momentum/queries';
import { getNotes } from '@/lib/data/queries';
import { WEEKDAYS } from '@/lib/groups/availability';
import { getJourneyData } from '@/lib/coach/view';
import { DashboardView } from '@/components/dashboard/dashboard-view';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const profile = await getProfile();
  if (profile && !profile.onboarding_completed) redirect('/onboarding');

  const [courses, grades, tasks, events, scale, momentum, journey, notes] = await Promise.all([
    getCourses(), getGrades(), getTasks(), getSyllabusEvents(), getGradeScale(), getMomentum(4),
    // The coaching loop starts on the screen students land on, not only on
    // /journey. A failure here must never take the dashboard down with it.
    getJourneyData().catch(() => null),
    getNotes(),
  ]);

  const byCourse = groupGradesByCourse(grades);

  const active = courses.filter((c) => c.status === 'active');
  const today = new Date();
  const todayKey = weekdayOf(today);
  const todayIso = toIso(today);

  /**
   * The last seven days as the streak board draws them, read straight from
   * activity_days: a day is lit when it earned XP, which is the same rule the
   * momentum engine counts a streak by.
   *
   * Built from the server's date and corrected in the browser is not worth it
   * here — a day either has a row or it does not, and the row is keyed by the
   * date the activity was recorded under.
   */
  const earned = new Set(momentum.days.filter((d) => d.xp > 0).map((d) => d.day));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    const iso = toIso(d);
    return {
      day: WEEKDAYS[d.getDay()],
      active: earned.has(iso),
      isToday: iso === todayIso,
      isFuture: iso > todayIso,
    };
  });

  /** The next round run worth aiming at: 3, 7, 14, 30, 60, 100 days. */
  const nextTarget = [3, 7, 14, 30, 60, 100].find((n) => n > momentum.streak.current) ?? null;

  // Only the notes the student pinned. Nothing here decides for them.
  const homeNotes = notes
    .filter((n) => n.show_on_home)
    .slice(0, 4)
    .map((n) => ({
      id: n.id,
      title: n.title,
      preview: n.items.filter((i) => !i.is_done).slice(0, 3).map((i) => i.content).filter(Boolean),
      done: n.items.filter((i) => i.is_done).length,
      total: n.items.length,
      theme: typeof n.theme === 'string' ? n.theme : 'plain',
      tint: typeof n.color === 'string' ? n.color : 'default',
    }));

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
      homeNotes={homeNotes}
      streak={
        profile?.momentum_enabled === false
          ? null
          : {
              current: momentum.streak.current,
              longest: momentum.streak.longest,
              atRisk: momentum.streak.atRisk,
              activeToday: momentum.streak.activeToday,
              level: momentum.level.level,
              week,
              tasksCompleted: momentum.totals.tasksCompleted,
              studyMinutes: momentum.totals.focusMinutes,
              activeDays: momentum.totals.activeDays,
              milestone: nextTarget === null
                ? null
                : { target: nextTarget, toGo: nextTarget - momentum.streak.current },
            }
      }
      coach={
        journey && profile?.momentum_enabled !== false
          ? {
              levelNumber: journey.level.level,
              levelProgress: journey.level.progress,
              momentum: journey.momentum.total,
              recommendationLabel: journey.recommendationLabel,
              recommendationReason: journey.recommendationReason,
              recommendationMinutes: journey.recommendationMinutes,
              recommendationHref: hrefForAction(journey.recommendationKind),
              milestoneCode: journey.nextMilestone?.code ?? null,
              milestoneCurrent: journey.nextMilestone?.current ?? 0,
              milestoneTarget: journey.nextMilestone?.target ?? 1,
              coachKey: journey.coachKey,
              coachValues: journey.coachValues,
            }
          : null
      }

    />
  );
}

/** Where the recommended action sends the student. Mirrors the Journey screen. */
function hrefForAction(kind: string): string {
  switch (kind) {
    case 'add_first_course': return '/courses';
    case 'log_grades':       return '/grades';
    case 'prepare_exam':     return '/planner';
    case 'practice_weak_topic':
    case 'practice_session':
    case 'review_flashcards': return '/study';
    default:                 return '/tasks';
  }
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
