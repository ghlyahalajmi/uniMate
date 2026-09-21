import 'server-only';
import { academicLevel, stepsToNextLevel, type NextLevelStep } from './academic-level';
import { academicMomentum, type MomentumScore } from './momentum-score';
import {
  graduationProgress, gpaStanding, allCourseHealth, weeklyProgress,
  type GraduationProgress, type GpaStanding, type CourseHealth, type WeeklyProgress,
} from './progress';
import { recommendNextAction, todaysMission, type MissionTask, type Recommendation } from './recommend';
import { dailyMessage } from './messages';
import { getCoachSnapshot, DEFAULT_DEGREE_CREDITS } from './queries';
import { syncMilestones, type MilestoneState } from './service';
import type { AcademicLevelInfo } from './academic-level';

/**
 * Everything the Journey screen renders, computed on the server.
 *
 * The screen formats this and nothing else, so there is exactly one place
 * where a figure is derived and one place where it is displayed.
 */
export interface JourneyData {
  level: AcademicLevelInfo;
  nextLevelSteps: NextLevelStep[];

  graduation: GraduationProgress;
  degreeCreditsSet: boolean;
  gpa: GpaStanding;
  momentum: MomentumScore;
  week: WeeklyProgress;
  longestStreak: number;
  streakAtRisk: boolean;
  isFirstWeek: boolean;
  questionsThisWeek: number;
  quizzesThisWeek: number;
  sessionsThisWeek: number;
  courseHealth: CourseHealth[];

  mission: MissionTask[];
  missionAllDone: boolean;
  recommendationLabel: string;
  recommendationReason: string;
  recommendationMinutes: number;
  recommendationKind: Recommendation['kind'];
  recommendationCourseId: string | null;

  nextMilestone: MilestoneState | null;
  milestones: MilestoneState[];
  /** The one milestone whose celebration has not been shown yet. */
  celebrate: MilestoneState | null;

  /** Dictionary key and values for the deterministic coach line. */
  coachKey: string;
  coachValues: Record<string, string | number>;
  coachFallbackText: string;
}

export async function getJourneyData(): Promise<JourneyData> {
  const snapshot = await getCoachSnapshot();
  const s = snapshot.signals;

  const level = academicLevel(s);
  const recommendation = recommendNextAction(snapshot.recommendationInput);
  const milestones = await syncMilestones(s);
  const message = dailyMessage(s);

  const mission = todaysMission(
    snapshot.recommendationInput.openTasks,
    s.today,
    snapshot.recommendationInput.defaultSessionMinutes,
  );

  return {
    level,
    nextLevelSteps: stepsToNextLevel(s, level),

    graduation: graduationProgress(s),
    degreeCreditsSet: s.creditsRequired !== DEFAULT_DEGREE_CREDITS,
    gpa: gpaStanding(s),
    momentum: academicMomentum(s),
    week: weeklyProgress(s),
    longestStreak: s.longestStreak,
    streakAtRisk: s.streakAtRisk,
    // No previous week to compare against yet.
    isFirstWeek: s.studyMinutesPrev7 === 0 && s.tasksCompletedPrev7 === 0,
    questionsThisWeek: s.questionsAnsweredLast7,
    quizzesThisWeek: s.quizzesCompletedLast7,
    sessionsThisWeek: s.practiceSessionsLast7,
    courseHealth: allCourseHealth(s),

    mission,
    // Nothing on the list because everything was finished, rather than because
    // nothing was ever scheduled. The two deserve different words.
    missionAllDone: mission.length === 0 && s.tasksCompletedLast7 > 0,
    recommendationLabel: recommendationLabelKey(recommendation),
    recommendationReason: recommendationReasonKey(recommendation),
    recommendationMinutes: recommendation.minutes,
    recommendationKind: recommendation.kind,
    recommendationCourseId: recommendation.courseId,

    nextMilestone: milestones.next,
    milestones: milestones.all,
    celebrate: milestones.all.find((m) => m.needsCelebration) ?? null,

    coachKey: message.key,
    coachValues: message.values,
    coachFallbackText: '',
  };
}

/**
 * The recommendation is rendered as a sentence on the server rather than as a
 * key, because it interpolates values that come from the student's own records
 * (a task title, a topic) and those are not translatable strings.
 */
function recommendationLabelKey(r: Recommendation): string {
  switch (r.kind) {
    case 'prepare_exam':        return `Start exam preparation${r.courseCode ? ` — ${r.courseCode}` : ''}`;
    case 'practice_weak_topic': return `Review ${r.subject}${r.courseCode ? ` — ${r.courseCode}` : ''}`;
    case 'finish_overdue_task': return r.subject ?? 'Finish your overdue task';
    case 'next_task':           return r.subject ?? 'Start your next task';
    case 'practice_session':    return `Run a practice set${r.courseCode ? ` — ${r.courseCode}` : ''}`;
    case 'review_flashcards':   return `Review ${r.detail.count ?? 0} flashcards`;
    case 'keep_streak':         return 'Do one small thing today';
    case 'add_first_course':    return 'Add your first course';
    case 'log_grades':          return `Enter the remaining weights${r.courseCode ? ` — ${r.courseCode}` : ''}`;
  }
}

function recommendationReasonKey(r: Recommendation): string {
  switch (r.reason) {
    case 'examInDays':         return `Your assessment is ${r.detail.days} days away.`;
    case 'quizBelowTarget':    return `Your recent answers on ${r.subject} were ${r.detail.percent}% correct.`;
    case 'taskOverdue':        return 'This one is past its due date.';
    case 'taskDueSoon':        return 'This is the next thing due.';
    case 'noPracticeThisWeek': return 'No practice recorded in the last seven days.';
    case 'streakAtRisk':       return `Your ${r.detail.count}-day streak has nothing logged today yet.`;
    case 'gettingStarted':     return 'Add a course and UniMate can start working for you.';
    case 'weightsIncomplete':  return 'Some assessment weights are still missing.';
    case 'steadyProgress':     return 'Steady progress — this keeps it going.';
  }
}
