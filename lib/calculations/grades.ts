import type { Grade, GradeScaleEntry } from '@/types/database';

/** Round to two decimals without accumulating binary float noise. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export const DEFAULT_GRADE_SCALE: Omit<GradeScaleEntry, 'id' | 'user_id' | 'created_at'>[] = [
  { letter: 'A',  min_percent: 93, points: 4.0,  sort_order: 1 },
  { letter: 'A-', min_percent: 90, points: 3.67, sort_order: 2 },
  { letter: 'B+', min_percent: 87, points: 3.33, sort_order: 3 },
  { letter: 'B',  min_percent: 83, points: 3.0,  sort_order: 4 },
  { letter: 'B-', min_percent: 80, points: 2.67, sort_order: 5 },
  { letter: 'C+', min_percent: 77, points: 2.33, sort_order: 6 },
  { letter: 'C',  min_percent: 73, points: 2.0,  sort_order: 7 },
  { letter: 'C-', min_percent: 70, points: 1.67, sort_order: 8 },
  { letter: 'D+', min_percent: 67, points: 1.33, sort_order: 9 },
  { letter: 'D',  min_percent: 60, points: 1.0,  sort_order: 10 },
  { letter: 'F',  min_percent: 0,  points: 0.0,  sort_order: 11 },
];

type ScaleLike = Pick<GradeScaleEntry, 'letter' | 'min_percent' | 'points'>;

/** Highest-threshold-first, so the first match is the right one. */
function sortedScale(scale: ScaleLike[]): ScaleLike[] {
  return [...scale].sort((a, b) => b.min_percent - a.min_percent);
}

export function letterForPercent(percent: number, scale: ScaleLike[]): ScaleLike | null {
  const ordered = sortedScale(scale);
  return ordered.find((e) => percent >= e.min_percent) ?? ordered[ordered.length - 1] ?? null;
}

export function scaleEntryForLetter(letter: string, scale: ScaleLike[]): ScaleLike | null {
  const needle = letter.trim().toUpperCase();
  return scale.find((e) => e.letter.trim().toUpperCase() === needle) ?? null;
}

export interface CourseGradeBreakdown {
  /** Weight of assessments that already have a score. */
  completedWeight: number;
  /** Weight of assessments that exist but are not yet scored. */
  remainingWeight: number;
  /** Sum of every assessment's weight. Should be 100 when the syllabus is complete. */
  totalDefinedWeight: number;
  /** 100 − totalDefinedWeight. Positive means assessments are missing. */
  unaccountedWeight: number;
  /** Weighted points banked so far, out of 100 for the whole course. */
  earnedWeightedPoints: number;
  /** Average across completed work only, as a percentage. */
  currentPercent: number | null;
  /** Letter the completed-work average maps to right now. */
  currentLetter: string | null;
  /** Best still-reachable final percent, assuming full marks on what remains. */
  maxPossiblePercent: number;
  /** Final percent if every remaining assessment scores zero. */
  minPossiblePercent: number;
  hasAnyScore: boolean;
}

export function computeCourseGrade(
  grades: Grade[],
  scale: ScaleLike[] = DEFAULT_GRADE_SCALE,
): CourseGradeBreakdown {
  let completedWeight = 0;
  let remainingWeight = 0;
  let earnedWeightedPoints = 0;

  for (const g of grades) {
    const weight = Number(g.weight) || 0;
    const max = Number(g.max_score) || 0;

    if (g.score === null || g.score === undefined || max <= 0) {
      remainingWeight += weight;
      continue;
    }
    completedWeight += weight;
    earnedWeightedPoints += weight * (Number(g.score) / max);
  }

  const totalDefinedWeight = completedWeight + remainingWeight;
  const currentPercent =
    completedWeight > 0 ? round2((earnedWeightedPoints / completedWeight) * 100) : null;

  return {
    completedWeight: round2(completedWeight),
    remainingWeight: round2(remainingWeight),
    totalDefinedWeight: round2(totalDefinedWeight),
    unaccountedWeight: round2(Math.max(0, 100 - totalDefinedWeight)),
    earnedWeightedPoints: round2(earnedWeightedPoints),
    currentPercent,
    currentLetter:
      currentPercent === null ? null : letterForPercent(currentPercent, scale)?.letter ?? null,
    maxPossiblePercent: round2(earnedWeightedPoints + remainingWeight),
    minPossiblePercent: round2(earnedWeightedPoints),
    hasAnyScore: completedWeight > 0,
  };
}

