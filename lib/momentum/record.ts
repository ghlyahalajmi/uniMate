import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { applyDailyCap, xpForEvent, computeStreak, type ActivityDay, type XpEvent } from './engine';
import { evaluateAchievements, type AchievementContext } from './achievements';

/** Local day for the caller, so a late-night session counts as that night. */
export function localDay(offsetMinutes?: number): string {
  const now = new Date();
  if (typeof offsetMinutes === 'number') {
    now.setMinutes(now.getMinutes() - offsetMinutes);
  }
  return now.toISOString().slice(0, 10);
}

export interface RecordResult {
  xpAwarded: number;
  xpToday: number;
  streakBefore: number;
  streakAfter: number;
  /** True when this is the first activity of the day — worth celebrating in the UI. */
  streakExtended: boolean;
  newAchievements: string[];
}

const COUNTER_FOR: Record<XpEvent['kind'], keyof ActivityDay> = {
  task: 'tasks_completed',
  practice: 'practice_sessions',
  focus: 'focus_minutes',
  grade: 'grades_logged',
};

/**
 * Records one piece of real work against today, awards the XP it is worth
 * (respecting the daily cap) and re-evaluates achievements.
 *
 * Deliberately forgiving: momentum is a side effect of doing the work, so a
 * failure here must never surface as a failure of the task the student
 * actually performed. Every path returns rather than throws.
 */
export async function recordActivity(
  supabase: SupabaseClient,
  userId: string,
  event: XpEvent,
  opts: { timezoneOffsetMinutes?: number } = {},
): Promise<RecordResult | null> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('momentum_enabled')
      .eq('user_id', userId)
      .maybeSingle();

    if (profile && profile.momentum_enabled === false) return null;

    const today = localDay(opts.timezoneOffsetMinutes);

    const { data: history } = await supabase
      .from('activity_days')
      .select('day, tasks_completed, practice_sessions, questions_answered, focus_minutes, grades_logged, xp')
      .eq('user_id', userId)
      .order('day', { ascending: false })
      .limit(400);

    const days = (history as ActivityDay[]) ?? [];
    const streakBefore = computeStreak(days, today).current;

    const existing = days.find((d) => d.day === today);
    const award = applyDailyCap(existing?.xp ?? 0, xpForEvent(event));

    // Counters still increment past the XP cap — the work happened, and the
    // totals and achievements should reflect that even once points stop.
    const counter = COUNTER_FOR[event.kind];
    const increment = event.kind === 'focus' ? Math.max(0, Math.round(event.focusMinutes ?? 0)) : 1;

    const row = {
      user_id: userId,
      day: today,
      tasks_completed:    (existing?.tasks_completed ?? 0)    + (counter === 'tasks_completed' ? increment : 0),
      practice_sessions:  (existing?.practice_sessions ?? 0)  + (counter === 'practice_sessions' ? increment : 0),
      focus_minutes:      (existing?.focus_minutes ?? 0)      + (counter === 'focus_minutes' ? increment : 0),
      grades_logged:      (existing?.grades_logged ?? 0)      + (counter === 'grades_logged' ? increment : 0),
      questions_answered: (existing?.questions_answered ?? 0) + (event.correctAnswers !== undefined ? (event.questionsAnswered ?? 0) : 0),
      xp: (existing?.xp ?? 0) + award,
    };

    const { error } = await supabase
      .from('activity_days')
      .upsert(row, { onConflict: 'user_id,day' });

    if (error) return null;

    const updated: ActivityDay[] = [
      { ...row, day: today } as ActivityDay,
      ...days.filter((d) => d.day !== today),
    ];
    const streakAfter = computeStreak(updated, today).current;

    const newAchievements = await syncAchievements(supabase, userId, updated, today);

    return {
      xpAwarded: award,
      xpToday: row.xp,
      streakBefore,
      streakAfter,
      streakExtended: streakAfter > streakBefore,
      newAchievements,
    };
  } catch {
    return null;
  }
}

/**
 * Inserts any newly earned achievements. Existing ones are left untouched, so
 * a badge is never taken back if the underlying numbers later move.
 */
export async function syncAchievements(
  supabase: SupabaseClient,
  userId: string,
  days: ActivityDay[],
  today: string,
): Promise<string[]> {
  try {
    const ctx = await buildAchievementContext(supabase, userId, days, today);
    const earned = evaluateAchievements(ctx);
    if (!earned.length) return [];

    const { data: held } = await supabase
      .from('achievements').select('code').eq('user_id', userId);
    const have = new Set((held ?? []).map((r: { code: string }) => r.code));

    const fresh = earned.filter((a) => !have.has(a.code));
    if (!fresh.length) return [];

    await supabase.from('achievements').insert(
      fresh.map((a) => ({ user_id: userId, code: a.code, evidence: a.evidence })),
    );
    return fresh.map((a) => a.code);
  } catch {
    return [];
  }
}

