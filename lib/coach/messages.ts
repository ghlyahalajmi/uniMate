import type { CoachSignals } from './signals';
import { quizImprovement, weeklyProgress } from './progress';

/**
 * The motivation layer.
 *
 * This module picks a *key*, never a sentence. The words live in the
 * dictionary, in both languages, which is what makes the tone rules
 * enforceable: there is no code path that can produce a sentence nobody
 * reviewed, and no model output reaches the student through here.
 *
 * The rules, restated as code rather than as a promise:
 *
 *   - `tone` has three values and none of them is negative. There is no
 *     "failing" or "behind" state to select, so the interface cannot render
 *     one.
 *   - Falling behind maps to `encouraging`, which is the tone that pairs a
 *     smaller ask with an acknowledgement. It never maps to blame.
 *   - Nothing here compares the student to anyone else. There is no input for
 *     another student's data, so such a message could not be built.
 *   - Every message key that reports a number takes that number from the
 *     signals, so a claim cannot be made that the records do not support.
 */

export type Tone = 'positive' | 'steady' | 'encouraging';

export type MomentKey =
  // Daily coaching
  | 'weekStrong' | 'weekSteady' | 'weekQuiet' | 'firstWeek'
  | 'streakAlive' | 'streakAtRisk' | 'streakBroken' | 'streakMilestone'
  | 'examApproaching' | 'examPrepComplete'
  | 'quizImproved' | 'gpaOnTrack' | 'gpaClimbing'
  // Event-driven
  | 'taskStarted' | 'taskCompleted' | 'tasksMultiple' | 'missionComplete'
  | 'answerWrong' | 'milestoneReached' | 'levelUp'
  | 'hardDay' | 'gettingStarted';

export interface CoachMessage {
  key: MomentKey;
  tone: Tone;
  /** Values the dictionary string interpolates. Only ever read from records. */
  values: Record<string, string | number>;
}

/**
 * The daily line: what the coach leads with when the student opens the app.
 *
 * Ordered by what is most worth saying today, not by severity. A milestone or
 * a real improvement outranks a routine status line, because the student
 * already knows their routine.
 */
export function dailyMessage(s: CoachSignals): CoachMessage {
  const week = weeklyProgress(s);

  // Nothing recorded yet.
  if (s.tasksCompletedTotal === 0 && s.practiceSessionsTotal === 0) {
    return { key: 'gettingStarted', tone: 'encouraging', values: {} };
  }

  // A measurable improvement is the single best thing to lead with.
  const improved = quizImprovement(s);
  if (improved) {
    return { key: 'quizImproved', tone: 'positive', values: { from: improved.from, to: improved.to } };
  }

  // An exam close enough to plan around.
  const soonest = s.courses
    .filter((c) => c.daysToNextAssessment !== null)
    .sort((a, b) => (a.daysToNextAssessment ?? 99) - (b.daysToNextAssessment ?? 99))[0];
  if (soonest && (soonest.daysToNextAssessment ?? 99) <= 7) {
    if (soonest.nextAssessmentHasPlan && s.examsWithPlan >= s.examsUpcoming && s.examsUpcoming > 0) {
      return { key: 'examPrepComplete', tone: 'positive', values: { course: soonest.code } };
    }
    return {
      key: 'examApproaching',
      tone: 'steady',
      values: { course: soonest.code, days: soonest.daysToNextAssessment ?? 0 },
    };
  }

  // Streak states. A broken streak is explicitly not a failure message.
  if (s.currentStreak === 0 && s.longestStreak >= 3) {
    return { key: 'streakBroken', tone: 'encouraging', values: { longest: s.longestStreak } };
  }
  if (s.streakAtRisk && s.currentStreak >= 2) {
    return { key: 'streakAtRisk', tone: 'encouraging', values: { days: s.currentStreak } };
  }
  if (s.currentStreak >= 7) {
    return { key: 'streakMilestone', tone: 'positive', values: { days: s.currentStreak } };
  }

  // The week in general.
  if (week.studyMinutes === 0 && week.tasksCompleted === 0) {
    // Quiet week. The smaller ask, never the reprimand.
    return { key: 'weekQuiet', tone: 'encouraging', values: {} };
  }
  if (week.improved) {
    return {
      key: 'weekStrong',
      tone: 'positive',
      values: { tasks: week.tasksCompleted, minutes: week.studyMinutes },
    };
  }
  return {
    key: 'weekSteady',
    tone: 'steady',
    values: { tasks: week.tasksCompleted, minutes: week.studyMinutes },
  };
}

/** The line shown the moment a task is ticked off. */
export function taskCompletedMessage(completedToday: number): CoachMessage {
  if (completedToday >= 3) {
    return { key: 'tasksMultiple', tone: 'positive', values: { n: completedToday } };
  }
  return { key: 'taskCompleted', tone: 'positive', values: {} };
}

export function missionCompleteMessage(count: number): CoachMessage {
  return { key: 'missionComplete', tone: 'positive', values: { n: count } };
}

export function milestoneMessage(code: string): CoachMessage {
  return { key: 'milestoneReached', tone: 'positive', values: { code } };
}

export function levelUpMessage(level: number): CoachMessage {
  return { key: 'levelUp', tone: 'positive', values: { level } };
}

/** After a wrong answer. Framed as information, which is what it is. */
export function wrongAnswerMessage(): CoachMessage {
  return { key: 'answerWrong', tone: 'encouraging', values: {} };
}

export function taskStartedMessage(minutes: number): CoachMessage {
  return { key: 'taskStarted', tone: 'steady', values: { minutes } };
}

/**
 * Words the coach must never say to a student, in either language.
 *
 * This exists so the rule is testable rather than aspirational, and it is
 * applied to AI output as a gate: a generated line containing any of these is
 * dropped in favour of the deterministic message above.
 */
export const FORBIDDEN_PHRASES = [
  // English
  'lazy', 'failing', 'failure', 'you failed', 'not enough', "didn't do enough",
  'did not do enough', 'behind everyone', 'worse than', 'others are ahead',
  'disappointing', 'pathetic', 'hopeless', 'give up', 'too late',
  'you should be ashamed', 'stupid', 'bad student', 'poor effort',
  // Arabic
  'كسول', 'فاشل', 'الفشل', 'لم تبذل', 'متأخر عن الجميع', 'أسوأ من',
  'مخيب', 'ميؤوس', 'استسلم', 'فات الأوان', 'طالب سيئ',
];

/** True when a generated line is safe to show. */
export function isSupportive(text: string): boolean {
  const lower = text.toLowerCase();
  return !FORBIDDEN_PHRASES.some((p) => lower.includes(p.toLowerCase()));
}