export type TargetVerdict =
  | 'reachable'
  | 'already_achieved'
  | 'impossible'
  | 'no_remaining_assessments'
  | 'no_target_set';

export interface TargetRequirement {
  verdict: TargetVerdict;
  targetLetter: string | null;
  /** Final course percentage the target letter requires. */
  targetPercent: number | null;
  /** Average needed across every remaining assessment, as a percentage. */
  requiredAveragePercent: number | null;
  breakdown: CourseGradeBreakdown;
  /** Plain-language notes about what the number assumes. */
  assumptions: string[];
}

/**
 * What the student must average over the assessments that are still open.
 *
 *   required = (targetPercent − earnedWeightedPoints) / remainingWeight × 100
 *
 * Everything is expressed against a 100-point course, so a weight of 40 that
 * scores 90% contributes 36 points.
 */
export function requiredForTarget(
  grades: Grade[],
  targetLetter: string | null,
  scale: ScaleLike[] = DEFAULT_GRADE_SCALE,
): TargetRequirement {
  const breakdown = computeCourseGrade(grades, scale);
  const assumptions: string[] = [];

  if (breakdown.unaccountedWeight > 0.01) {
    assumptions.push(
      `Only ${breakdown.totalDefinedWeight}% of the course weight has been entered. ` +
      `The remaining ${breakdown.unaccountedWeight}% is not part of this calculation.`,
    );
  }

  if (!targetLetter) {
    return {
      verdict: 'no_target_set', targetLetter: null, targetPercent: null,
      requiredAveragePercent: null, breakdown, assumptions,
    };
  }

  const entry = scaleEntryForLetter(targetLetter, scale);
  if (!entry) {
    return {
      verdict: 'no_target_set', targetLetter, targetPercent: null,
      requiredAveragePercent: null, breakdown, assumptions,
    };
  }

  const targetPercent = Number(entry.min_percent);
  assumptions.push(
    `"${entry.letter}" is treated as ${targetPercent}% under your current grading scale.`,
  );

  // Nothing left to sit — the grade is whatever has been banked.
  if (breakdown.remainingWeight <= 0.01) {
    const achieved = breakdown.completedWeight > 0
      && (breakdown.currentPercent ?? 0) >= targetPercent;
    return {
      verdict: achieved ? 'already_achieved' : 'no_remaining_assessments',
      targetLetter: entry.letter, targetPercent,
      requiredAveragePercent: null, breakdown, assumptions,
    };
  }

  const pointsStillNeeded = targetPercent - breakdown.earnedWeightedPoints;
  const requiredAveragePercent = round2((pointsStillNeeded / breakdown.remainingWeight) * 100);

  assumptions.push(
    `Assumes the remaining ${breakdown.remainingWeight}% of assessments all score the same average.`,
  );

  if (requiredAveragePercent <= 0) {
    return {
      verdict: 'already_achieved', targetLetter: entry.letter, targetPercent,
      requiredAveragePercent: 0, breakdown, assumptions,
    };
  }
  if (requiredAveragePercent > 100) {
    return {
      verdict: 'impossible', targetLetter: entry.letter, targetPercent,
      requiredAveragePercent, breakdown, assumptions,
    };
  }
  return {
    verdict: 'reachable', targetLetter: entry.letter, targetPercent,
    requiredAveragePercent, breakdown, assumptions,
  };
}

/** The best letter still reachable if every remaining assessment is perfect. */
export function bestReachableLetter(
  grades: Grade[],
  scale: ScaleLike[] = DEFAULT_GRADE_SCALE,
): string | null {
  const b = computeCourseGrade(grades, scale);
  return letterForPercent(b.maxPossiblePercent, scale)?.letter ?? null;
}
