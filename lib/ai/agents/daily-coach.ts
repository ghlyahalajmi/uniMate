import 'server-only';
import type { AgentDefinition } from '../run';
import { callStructured } from '../client';
import { systemFor } from '../prompts';
import { academicLevel, stepsToNextLevel } from '@/lib/coach/academic-level';
import { academicMomentum } from '@/lib/coach/momentum-score';
import { allCourseHealth, weeklyProgress, quizImprovement, gpaStanding } from '@/lib/coach/progress';
import { evaluateMilestones } from '@/lib/coach/milestones';
import { recommendNextAction } from '@/lib/coach/recommend';
import { dailyMessage, isSupportive, type Tone } from '@/lib/coach/messages';
import type { CoachSignals } from '@/lib/coach/signals';
import type { RecommendationInput } from '@/lib/coach/recommend';

export interface DailyCoachInput {
  signals: CoachSignals;
  recommendationInput: RecommendationInput;
  studentName: string | null;
}

export interface DailyCoachOutput {
  /** One or two sentences of encouragement. */
  message: string;
  tone: Tone;
  /** What to do next, in the student's own words where possible. */
  recommendedAction: string;
  /** The record that led to the recommendation. */
  reason: string;
  /** The goal currently being worked toward. */
  nextMilestone: string;
  /** True when a model wrote the prose; false when the deterministic rules did. */
  fromAi: boolean;
  /** The message key the rules chose, so the interface can translate it. */
  fallbackKey: string;
  fallbackValues: Record<string, string | number>;
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['message', 'tone', 'recommendedAction', 'reason', 'nextMilestone'],
  properties: {
    message: {
      type: 'string',
      description:
        'One or two sentences of specific, warm encouragement built from the figures given. ' +
        'Name a real number from the data. Never shame, never compare to other students.',
    },
    tone: { type: 'string', enum: ['positive', 'steady', 'encouraging'] },
    recommendedAction: {
      type: 'string',
      description: 'One concrete action the student can start now, under an hour.',
    },
    reason: {
      type: 'string',
      description: 'The specific record that action follows from — a score, a date, a course.',
    },
    nextMilestone: { type: 'string', description: 'The goal being worked toward, stated plainly.' },
  },
} as const;

/**
 * Agent 11 — Daily Coach.
 *   Input:   the assembled coach signals, which are all derived from records.
 *   Output:  encouragement, a status, one recommended action and the next milestone.
 *   Trigger: the student opens the dashboard or the journey screen.
 *   Failure: falls back to the deterministic message rules, which are complete
 *            on their own — the screen never depends on the model.
 *
 * Two safeguards, in code rather than in the prompt, because a prompt is a
 * request and this needs to be a guarantee:
 *
 *   1. The *recommended action* is chosen by `recommendNextAction` before the
 *      model is called, and the model is told what it is. The model may reword
 *      it; it cannot pick a different one. So the advice a student acts on is
 *      always the one the rules justified.
 *   2. Generated prose is run through `isSupportive` and discarded wholesale if
 *      it contains anything shaming. A model that ignores the tone rule cannot
 *      reach the student.
 */
export const dailyCoach: AgentDefinition<DailyCoachInput, DailyCoachOutput> = {
  name: 'Daily Coach',
  trigger: 'dashboard_opened',
  workflow: 'workflow_f_daily_coaching',
  describe: 'Turns the student\'s own records into encouragement and one next step.',

  async run(input) {
    const deterministic = buildFallback(input);
    const facts = coachFacts(input);

    const result = await callStructured<{
      message: string; tone: Tone; recommendedAction: string;
      reason: string; nextMilestone: string;
    }>({
      system: systemFor(
        'You are the student\'s academic coach. You are given figures that have already been ' +
        'computed from their records — treat every one as correct and never recompute or ' +
        'contradict them. Write warm, specific encouragement that names a real number from the ' +
        'data.\n\n' +
        'Tone rules, which override everything else:\n' +
        '- Never shame, scold, or call the student lazy, failing or behind.\n' +
        '- Never compare them to other students.\n' +
        '- Never promise a grade or an outcome.\n' +
        '- If they have done little, acknowledge it kindly and ask for one small thing.\n' +
        '- Celebrate improvement, not only high marks.\n\n' +
        'THE RECOMMENDED ACTION IS ALREADY DECIDED and given to you below. Reword it naturally ' +
        'for the student, but do not substitute a different action.',
      ),
      prompt: [
        'STUDENT FIGURES (computed from their records, all correct):',
        JSON.stringify(facts, null, 2),
        '',
        `THE ACTION TO RECOMMEND: ${deterministic.recommendedAction}`,
        `THE REASON IT WAS CHOSEN: ${deterministic.reason}`,
        `THE MILESTONE BEING WORKED TOWARD: ${deterministic.nextMilestone}`,
        '',
        'Write the coaching.',
      ].join('\n'),
      schema: SCHEMA,
      schemaName: 'daily_coaching',
      effort: 'low',
    });

    // A model that ignores the tone rule does not reach the student.
    const safe =
      isSupportive(result.message) &&
      isSupportive(result.recommendedAction) &&
      isSupportive(result.reason);

    if (!safe) return deterministic;

    return {
      message: result.message,
      tone: result.tone,
      recommendedAction: result.recommendedAction,
      reason: result.reason,
      nextMilestone: result.nextMilestone,
      fromAi: true,
      fallbackKey: deterministic.fallbackKey,
      fallbackValues: deterministic.fallbackValues,
    };
  },

  // The rules alone are a complete answer, so the screen works with no API key.
  fallback(input) {
    return buildFallback(input);
  },

  summariseInput: ({ signals }) =>
    `${signals.tasksCompletedLast7} tasks and ${signals.studyMinutesLast7} minutes in the last 7 days`,
  summariseOutput: (o) => `${o.tone}: ${o.recommendedAction}`,
};

