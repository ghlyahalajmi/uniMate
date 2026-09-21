import type { SyllabusEventType } from '@/types/database';

/**
 * Turning a read syllabus into the records the rest of UniMate runs on.
 *
 * Until this existed, everything the analyst pulled out of a document stopped
 * at the Syllabus screen. A student could see "Midterm · 25% · 22 Oct" printed
 * on the page while their Grades screen stayed empty, their course grade could
 * not be computed, and the coach reported the weights as missing — because
 * `syllabus_events` and `grades` are different tables and nothing joined them.
 *
 * This module decides what a syllabus *would* change. It performs no I/O, so
 * the preview a student confirms and the write that follows are produced by
 * the same function and cannot disagree.
 */

/** Event types that carry a mark. A lecture or a holiday is not an assessment. */
const GRADEABLE: ReadonlySet<SyllabusEventType> = new Set<SyllabusEventType>([
  'exam', 'midterm', 'final', 'quiz', 'assignment', 'project', 'presentation',
]);

/** How a syllabus event type maps onto an assessment type. */
const ASSESSMENT_TYPE: Record<string, string> = {
  exam: 'midterm', midterm: 'midterm', final: 'final', quiz: 'quiz',
  assignment: 'assignment', project: 'project', presentation: 'presentation',
};

export interface SyllabusEventLike {
  id?: string;
  title: string;
  event_type: SyllabusEventType;
  event_date: string | null;
  weight: number | null;
  description?: string | null;
}

export interface ExistingAssessment {
  id: string;
  assessment_name: string;
  due_date: string | null;
  weight: number;
}

export interface PlannedAssessment {
  /** The event it came from, so the write can trace back to the document. */
  sourceEventId: string | null;
  assessment_name: string;
  assessment_type: string;
  weight: number;
  due_date: string | null;
}

export type SkipReason = 'notGradeable' | 'duplicate' | 'noWeightOrDate';

export interface SkippedEvent {
  title: string;
  reason: SkipReason;
  /** For a duplicate, the assessment already on the course. */
  existingName?: string;
}

export interface CourseFieldUpdate {
  field: 'instructor' | 'course_name';
  from: string | null;
  to: string;
}

export interface ApplyPlan {
  create: PlannedAssessment[];
  skipped: SkippedEvent[];
  courseUpdates: CourseFieldUpdate[];
  /** Weight already on the course plus everything about to be added. */
  totalWeightAfter: number;
  /** True when that total goes past 100 — shown, never silently corrected. */
  weightOverflows: boolean;
  /** Weight the course is still missing once this is applied. */
  unaccountedWeight: number;
}

export interface ApplyInput {
  events: SyllabusEventLike[];
  existing: ExistingAssessment[];
  /** Fields read off the document. */
  extracted: { instructor?: string | null; courseName?: string | null };
  /** What the course row currently holds. */
  course: { instructor: string | null; course_name: string };
}

/**
 * Two assessments are the same thing when they share a normalised name, or
 * when they share a date and an obviously-equivalent name. Students name things
 * inconsistently ("Midterm Exam" vs "Midterm 1"), so the comparison is on the
 * normalised form rather than the raw string.
 */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bexam\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isDuplicate(event: SyllabusEventLike, existing: ExistingAssessment[]): ExistingAssessment | null {
  const key = normaliseName(event.title);
  for (const row of existing) {
    if (normaliseName(row.assessment_name) === key) return row;
    // Same date and same kind of thing, differently worded.
    if (
      event.event_date !== null &&
      row.due_date === event.event_date &&
      sharesLeadingWord(key, normaliseName(row.assessment_name))
    ) {
      return row;
    }
  }
  return null;
}

function sharesLeadingWord(a: string, b: string): boolean {
  const first = (s: string) => s.split(' ').filter(Boolean)[0] ?? '';
  const x = first(a);
  return x.length > 2 && x === first(b);
}

/**
 * Works out exactly what applying this syllabus would do.
 *
 * Nothing is dropped silently: every event either becomes an assessment or
 * appears in `skipped` with the reason, so the confirmation screen can account
 * for all of them.
 */
export function planApply(input: ApplyInput): ApplyPlan {
  const create: PlannedAssessment[] = [];
  const skipped: SkippedEvent[] = [];

  for (const event of input.events) {
    if (!GRADEABLE.has(event.event_type)) {
      skipped.push({ title: event.title, reason: 'notGradeable' });
      continue;
    }

    // With neither a weight nor a date there is nothing to record that the
    // calendar is not already showing.
    if (event.weight === null && event.event_date === null) {
      skipped.push({ title: event.title, reason: 'noWeightOrDate' });
      continue;
    }

    const duplicate = isDuplicate(event, input.existing);
    if (duplicate) {
      skipped.push({ title: event.title, reason: 'duplicate', existingName: duplicate.assessment_name });
      continue;
    }

    create.push({
      sourceEventId: event.id ?? null,
      assessment_name: event.title.slice(0, 200),
      assessment_type: ASSESSMENT_TYPE[event.event_type] ?? 'other',
      // A stated weight is used as given; an assessment with only a date is
      // recorded at zero weight so the date is kept without inventing a mark.
      weight: clampWeight(event.weight),
      due_date: event.event_date,
    });
  }

  const existingWeight = input.existing.reduce((sum, r) => sum + Number(r.weight), 0);
  const addedWeight = create.reduce((sum, r) => sum + r.weight, 0);
  const totalWeightAfter = round1(existingWeight + addedWeight);

  const courseUpdates: CourseFieldUpdate[] = [];
  // Only ever fills a blank. A student's own entry is never overwritten by a
  // document.
  if (input.extracted.instructor && !input.course.instructor?.trim()) {
    courseUpdates.push({
      field: 'instructor',
      from: input.course.instructor,
      to: input.extracted.instructor.slice(0, 200),
    });
  }
  if (
    input.extracted.courseName &&
    looksPlaceholder(input.course.course_name) &&
    normaliseName(input.extracted.courseName) !== normaliseName(input.course.course_name)
  ) {
    courseUpdates.push({
      field: 'course_name',
      from: input.course.course_name,
      to: input.extracted.courseName.slice(0, 200),
    });
  }

  return {
    create,
    skipped,
    courseUpdates,
    totalWeightAfter,
    weightOverflows: totalWeightAfter > 100,
    unaccountedWeight: round1(Math.max(0, 100 - totalWeightAfter)),
  };
}

/** A course named after its own code has not really been named yet. */
function looksPlaceholder(name: string): boolean {
  const n = name.trim();
  return n.length === 0 || /^[a-z]{2,4}\s*\d{2,4}$/i.test(n);
}

function clampWeight(weight: number | null): number {
  if (weight === null || !Number.isFinite(weight)) return 0;
  return Math.max(0, Math.min(100, round1(weight)));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
