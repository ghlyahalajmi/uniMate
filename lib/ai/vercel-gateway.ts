import 'server-only';
import type { StructuredCallOptions } from './client';
import { compatStructured, compatText, type CompatConfig } from './openai-compatible';
import { rankGatewayModels } from './gateway-models';

/**
 * Vercel's AI Gateway — the one route that asks the deployment for nothing.
 *
 * Every other provider needs an account somewhere and a key pasted into the
 * environment. This one does not: a deployment running on Vercel with OIDC
 * federation enabled is handed a short-lived `VERCEL_OIDC_TOKEN` at runtime,
 * and the gateway accepts it as proof of who is calling. Usage is billed to
 * the Vercel account that already owns the project.
 *
 * So it sits last in the order and turns the AI features on by itself when no
 * key has been configured, which is the difference between a student seeing
 * "AI features are not configured" and simply seeing them work.
 *
 * `AI_GATEWAY_API_KEY` is honoured first for a deployment that would rather
 * use a long-lived key, or that runs somewhere Vercel does not issue tokens.
 */

const ENDPOINT = 'https://ai-gateway.vercel.sh/v1/chat/completions';
const CATALOGUE = 'https://ai-gateway.vercel.sh/v1/models';

/** Used when the catalogue cannot be read at all. */
const LAST_RESORT = 'anthropic/claude-sonnet-4.5';

/** What Settings shows. */
export const GATEWAY_MODEL = process.env.AI_GATEWAY_MODEL ?? 'vercel ai gateway (auto)';

const CACHE_MS = 60 * 60 * 1000;
let cache: { at: number; ids: string[] } | null = null;

/** Exposed for tests and for a deployment that wants to force a re-read. */
export function forgetGatewayModels(): void {
  cache = null;
}

/**
 * The credential this deployment can use, if any.
 *
 * `VERCEL_OIDC_TOKEN` is injected into Vercel deployments and rotates, so it is
 * read per call rather than captured once — a token cached at module load is a
 * token that expires while the process is still warm.
 */
export function gatewayToken(): string | null {
  return process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || null;
}

/** True when a gateway credential exists at all. Says nothing about whether it works. */
export function isGatewayAvailable(): boolean {
  return gatewayToken() !== null;
}

/**
 * Whether the gateway will actually answer.
 *
 * A token is not an entitlement: OIDC federation hands every Vercel
 * deployment one, and the gateway can still refuse it — no credit, no access,
 * the account never enabled it. Treating the token alone as "AI is on" would
 * put a working-looking screen in front of a student and fail on the first
 * question, which is worse than the honest panel offering them a key of their
 * own.
 *
 * So it is asked, once, with the smallest possible completion — a real call,
 * because only a real call proves billing — and the answer is held for ten
 * minutes either way. This only ever runs when nothing else is configured.
 */
const HEALTH_MS = 10 * 60 * 1000;
let health: { at: number; ok: boolean } | null = null;

export function forgetGatewayHealth(): void {
  health = null;
}

export async function isGatewayUsable(): Promise<boolean> {
  const token = gatewayToken();
  if (!token) return false;
  if (health && Date.now() - health.at < HEALTH_MS) return health.ok;

  let ok = false;
  try {
    const models = await discoverModels();
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: models[0] ?? LAST_RESORT,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    ok = response.ok;
  } catch {
    ok = false;
  }

  health = { at: Date.now(), ok };
  return ok;
}

/** Never throws: a failed read leaves the last-resort model rather than none. */
async function discoverModels(): Promise<string[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.ids;

  try {
    // The gateway serves its catalogue unauthenticated.
    const response = await fetch(CATALOGUE);
    if (!response.ok) return cache?.ids ?? [];

    const payload = (await response.json()) as { data?: Array<{ id?: unknown }> } | null;
    const ids = rankGatewayModels(payload?.data ?? []);
    if (ids.length === 0) return cache?.ids ?? [];

    cache = { at: Date.now(), ids };
    return ids;
  } catch {
    return cache?.ids ?? [];
  }
}

async function config(): Promise<CompatConfig> {
  const token = gatewayToken();
  if (!token) throw new Error('AI_NOT_CONFIGURED');

  const pinned = process.env.AI_GATEWAY_MODEL?.trim();
  const models = pinned ? [pinned] : await discoverModels();

  return {
    endpoint: ENDPOINT,
    token,
    models: models.length > 0 ? models : [LAST_RESORT],
    // The gateway routes by the single `model` field; a `models` array is an
    // OpenRouter extension and sending it here would be noise at best.
    supportsFallbackList: false,
  };
}

/** One structured call, returning parsed JSON that matches `opts.schema`. */
export async function callStructuredViaGateway<T>(opts: StructuredCallOptions): Promise<T> {
  return compatStructured<T>(await config(), opts);
}

/** A plain-prose call, for the chat assistant. */
export async function callTextViaGateway(opts: {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
}): Promise<string> {
  return compatText(await config(), opts);
}
