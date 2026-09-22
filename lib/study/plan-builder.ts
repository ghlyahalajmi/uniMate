import type { StudyPlanInput, StudyPlanOutput, PlannedSession } from './plan-types';
import type { Weekday } from '@/lib/groups/availability';

/**
 * A study plan built by arithmetic rather than by a model.
 *
 * Everything this needs is already on the record: which chapters the student
 * uploaded, what is due and when, which weekdays they said they can study, and
 * how long a session runs. A model writes a nicer reason line; it does not
 * know anything about the dates that this does not.
 *
 * The rule, in order:
 *   1. Revision for an assessment lands before the assessment, not after.
 *   2. A course with a nearer deadline is served first.
 *   3. Chapters go in the order they were uploaded, which is teaching order.
 *   4. Only on days the student said they are free.
 *
 * Pure: same input, same plan, and no clock of its own — today arrives as a
 * string so a plan made at 23:59 in Kuwait is not dated yesterday.
 */

const WEEKDAY_ORDER: Weekday[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekdayOf(iso: string): Weekday {
  return WEEKDAY_ORDER[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

/** Every day in the horizon the student is free, today first. */
function studyDays(todayIso: string, horizonDays: number, available: Weekday[]): string[] {
  const days: string[] = [];
  for (let i = 0; i < horizonDays; i += 1) {
    const iso = addDays(todayIso, i);
    if (available.length === 0 || available.includes(weekdayOf(iso))) days.push(iso);
  }
  return days;
}

/** How urgent a course is: days until its nearest dated assessment. */
function urgency(course: StudyPlanInput['courses'][number], todayIso: string): number {
  const dates = course.upcoming
    .map((u) => u.date)
    .filter((d): d is string => typeof d === 'string' && d >= todayIso)
    .sort();
  if (dates.length === 0) return Number.MAX_SAFE_INTEGER;
  return Math.round(
    (new Date(`${dates[0]}T00:00:00Z`).getTime() - new Date(`${todayIso}T00:00:00Z`).getTime())
      / 86_400_000,
  );
}

export function buildStudyPlan(input: StudyPlanInput): StudyPlanOutput {
  const { courses, todayIso, defaultMinutes, availableDays, horizonDays } = input;
  const days = studyDays(todayIso, horizonDays, availableDays);
  const notes: string[] = [];

  if (days.length === 0) {
    return {
      title: 'Study plan',
      goal: 'No study days in range.',
      sessions: [],
      notes: ['No day in this range is marked as available, so there is nowhere to put a session.'],
    };
  }

  // Nearest deadline first; a tie goes to the course with more to cover.
  const ordered = [...courses]
    .map((c) => ({ course: c, urgency: urgency(c, todayIso) }))
    .sort((a, b) => (a.urgency !== b.urgency ? a.urgency - b.urgency : b.course.chapters.length - a.course.chapters.length));

  // One queue of work per course, so the plan alternates rather than spending
  // its first week on a single subject.
  const queues = ordered.map(({ course, urgency: u }) => {
    const deadline = course.upcoming
      .map((x) => x.date)
      .filter((d): d is string => typeof d === 'string' && d >= todayIso)
      .sort()[0] ?? null;

    const items = course.chapters.length > 0
      ? course.chapters.map((ch) => ({ materialId: ch.id, topic: ch.title }))
      : course.upcoming.length > 0
        ? course.upcoming.map((u2) => ({ materialId: null, topic: u2.title }))
        : [{ materialId: null, topic: course.name }];

    return { course, deadline, urgency: u, items, at: 0 };
  });

  const sessions: PlannedSession[] = [];
  const perDay = new Map<string, number>();
  const MAX_PER_DAY = 2;

  for (const day of days) {
    for (const q of queues) {
      if (q.at >= q.items.length) continue;
      if ((perDay.get(day) ?? 0) >= MAX_PER_DAY) break;

      // Revision after the exam it was for helps nobody.
      if (q.deadline && day > q.deadline) {
        q.at = q.items.length;
        continue;
      }

      const item = q.items[q.at];
      const startTime = (perDay.get(day) ?? 0) === 0 ? '17:00' : '19:00';

      sessions.push({
        courseId: q.course.id,
        materialId: item.materialId,
        topic: item.topic,
        scheduledOn: day,
        startTime,
        minutes: defaultMinutes,
        reason: q.deadline
          ? `${q.course.code} has ${q.course.upcoming[0]?.title ?? 'an assessment'} on ${q.deadline}.`
          : `Keeping ${q.course.code} moving while there is room.`,
      });

      perDay.set(day, (perDay.get(day) ?? 0) + 1);
      q.at += 1;
    }
  }

  const unplaced = queues.filter((q) => q.at < q.items.length);
  if (unplaced.length > 0) {
    notes.push(
      `${unplaced.reduce((n, q) => n + (q.items.length - q.at), 0)} chapters did not fit in ${horizonDays} days. Extend the range or add study days.`,
    );
  }
  notes.push('Built from your deadlines and available days, without AI. Every session can be edited or removed.');

  return {
    title: `Study plan — next ${horizonDays} days`,
    goal: ordered.length > 0 && ordered[0].urgency !== Number.MAX_SAFE_INTEGER
      ? `Cover the material before ${ordered[0].course.code}'s next assessment.`
      : 'Work through the uploaded chapters at a steady pace.',
    sessions,
    notes,
  };
}