export async function buildAchievementContext(
  supabase: SupabaseClient,
  userId: string,
  days: ActivityDay[],
  today: string,
): Promise<AchievementContext> {
  const [sessions, attempts, syllabi, tasks] = await Promise.all([
    supabase.from('study_sessions').select('topic, score, total_questions, correct_answers, completed_at')
      .eq('user_id', userId).not('completed_at', 'is', null),
    supabase.from('question_attempts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('syllabi').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('tasks').select('completed_at').eq('user_id', userId).not('completed_at', 'is', null),
  ]);

  type S = { topic: string | null; score: number | null; total_questions: number; correct_answers: number; completed_at: string };
  const rows = (sessions.data as S[]) ?? [];

  const bestSessionScore = rows.length
    ? Math.max(...rows.map((r) => Number(r.score ?? 0)))
    : null;

  // A comeback is a topic whose earliest session was poor and latest was strong.
  const byTopic = new Map<string, S[]>();
  for (const r of rows) {
    if (!r.topic) continue;
    byTopic.set(r.topic, [...(byTopic.get(r.topic) ?? []), r]);
  }
  let comebackTopic: string | null = null;
  for (const [topic, list] of byTopic) {
    if (list.length < 2) continue;
    const ordered = [...list].sort((a, b) => a.completed_at.localeCompare(b.completed_at));
    const first = Number(ordered[0].score ?? 0);
    const last = Number(ordered[ordered.length - 1].score ?? 0);
    if (first < 60 && last > 80) { comebackTopic = topic; break; }
  }

  const taskHours = ((tasks.data as { completed_at: string }[]) ?? [])
    .map((t) => new Date(t.completed_at).getHours());

  // Kuwait's weekend is Friday and Saturday.
  const weekendActiveDays = days.filter((d) => {
    if (d.xp <= 0) return false;
    const wd = new Date(`${d.day}T00:00:00Z`).getUTCDay();
    return wd === 5 || wd === 6;
  }).length;

  const { coursesWithFullWeights, targetsSecured } = await courseMilestones(supabase, userId);

  return {
    days,
    streak: computeStreak(days, today),
    totalQuestions: attempts.count ?? 0,
    bestSessionScore,
    syllabiCount: syllabi.count ?? 0,
    coursesWithFullWeights,
    targetsSecured,
    comebackTopic,
    taskCompletionHours: taskHours,
    weekendActiveDays,
  };
}

/** Courses with a complete weight breakdown, and targets already secured. */
async function courseMilestones(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ coursesWithFullWeights: number; targetsSecured: number }> {
  const [{ data: courses }, { data: grades }, { data: scale }] = await Promise.all([
    supabase.from('courses').select('id, target_grade, status').eq('user_id', userId),
    supabase.from('grades').select('course_id, weight, score, max_score').eq('user_id', userId),
    supabase.from('grade_scale_entries').select('letter, min_percent, points').eq('user_id', userId),
  ]);

  type C = { id: string; target_grade: string | null; status: string };
  type G = { course_id: string; weight: number; score: number | null; max_score: number };

  const byCourse = new Map<string, G[]>();
  for (const g of ((grades as G[]) ?? [])) {
    byCourse.set(g.course_id, [...(byCourse.get(g.course_id) ?? []), g]);
  }

  let coursesWithFullWeights = 0;
  let targetsSecured = 0;

  for (const c of ((courses as C[]) ?? [])) {
    const rows = byCourse.get(c.id) ?? [];
    if (!rows.length) continue;

    const total = rows.reduce((s, g) => s + Number(g.weight), 0);
    if (Math.abs(total - 100) < 0.01) coursesWithFullWeights += 1;

    if (!c.target_grade) continue;
    const entry = ((scale as { letter: string; min_percent: number }[]) ?? [])
      .find((e) => e.letter.toUpperCase() === c.target_grade!.toUpperCase());
    if (!entry) continue;

    // Banked points alone already clear the target threshold.
    const banked = rows.reduce(
      (s, g) => s + (g.score === null ? 0 : Number(g.weight) * (Number(g.score) / Number(g.max_score))),
      0,
    );
    if (banked >= Number(entry.min_percent)) targetsSecured += 1;
  }

  return { coursesWithFullWeights, targetsSecured };
}
