import type { ActivityDay, StreakInfo } from './engine';

/**
 * The achievement catalogue.
 *
 * Every one is earned from a record that already exists, and each carries the
 * evidence that unlocked it so the interface can say *why* rather than just
 * flashing a badge. Codes are permanent — rename the copy, never the code.
 */
export type AchievementCode =
  | 'first_task' | 'first_practice' | 'first_syllabus'
  | 'streak_3' | 'streak_7' | 'streak_14' | 'streak_30'
  | 'perfect_set' | 'fifty_questions' | 'two_hundred_questions'
  | 'deep_work' | 'focus_marathon'
  | 'full_house' | 'target_hit' | 'comeback'
  | 'early_bird' | 'night_owl' | 'weekend_warrior';

export interface AchievementDef {
  code: AchievementCode;
  /** Roughly how hard, for sorting and colour. */
  tier: 'bronze' | 'silver' | 'gold';
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: 'first_task',           tier: 'bronze', icon: 'check' },
  { code: 'first_practice',       tier: 'bronze', icon: 'study' },
  { code: 'first_syllabus',       tier: 'bronze', icon: 'syllabi' },
  { code: 'streak_3',             tier: 'bronze', icon: 'flame' },
  { code: 'streak_7',             tier: 'silver', icon: 'flame' },
  { code: 'streak_14',            tier: 'silver', icon: 'flame' },
  { code: 'streak_30',            tier: 'gold',   icon: 'flame' },
  { code: 'perfect_set',          tier: 'silver', icon: 'sparkle' },
  { code: 'fifty_questions',      tier: 'silver', icon: 'study' },
  { code: 'two_hundred_questions',tier: 'gold',   icon: 'study' },
  { code: 'deep_work',            tier: 'silver', icon: 'clock' },
  { code: 'focus_marathon',       tier: 'gold',   icon: 'clock' },
  { code: 'full_house',           tier: 'bronze', icon: 'grades' },
  { code: 'target_hit',           tier: 'gold',   icon: 'grades' },
  { code: 'comeback',             tier: 'gold',   icon: 'analytics' },
  { code: 'early_bird',           tier: 'bronze', icon: 'sun' },
  { code: 'night_owl',            tier: 'bronze', icon: 'moon' },
  { code: 'weekend_warrior',      tier: 'silver', icon: 'calendar' },
];

export const ACHIEVEMENT_BY_CODE = new Map(ACHIEVEMENTS.map((a) => [a.code, a]));

/** What the evaluator needs to decide what has been earned. */
export interface AchievementContext {
  days: ActivityDay[];
  streak: StreakInfo;
  totalQuestions: number;
  /** Best single practice session, as a percentage, or null when there are none. */
  bestSessionScore: number | null;
  syllabiCount: number;
  /** Courses whose entered assessment weights total 100. */
  coursesWithFullWeights: number;
  /** Courses where the banked marks already secure the target grade. */
  targetsSecured: number;
  /** A topic that went from below 60% to above 80% across sessions. */
  comebackTopic: string | null;
  /** Local hours at which tasks were completed. */
  taskCompletionHours: number[];
  /** Weekend days (Friday or Saturday in Kuwait) that earned XP. */
  weekendActiveDays: number;
}

export interface EarnedAchievement {
  code: AchievementCode;
  evidence: string;
}

/**
 * Returns everything currently earned. The caller inserts only the codes that
 * are not already stored, so this stays idempotent and an achievement is never
 * revoked if the underlying data later changes.
 */
export function evaluateAchievements(ctx: AchievementContext): EarnedAchievement[] {
  const out: EarnedAchievement[] = [];
  const add = (code: AchievementCode, evidence: string) => out.push({ code, evidence });

  const t = ctx.days.reduce(
    (acc, d) => ({
      tasks: acc.tasks + d.tasks_completed,
      sessions: acc.sessions + d.practice_sessions,
      focus: acc.focus + d.focus_minutes,
      maxFocusDay: Math.max(acc.maxFocusDay, d.focus_minutes),
    }),
    { tasks: 0, sessions: 0, focus: 0, maxFocusDay: 0 },
  );

  if (t.tasks >= 1) add('first_task', `${t.tasks} tasks completed`);
  if (t.sessions >= 1) add('first_practice', `${t.sessions} practice sessions`);
  if (ctx.syllabiCount >= 1) add('first_syllabus', `${ctx.syllabiCount} syllabi uploaded`);

  for (const [n, code] of [[3, 'streak_3'], [7, 'streak_7'], [14, 'streak_14'], [30, 'streak_30']] as const) {
    if (ctx.streak.longest >= n) add(code, `${ctx.streak.longest} day streak`);
  }

  if (ctx.bestSessionScore !== null && ctx.bestSessionScore >= 100) {
    add('perfect_set', 'A practice set answered without a mistake');
  }
  if (ctx.totalQuestions >= 50) add('fifty_questions', `${ctx.totalQuestions} questions answered`);
  if (ctx.totalQuestions >= 200) add('two_hundred_questions', `${ctx.totalQuestions} questions answered`);

  if (t.maxFocusDay >= 120) add('deep_work', `${t.maxFocusDay} focus minutes in one day`);
  if (t.focus >= 1200) add('focus_marathon', `${Math.round(t.focus / 60)} focus hours in total`);

  if (ctx.coursesWithFullWeights >= 1) {
    add('full_house', `${ctx.coursesWithFullWeights} courses with every weight entered`);
  }
  if (ctx.targetsSecured >= 1) add('target_hit', `${ctx.targetsSecured} target grades secured`);
  if (ctx.comebackTopic) add('comeback', `Turned around ${ctx.comebackTopic}`);

  if (ctx.taskCompletionHours.some((h) => h < 9)) add('early_bird', 'A task finished before 09:00');
  if (ctx.taskCompletionHours.some((h) => h >= 23)) add('night_owl', 'A task finished after 23:00');
  if (ctx.weekendActiveDays >= 4) add('weekend_warrior', `${ctx.weekendActiveDays} active weekend days`);

  return out;
}
