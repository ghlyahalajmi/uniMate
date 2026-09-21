import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/data/queries';
import { evaluateMilestones, MILESTONE_BY_CODE, type MilestoneCode } from './milestones';
import type { CoachSignals } from './signals';
import type { Tone } from './messages';

/**
 * The write side of the coach: keeping the milestone table in step with what
 * the student has actually done, and recording what they were told.
 *
 * The rule throughout is that the *table* never decides anything. The rules in
 * `milestones.ts` decide, reading records; this file only persists the result
 * so a celebration fires exactly once and the coach can be audited later.
 */

export interface MilestoneState {
  code: MilestoneCode;
  current: number;
  target: number;
  progress: number;
  complete: boolean;
  /** Reached but not yet celebrated — the interface shows the animation once. */
  needsCelebration: boolean;
}

export interface SyncedMilestones {
  next: MilestoneState | null;
  /** Newly completed this visit, in catalogue order. */
  newlyCompleted: MilestoneState[];
  all: MilestoneState[];
}

/**
 * Recomputes every milestone from the signals and writes back what changed.
 *
 * A milestone already marked completed stays completed even if the underlying
 * figure later falls — a streak that breaks does not un-earn the 7-day
 * milestone the student reached last week.
 */
export async function syncMilestones(signals: CoachSignals): Promise<SyncedMilestones> {
  const supabase = await createClient();
  const userId = await requireUserId();

  const evaluated = evaluateMilestones(signals);

  const { data: stored } = await supabase
    .from('milestones')
    .select('code, status, current_progress, completed_at, celebrated_at')
    .eq('user_id', userId);

  type Stored = {
    code: string; status: string; current_progress: number;
    completed_at: string | null; celebrated_at: string | null;
  };
  const byCode = new Map((stored as Stored[] ?? []).map((m) => [m.code, m]));

  const now = new Date().toISOString();
  const newlyCompleted: MilestoneState[] = [];
  const all: MilestoneState[] = [];
  const writes: Array<Record<string, unknown>> = [];

  for (const item of evaluated.all) {
    const row = byCode.get(item.code);
    const alreadyComplete = row?.status === 'completed';
    // Once earned, always earned.
    const complete = item.complete || alreadyComplete;

    const state: MilestoneState = {
      code: item.code,
      current: alreadyComplete ? item.target : item.current,
      target: item.target,
      progress: complete ? 1 : item.progress,
      complete,
      needsCelebration: complete && !row?.celebrated_at,
    };
    all.push(state);

    if (complete && !alreadyComplete) newlyCompleted.push(state);

    // Only write when something actually changed, so opening the screen twice
    // is not two round-trips of identical updates.
    const changed =
      !row ||
      row.status !== (complete ? 'completed' : 'active') ||
      row.current_progress !== state.current;

    if (changed) {
      writes.push({
        user_id: userId,
        code: item.code,
        target: item.target,
        current_progress: state.current,
        status: complete ? 'completed' : 'active',
        completed_at: complete ? (row?.completed_at ?? now) : null,
        celebrated_at: row?.celebrated_at ?? null,
      });
    }
  }

  if (writes.length) {
    await supabase.from('milestones').upsert(writes, { onConflict: 'user_id,code' });
  }

  const next = all.find((m) => !m.complete) ?? null;
  return { next, newlyCompleted, all };
}

/** Marks a celebration as shown, so it happens exactly once. */
export async function markCelebrated(code: string): Promise<void> {
  const supabase = await createClient();
  const userId = await requireUserId();
  await supabase
    .from('milestones')
    .update({ celebrated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('code', code)
    .is('celebrated_at', null);
}

/**
 * Records a line the coach showed, with the figures behind it.
 *
 * Storing the evidence alongside the claim is what makes "never invent
 * progress" checkable after the fact rather than a promise.
 */
export async function logMotivation(entry: {
  message: string;
  trigger: string;
  tone: Tone;
  context: Record<string, unknown>;
  fromAi: boolean;
}): Promise<void> {
  const supabase = await createClient();
  const userId = await requireUserId();

  // Nothing to record when the rules chose a dictionary key rather than prose;
  // the key and its values are the message, and they are in the context.
  const message = entry.message.trim() || String(entry.context.key ?? entry.trigger);

  await supabase.from('motivation_logs').insert({
    user_id: userId,
    message: message.slice(0, 2000),
    trigger: entry.trigger,
    tone: entry.tone,
    context: entry.context,
    from_ai: entry.fromAi,
  });
}

/** Milestone titles are dictionary keys; this is only for the activity log. */
export function milestoneLabel(code: string): string {
  return MILESTONE_BY_CODE.get(code as MilestoneCode)
    ? code.replace(/_/g, ' ')
    : code;
}
