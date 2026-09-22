import 'server-only';
import type { AgentRunContext } from './run';

/**
 * A ceiling on how often one student can set a model running.
 *
 * Every other limit in this app protects data. This one protects the bill and
 * the provider quota: a model call costs money or spends a free-tier
 * allowance, and the button that starts one can be pressed as fast as a finger
 * moves. Twenty in ten minutes is well past anything real studying looks like
 * and well short of anything that empties an account.
 *
 * Counted from `ai_runs`, the log that is written anyway — a row goes in
 * before each run starts, so the count is of attempts rather than successes
 * and a loop that fails every time is still stopped.
 *
 * Per student, through their own session, so one person hammering a button
 * cannot lock anyone else out.
 */

export const WINDOW_MINUTES = 10;
export const MAX_RUNS_PER_WINDOW = 20;

export interface RateVerdict {
  /** True when this request should be refused. */
  exceeded: boolean;
  /** Whole minutes until the oldest run in the window falls out of it. */
  retryInMinutes: number;
}

/**
 * Never throws and never blocks on doubt: a log that cannot be read leaves the
 * request allowed, because refusing real work over a failed count is worse
 * than allowing one call too many.
 */
export async function checkRunRate(ctx: AgentRunContext): Promise<RateVerdict> {
  const allowed: RateVerdict = { exceeded: false, retryInMinutes: 0 };

  try {
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const { data, error } = await ctx.supabase
      .from('ai_runs')
      .select('started_at')
      .eq('user_id', ctx.userId)
      .gte('started_at', since)
      .order('started_at', { ascending: true });

    if (error || !Array.isArray(data)) return allowed;
    if (data.length < MAX_RUNS_PER_WINDOW) return allowed;

    const oldest = new Date(data[0].started_at as string).getTime();
    const freeAt = oldest + WINDOW_MINUTES * 60_000;
    const minutes = Math.max(1, Math.ceil((freeAt - Date.now()) / 60_000));
    return { exceeded: true, retryInMinutes: minutes };
  } catch {
    return allowed;
  }
}
