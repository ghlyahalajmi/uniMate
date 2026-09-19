/**
 * Streaks, XP and levels.
 *
 * Every rule here is deliberately simple and stated in the interface, because
 * a points system the student cannot predict is a slot machine rather than a
 * habit tool. Nothing is awarded for opening the app — only for work that
 * leaves a record: a task completed, a practice session finished, focus
 * minutes logged, a grade entered.
 */

export interface ActivityDay {
  day: string;               // YYYY-MM-DD
  tasks_completed: number;
  practice_sessions: number;
  questions_answered: number;
  focus_minutes: number;
  grades_logged: number;
  xp: number;
}

// --- XP ----------------------------------------------------------------------

export const XP_RULES = {
  task: 10,
  taskHighPriority: 5,       // on top of the base
  taskOnTime: 5,             // completed on or before its due date
  practiceSession: 15,
  perCorrectAnswer: 2,
  focusPerTenMinutes: 6,
  gradeLogged: 5,
  /** Ceiling per day. Showing up daily beats one heroic session. */
  dailyCap: 150,
} as const;

export interface XpEvent {
  kind: 'task' | 'practice' | 'focus' | 'grade';
  highPriority?: boolean;
  onTime?: boolean;
  correctAnswers?: number;
  /** Total questions in the set; counted separately from the XP-bearing correct ones. */
  questionsAnswered?: number;
  focusMinutes?: number;
}

/** XP an event is worth before the daily cap is applied. */
export function xpForEvent(event: XpEvent): number {
  switch (event.kind) {
    case 'task':
      return XP_RULES.task
        + (event.highPriority ? XP_RULES.taskHighPriority : 0)
        + (event.onTime ? XP_RULES.taskOnTime : 0);
    case 'practice':
      return XP_RULES.practiceSession
        + (event.correctAnswers ?? 0) * XP_RULES.perCorrectAnswer;
    case 'focus':
      return Math.floor((event.focusMinutes ?? 0) / 10) * XP_RULES.focusPerTenMinutes;
    case 'grade':
      return XP_RULES.gradeLogged;
  }
}

/** How much of `award` actually lands, given what the day already holds. */
export function applyDailyCap(alreadyToday: number, award: number): number {
  const room = Math.max(0, XP_RULES.dailyCap - alreadyToday);
  return Math.min(room, Math.max(0, award));
}

// --- Levels ------------------------------------------------------------------

/**
 * Each level costs 100 XP more than the last: 250, 600, 1050, 1600…
 * Steady rather than exponential, so a consistent term keeps progressing
 * instead of stalling at level 4 forever.
 */
export const LEVEL_BASE = 250;
export const LEVEL_STEP = 100;

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return n * LEVEL_BASE + (n * (n - 1) / 2) * LEVEL_STEP;
}

export interface LevelInfo {
  level: number;
  /** Stable key; the display name lives in the dictionary. */
  titleKey: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number;          // 0..1
  totalXp: number;
}

const LEVEL_TITLE_KEYS = [
  'l1','l2','l3','l4','l5','l6','l7','l8','l9','l10',
] as const;

export function levelFromXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;

  const floorXp = xpForLevel(level);
  const nextXp = xpForLevel(level + 1);
  const span = nextXp - floorXp;

  return {
    level,
    titleKey: LEVEL_TITLE_KEYS[Math.min(level, LEVEL_TITLE_KEYS.length) - 1],
    xpIntoLevel: xp - floorXp,
    xpForNextLevel: span,
    progress: span > 0 ? (xp - floorXp) / span : 1,
    totalXp: xp,
  };
}

// --- Streak ------------------------------------------------------------------

export interface StreakInfo {
  current: number;
  longest: number;
  /** True when today has no activity yet but yesterday did — the streak is live but unclaimed. */
  atRisk: boolean;
  /** True when the student has already done something today. */
  activeToday: boolean;
  /** ISO day the current run started, or null when there is no run. */
  startedOn: string | null;
  /** Days, most recent first, that make up the current run. */
  currentDays: string[];
}

function toUtcDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1) / 86_400_000;
}

function fromDayNumber(n: number): string {
  return new Date(n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * A day counts when it earned any XP. The run may end today or yesterday:
 * ending yesterday means the streak is still alive but needs today's work,
 * which is the state the interface nudges on.
 */
export function computeStreak(days: ActivityDay[], todayIso: string): StreakInfo {
  const active = new Set(
    days.filter((d) => d.xp > 0).map((d) => toUtcDay(d.day)),
  );

  const today = toUtcDay(todayIso);
  const activeToday = active.has(today);
  const activeYesterday = active.has(today - 1);

  // Current run ----------------------------------------------------------
  let current = 0;
  const currentDays: string[] = [];
  if (activeToday || activeYesterday) {
    let cursor = activeToday ? today : today - 1;
    while (active.has(cursor)) {
      current += 1;
      currentDays.push(fromDayNumber(cursor));
      cursor -= 1;
    }
  }

  // Longest run ----------------------------------------------------------
  const sorted = [...active].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let previous: number | null = null;
  for (const d of sorted) {
    run = previous !== null && d === previous + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = d;
  }

  return {
    current,
    longest: Math.max(longest, current),
    atRisk: !activeToday && activeYesterday,
    activeToday,
    startedOn: currentDays.length ? currentDays[currentDays.length - 1] : null,
    currentDays,
  };
}

/** Calendar grid for the heatmap: `weeks` columns of 7 days, ending today. */
export function buildHeatmap(
  days: ActivityDay[],
  todayIso: string,
  weeks = 16,
): Array<{ day: string; xp: number; intensity: 0 | 1 | 2 | 3 | 4; future: boolean }> {
  const byDay = new Map(days.map((d) => [d.day, d.xp]));
  const today = toUtcDay(todayIso);

  // Start on the Sunday of the week that is `weeks - 1` weeks back.
  const todayWeekday = new Date(today * 86_400_000).getUTCDay();
  const start = today - todayWeekday - (weeks - 1) * 7;

  return Array.from({ length: weeks * 7 }, (_, i) => {
    const n = start + i;
    const day = fromDayNumber(n);
    const xp = byDay.get(day) ?? 0;
    return {
      day,
      xp,
      intensity: xp === 0 ? 0 : xp < 20 ? 1 : xp < 50 ? 2 : xp < 100 ? 3 : 4,
      future: n > today,
    };
  });
}

export function totalXp(days: ActivityDay[]): number {
  return days.reduce((sum, d) => sum + d.xp, 0);
}

export interface MomentumTotals {
  tasksCompleted: number;
  practiceSessions: number;
  questionsAnswered: number;
  focusMinutes: number;
  activeDays: number;
}

export function totals(days: ActivityDay[]): MomentumTotals {
  return days.reduce<MomentumTotals>(
    (acc, d) => ({
      tasksCompleted: acc.tasksCompleted + d.tasks_completed,
      practiceSessions: acc.practiceSessions + d.practice_sessions,
      questionsAnswered: acc.questionsAnswered + d.questions_answered,
      focusMinutes: acc.focusMinutes + d.focus_minutes,
      activeDays: acc.activeDays + (d.xp > 0 ? 1 : 0),
    }),
    { tasksCompleted: 0, practiceSessions: 0, questionsAnswered: 0, focusMinutes: 0, activeDays: 0 },
  );
}
