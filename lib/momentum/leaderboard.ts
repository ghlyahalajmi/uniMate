import { createClient } from '@/lib/supabase/server';

export interface LeaderboardRow {
  place: number;
  /** Null when the student chose to appear without their name. */
  displayName: string | null;
  streak: number;
  isMe: boolean;
  /** The work behind the streak, for the card that opens on a tap. */
  focusMinutes: number;
  tasksCompleted: number;
  activeDays: number;
}

/**
 * The streak board.
 *
 * Read through a security-definer function rather than a table, because no
 * table here is readable across students and none should become so.
 *
 * What crosses between accounts: a streak, the minutes and tasks behind it,
 * and a name only for students who chose to show one. Only for students who
 * switched the board on for themselves — everyone else has no row here at all.
 * Nothing about anyone's courses, grades, notes or answers is reachable from
 * this function, and the totals come from the same table their own momentum
 * screen counts, so the two can never disagree.
 */
export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('streak_leaderboard');
  if (error || !Array.isArray(data)) return [];

  return (data as Array<{
    place: number; display_name: string | null; streak: number; is_me: boolean;
    focus_minutes: number | null; tasks_completed: number | null; active_days: number | null;
  }>).map((r) => ({
    place: r.place,
    displayName: r.display_name,
    streak: r.streak,
    isMe: Boolean(r.is_me),
    focusMinutes: Number(r.focus_minutes ?? 0),
    tasksCompleted: Number(r.tasks_completed ?? 0),
    activeDays: Number(r.active_days ?? 0),
  }));
}