/**
 * The deterministic answer. This is the fallback *and* the source of the
 * action the model is allowed to reword, so both paths recommend the same thing.
 */
function buildFallback(input: DailyCoachInput): DailyCoachOutput {
  const { signals } = input;
  const message = dailyMessage(signals);
  const recommendation = recommendNextAction(input.recommendationInput);
  const milestone = evaluateMilestones(signals).next;

  return {
    // Empty prose: the interface renders the translated dictionary string for
    // `fallbackKey` instead, so the student reads reviewed copy in their own
    // language rather than an English sentence built in code.
    message: '',
    tone: message.tone,
    recommendedAction: describeAction(recommendation),
    reason: describeReason(recommendation),
    nextMilestone: milestone?.code ?? '',
    fromAi: false,
    fallbackKey: message.key,
    fallbackValues: message.values,
  };
}

/** A plain-English handle for the model and the activity log. Not shown raw. */
function describeAction(r: ReturnType<typeof recommendNextAction>): string {
  const where = r.courseCode ? ` for ${r.courseCode}` : '';
  switch (r.kind) {
    case 'prepare_exam':        return `Start exam preparation${where} — ${r.minutes} minutes`;
    case 'practice_weak_topic': return `Practise ${r.subject}${where} for ${r.minutes} minutes`;
    case 'finish_overdue_task': return `Finish "${r.subject}"${where}`;
    case 'next_task':           return r.subject ? `Work on "${r.subject}"${where}` : 'Start your next task';
    case 'practice_session':    return `Run a practice set${where} — ${r.minutes} minutes`;
    case 'review_flashcards':   return `Review ${r.detail.count ?? 0} flashcards`;
    case 'keep_streak':         return `Do one small thing today to keep your streak`;
    case 'add_first_course':    return 'Add your first course';
    case 'log_grades':          return `Enter the remaining assessment weights${where}`;
  }
}

function describeReason(r: ReturnType<typeof recommendNextAction>): string {
  switch (r.reason) {
    case 'examInDays':          return `An assessment is ${r.detail.days} days away with no plan behind it`;
    case 'quizBelowTarget':     return `Recent answers on ${r.subject} were ${r.detail.percent}% correct`;
    case 'taskOverdue':         return 'This task is past its due date';
    case 'taskDueSoon':         return 'This is the next thing due';
    case 'noPracticeThisWeek':  return 'No practice recorded in the last seven days';
    case 'streakAtRisk':        return `Your ${r.detail.count}-day streak has nothing logged today yet`;
    case 'gettingStarted':      return 'No courses recorded yet';
    case 'weightsIncomplete':   return 'Some assessment weights are still missing';
    case 'steadyProgress':      return 'Steady progress — this keeps it going';
  }
}

/** Exactly what the model is allowed to know. All of it comes from records. */
function coachFacts(input: DailyCoachInput) {
  const { signals } = input;
  const level = academicLevel(signals);
  const week = weeklyProgress(signals);
  const gpa = gpaStanding(signals);

  return {
    studentName: input.studentName,
    academicLevel: { level: level.level, code: level.code, points: level.points },
    stepsToNextLevel: stepsToNextLevel(signals, level),
    academicMomentum: academicMomentum(signals).total,
    thisWeek: {
      studyMinutes: week.studyMinutes,
      studyMinutesChangeVsLastWeek: week.studyMinutesDelta,
      tasksCompleted: week.tasksCompleted,
      quizzes: signals.quizzesCompletedLast7,
      questionsAnswered: signals.questionsAnsweredLast7,
    },
    streak: { current: signals.currentStreak, longest: signals.longestStreak, atRisk: signals.streakAtRisk },
    quizAverage: signals.quizAverage,
    quizImprovement: quizImprovement(signals),
    gpa: { current: gpa.current, target: gpa.target, reachedTarget: gpa.reached },
    coursesNeedingAttention: allCourseHealth(signals)
      .filter((c) => c.status !== 'on_track')
      .map((c) => ({ course: c.code, status: c.status, reason: c.reason, ...c.detail })),
    upcomingExams: signals.examsUpcoming,
    openTasks: signals.tasksOpen,
  };
}
