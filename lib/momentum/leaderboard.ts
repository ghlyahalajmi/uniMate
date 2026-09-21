import { createClient } from '@/lib/supabase/server';

export interface LeaderboardRow {
  place: number;
  /** Null when the student chose to appear without their name. */
  displayName: string | null;
  streak: number;
  isMe: boolean;
}

/**
 * The streak board.
 *
 * Read through a security-definer function rather than a table, because no
 * table here is readable across students and none should become so. The
 * function returns a name only for students who chose to show one, and a
 * streak — nothing else crosses between accounts.
 */
export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('streak_leaderboard');
  if (error || !Array.isArray(data)) return [];

  return (data as Array<{ place: number; display_name: string | null; streak: number; is_me: boolean }>)
    .map((r) => ({
      place: r.place,
      displayName: r.display_name,
      streak: r.streak,
      isMe: Boolean(r.is_me),
    }));
}
