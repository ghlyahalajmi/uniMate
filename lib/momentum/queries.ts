import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/data/queries';
import {
  buildHeatmap, computeStreak, levelFromXp, totalXp, totals,
  type ActivityDay,
} from './engine';
import type { AchievementCode } from './achievements';

export interface MomentumSnapshot {
  streak: ReturnType<typeof computeStreak>;
  level: ReturnType<typeof levelFromXp>;
  totals: ReturnType<typeof totals>;
  heatmap: ReturnType<typeof buildHeatmap>;
  xpToday: number;
  achievements: Array<{ code: AchievementCode; evidence: string | null; unlockedAt: string }>;
  days: ActivityDay[];
}

export async function getMomentum(weeks = 16): Promise<MomentumSnapshot> {
  const supabase = await createClient();
  const userId = await requireUserId();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: activity }, { data: badges }] = await Promise.all([
    supabase
      .from('activity_days')
      .select('day, tasks_completed, practice_sessions, questions_answered, focus_minutes, grades_logged, xp')
      .eq('user_id', userId)
      .order('day', { ascending: false })
      .limit(400),
    supabase
      .from('achievements')
      .select('code, evidence, unlocked_at')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false }),
  ]);

  const days = (activity as ActivityDay[]) ?? [];

  return {
    streak: computeStreak(days, today),
    level: levelFromXp(totalXp(days)),
    totals: totals(days),
    heatmap: buildHeatmap(days, today, weeks),
    xpToday: days.find((d) => d.day === today)?.xp ?? 0,
    achievements: ((badges as Array<{ code: string; evidence: string | null; unlocked_at: string }>) ?? [])
      .map((b) => ({ code: b.code as AchievementCode, evidence: b.evidence, unlockedAt: b.unlocked_at })),
    days,
  };
}

/** The figures behind the shareable semester recap. */
export interface WrappedData {
  studentName: string | null;
  semester: string | null;
  totalXp: number;
  level: number;
  longestStreak: number;
  activeDays: number;
  focusHours: number;
  tasksCompleted: number;
  questionsAnswered: number;
  /** Course with the highest current weighted standing. */
  topCourse: { code: string; percent: number } | null;
  /** Subject prefix with the best average across completed courses. */
  strongestSubject: string | null;
  achievementCount: number;
}

export async function getWrapped(): Promise<WrappedData> {
  const supabase = await createClient();
  const userId = await requireUserId();

  const snapshot = await getMomentum(16);

  const [{ data: profile }, { data: courses }, { data: grades }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('user_id', userId).maybeSingle(),
    supabase.from('courses').select('id, course_code, semester, status, final_points, credits').eq('user_id', userId),
    supabase.from('grades').select('course_id, weight, score, max_score').eq('user_id', userId),
  ]);

  type C = { id: string; course_code: string; semester: string | null; status: string; final_points: number | null; credits: number };
  type G = { course_id: string; weight: number; score: number | null; max_score: number };

  const courseRows = (courses as C[]) ?? [];
  const gradeRows = (grades as G[]) ?? [];

  // Highest current standing among active courses.
  let topCourse: WrappedData['topCourse'] = null;
  for (const c of courseRows.filter((x) => x.status === 'active')) {
    const rows = gradeRows.filter((g) => g.course_id === c.id && g.score !== null);
    if (!rows.length) continue;
    const weight = rows.reduce((s, g) => s + Number(g.weight), 0);
    if (weight <= 0) continue;
    const earned = rows.reduce((s, g) => s + Number(g.weight) * (Number(g.score) / Number(g.max_score)), 0);
    const percent = Math.round((earned / weight) * 1000) / 10;
    if (!topCourse || percent > topCourse.percent) topCourse = { code: c.course_code, percent };
  }

  // Best-performing subject prefix across completed courses.
  const byPrefix = new Map<string, { points: number; credits: number }>();
  for (const c of courseRows) {
    if (c.status !== 'completed' || c.final_points === null) continue;
    const prefix = c.course_code.replace(/\d+.*$/, '') || c.course_code;
    const e = byPrefix.get(prefix) ?? { points: 0, credits: 0 };
    e.points += Number(c.final_points) * Number(c.credits);
    e.credits += Number(c.credits);
    byPrefix.set(prefix, e);
  }
  const strongestSubject = [...byPrefix.entries()]
    .filter(([, v]) => v.credits > 0)
    .sort((a, b) => b[1].points / b[1].credits - a[1].points / a[1].credits)[0]?.[0] ?? null;

  const activeSemester = courseRows.find((c) => c.status === 'active')?.semester ?? null;

  return {
    studentName: profile?.full_name ?? null,
    semester: activeSemester,
    totalXp: snapshot.level.totalXp,
    level: snapshot.level.level,
    longestStreak: snapshot.streak.longest,
    activeDays: snapshot.totals.activeDays,
    focusHours: Math.round((snapshot.totals.focusMinutes / 60) * 10) / 10,
    tasksCompleted: snapshot.totals.tasksCompleted,
    questionsAnswered: snapshot.totals.questionsAnswered,
    topCourse,
    strongestSubject,
    achievementCount: snapshot.achievements.length,
  };
}
