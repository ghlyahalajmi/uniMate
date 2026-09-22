import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isAiConfigured } from './client';

/**
 * Every agent is defined by the same contract, so its input, output, trigger
 * and failure behaviour are all explicit and inspectable.
 */
export interface AgentDefinition<TInput, TOutput> {
  /** Shown in the AI activity log. */
  name: string;
  /** What causes this agent to fire. */
  trigger: string;
  /** Workflow this agent belongs to, if any. */
  workflow?: string;
  /** One line for the docs and the activity log. */
  describe: string;
  /** The AI path. May throw; a throw becomes a logged failure plus fallback. */
  run(input: TInput, ctx: AgentRunContext): Promise<TOutput>;
  /**
   * How long a model answer from this agent stays good enough to reuse.
   *
   * Set on the agents that fire by themselves — the two that run on every
   * dashboard open — because a free provider allows a few dozen calls a day
   * and spending them on a page the student opens twenty times means the one
   * they actually asked for fails. Inside the window the deterministic path is
   * used instead, which for both of them is the full answer anyway.
   */
  throttleHours?: number;
  /**
   * Deterministic path used when no API key is configured or the AI call
   * fails. Returning null means "this agent genuinely cannot answer without
   * AI" and the run is recorded as failed.
   */
  fallback(input: TInput, ctx: AgentRunContext): TOutput | null | Promise<TOutput | null>;
  summariseInput(input: TInput): string;
  summariseOutput(output: TOutput): string;
}

export interface AgentRunContext {
  supabase: SupabaseClient;
  userId: string;
}

export type AgentOutcome<TOutput> =
  | { ok: true; data: TOutput; source: 'ai' | 'fallback'; runId: string | null }
  | { ok: false; error: string; runId: string | null };

/**
 * Whether this agent already got a model answer inside the window.
 *
 * Read from the log that is written anyway: a completed run with no error
 * recorded against it was a model answer. Never throws — a failure to read the
 * log means the call goes ahead, which is the safe direction.
 */
async function ranRecently<TInput, TOutput>(
  agent: AgentDefinition<TInput, TOutput>,
  ctx: AgentRunContext,
  hours: number,
  exceptRunId: string | null,
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    let query = ctx.supabase
      .from('ai_runs')
      .select('id')
      .eq('user_id', ctx.userId)
      .eq('agent_name', agent.name)
      .eq('status', 'completed')
      .is('error_message', null)
      .gte('started_at', since)
      .limit(1);

    // The row this very run just wrote is not evidence of an earlier answer.
    if (exceptRunId) query = query.neq('id', exceptRunId);

    const { data } = await query;
    return (data ?? []).length > 0;
  } catch {
    return false;
  }
}

/**
 * Runs an agent and records it. A row is written to ai_runs before the work
 * starts and updated when it finishes, so an operation that crashes mid-flight
 * still leaves a trace rather than vanishing.
 */
export async function runAgent<TInput, TOutput>(
  agent: AgentDefinition<TInput, TOutput>,
  input: TInput,
  ctx: AgentRunContext,
  triggerOverride?: string,
): Promise<AgentOutcome<TOutput>> {
  const startedAt = Date.now();
  let runId: string | null = null;

  // Log first: an operation that never reaches its handler is still visible.
  try {
    const { data } = await ctx.supabase
      .from('ai_runs')
      .insert({
        user_id: ctx.userId,
        agent_name: agent.name,
        trigger_type: triggerOverride ?? agent.trigger,
        workflow: agent.workflow ?? null,
        status: 'running',
        input_summary: safeSummary(() => agent.summariseInput(input)),
      })
      .select('id')
      .single();
    runId = data?.id ?? null;
  } catch {
    // Logging must never block the work itself.
  }

  const finish = async (
    status: 'completed' | 'failed',
    fields: { output_summary?: string | null; error_message?: string | null },
  ) => {
    if (!runId) return;
    try {
      await ctx.supabase
        .from('ai_runs')
        .update({
          status,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
          ...fields,
        })
        .eq('id', runId);
    } catch {
      // Same again — a failed log write is not a failed operation.
    }
  };

  // No API key: go straight to the deterministic path, still logged.
  if (!(await isAiConfigured())) {
    const fb = await Promise.resolve(agent.fallback(input, ctx));
    if (fb === null) {
      await finish('failed', {
        error_message: 'No AI provider is available — the deployment has no key and the student has not added one in Settings — and this agent has no offline equivalent.',
      });
      return { ok: false, error: 'AI_NOT_CONFIGURED', runId };
    }
    await finish('completed', {
      output_summary: `${safeSummary(() => agent.summariseOutput(fb))} (computed without AI)`,
    });
    return { ok: true, data: fb, source: 'fallback', runId };
  }

  /*
   * Recently asked and answered: take the deterministic path rather than spend
   * another call. Only agents that fire on their own set a window, and both of
   * them have a fallback that is the whole answer.
   */
  if (agent.throttleHours && (await ranRecently(agent, ctx, agent.throttleHours, runId))) {
    const fb = await Promise.resolve(agent.fallback(input, ctx));
    if (fb !== null) {
      await finish('completed', {
        output_summary: `${safeSummary(() => agent.summariseOutput(fb))} (computed without AI — a model answer for this screen is still fresh)`,
      });
      return { ok: true, data: fb, source: 'fallback', runId };
    }
  }

  try {
    const data = await agent.run(input, ctx);
    await finish('completed', { output_summary: safeSummary(() => agent.summariseOutput(data)) });
    return { ok: true, data, source: 'ai', runId };
  } catch (error) {
    const message = describeError(error);

    // The AI path failed. Try the deterministic one before giving up.
    try {
      const fb = await Promise.resolve(agent.fallback(input, ctx));
      if (fb !== null) {
        await finish('completed', {
          output_summary: `${safeSummary(() => agent.summariseOutput(fb))} (AI unavailable, computed locally)`,
          error_message: message,
        });
        return { ok: true, data: fb, source: 'fallback', runId };
      }
    } catch {
      // Fall through to the failure below.
    }

    await finish('failed', { error_message: message });
    return { ok: false, error: message, runId };
  }
}

function safeSummary(fn: () => string): string {
  try {
    return fn().slice(0, 500);
  } catch {
    return '—';
  }
}

/** Technical detail for the log; the UI shows its own human-readable copy. */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    switch (error.message) {
      case 'AI_NOT_CONFIGURED': return 'No ANTHROPIC_API_KEY is configured.';
      case 'AI_REFUSED':        return 'The model declined this request.';
      case 'AI_EMPTY_RESPONSE': return 'The model returned an empty response.';
      case 'AI_INVALID_JSON':   return 'The model returned a response that did not match the expected shape.';
      default:                  return error.message.slice(0, 480);
    }
  }
  return 'Unknown error';
}
