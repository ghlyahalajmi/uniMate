import type { Course, Grade, GradeScaleEntry } from '@/types/database';
import { DEFAULT_GRADE_SCALE, computeCourseGrade, letterForPercent, round2, scaleEntryForLetter } from './grades';

type ScaleLike = Pick<GradeScaleEntry, 'letter' | 'min_percent' | 'points'>;

export interface GpaRow {
  courseId: string;
  courseCode: string;
  courseName: string;
  credits: number;
  letter: string | null;
  points: number | null;
  qualityPoints: number | null;
  /** True when the letter came from live assessment scores rather than a recorded final. */
  projected: boolean;
}

export interface GpaResult {
  rows: GpaRow[];
  /** Credits that actually carry a grade and so count toward the GPA. */
  gradedCredits: number;
  totalCredits: number;
  qualityPoints: number;
  gpa: number | null;
}

function computeGpa(rows: GpaRow[], totalCredits: number): GpaResult {
  let gradedCredits = 0;
  let qualityPoints = 0;

  for (const r of rows) {
    if (r.points === null) continue;
    gradedCredits += r.credits;
    qualityPoints += r.credits * r.points;
  }

  return {
    rows,
    gradedCredits: round2(gradedCredits),
    totalCredits: round2(totalCredits),
    qualityPoints: round2(qualityPoints),
    gpa: gradedCredits > 0 ? round2(qualityPoints / gradedCredits) : null,
  };
}

/** GPA over completed courses, using the final letter recorded on each. */
export function cumulativeGpa(
  courses: Course[],
  scale: ScaleLike[] = DEFAULT_GRADE_SCALE,
): GpaResult {
  const completed = courses.filter((c) => c.status === 'completed');
  let totalCredits = 0;

  const rows: GpaRow[] = completed.map((c) => {
    const credits = Number(c.credits) || 0;
    totalCredits += credits;

    const entry = c.final_grade ? scaleEntryForLetter(c.final_grade, scale) : null;
    const points = c.final_points !== null && c.final_points !== undefined
      ? Number(c.final_points)
      : entry
        ? Number(entry.points)
        : null;

    return {
      courseId: c.id,
      courseCode: c.course_code,
      courseName: c.course_name,
      credits,
      letter: c.final_grade ?? entry?.letter ?? null,
      points,
      qualityPoints: points === null ? null : round2(credits * points),
      projected: false,
    };
  });

  return computeGpa(rows, totalCredits);
}

/**
 * Projected GPA for the courses in progress, derived from the assessments
 * scored so far. It is an estimate of where the semester is heading, not a
 * recorded result — label it that way wherever it appears.
 */
export function semesterGpa(
  courses: Course[],
  gradesByCourse: Map<string, Grade[]>,
  scale: ScaleLike[] = DEFAULT_GRADE_SCALE,
): GpaResult {
  const active = courses.filter((c) => c.status === 'active');
  let totalCredits = 0;

  const rows: GpaRow[] = active.map((c) => {
    const credits = Number(c.credits) || 0;
    totalCredits += credits;

    const breakdown = computeCourseGrade(gradesByCourse.get(c.id) ?? [], scale);
    const entry = breakdown.currentPercent === null
      ? null
      : letterForPercent(breakdown.currentPercent, scale);

    const points = entry ? Number(entry.points) : null;

    return {
      courseId: c.id,
      courseCode: c.course_code,
      courseName: c.course_name,
      credits,
      letter: entry?.letter ?? null,
      points,
      qualityPoints: points === null ? null : round2(credits * points),
      projected: true,
    };
  });

  return computeGpa(rows, totalCredits);
}

/** Free-form rows for the standalone GPA calculator screen. */
export interface ManualGpaRow {
  id: string;
  courseName: string;
  credits: number;
  letter: string;
}

export function manualGpa(
  rows: ManualGpaRow[],
  scale: ScaleLike[] = DEFAULT_GRADE_SCALE,
): GpaResult {
  let totalCredits = 0;

  const mapped: GpaRow[] = rows.map((r) => {
    const credits = Number(r.credits) || 0;
    totalCredits += credits;
    const entry = scaleEntryForLetter(r.letter, scale);
    const points = entry ? Number(entry.points) : null;

    return {
      courseId: r.id,
      courseCode: r.courseName,
      courseName: r.courseName,
      credits,
      letter: entry?.letter ?? null,
      points,
      qualityPoints: points === null ? null : round2(credits * points),
      projected: false,
    };
  });

  return computeGpa(mapped, totalCredits);
}

/**
 * The average grade points the remaining credits must earn to land on a target
 * cumulative GPA. Returns null when there is nothing left to take.
 */
export function pointsNeededForTargetGpa(
  current: GpaResult,
  remainingCredits: number,
  targetGpa: number,
): number | null {
  if (remainingCredits <= 0) return null;
  const needed =
    (targetGpa * (current.gradedCredits + remainingCredits) - current.qualityPoints) /
    remainingCredits;
  return round2(needed);
}
