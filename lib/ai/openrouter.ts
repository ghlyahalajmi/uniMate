import 'server-only';
import type { StructuredCallOptions } from './client';
import { compatStructured, compatText, type CompatConfig } from './openai-compatible';
import { pickFreeModels, resolveModels, type CatalogueModel } from './models';

/**
 * OpenRouter, as a second way to power the AI features.
 *
 * The app was written against Anthropic's API and still prefers it when a key
 * is present. This exists so a deployment that has no Anthropic key — or does
 * not want a second paid account — can still run every agent, including on
 * OpenRouter's free models.
 *
 * The wire format is shared with every other gateway and lives in
 * `openai-compatible`; what belongs here is the free-model discovery, which is
 * OpenRouter's alone.
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const CATALOGUE = 'https://openrouter.ai/api/v1/models';

/**
 * What Settings shows. `auto` is not a model id here — it is the honest answer
 * when the model is decided per request from whatever OpenRouter currently
 * offers for free.
 */
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? 'openrouter · free models (auto)';

/**
 * The discovered free roster, remembered for an hour.
 *
 * A miss costs one extra request and the result is the same for every student,
 * so it is worth holding. An hour is short enough that a model retired today
 * stops being offered today, and long enough that the catalogue is not fetched
 * on every question a student asks.
 */
const CACHE_MS = 60 * 60 * 1000;
let cache: { at: number; ids: string[] } | null = null;

/** Exposed for tests and for a deployment that wants to force a re-read. */
export function forgetFreeModels(): void {
  cache = null;
}

/**
 * OpenRouter asks for these so usage shows up against the right app. Neither
 * is required, and neither carries anything about the student.
 */
function attribution(): Record<string, string> {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  return { 'X-Title': 'UniMate', ...(site ? { 'HTTP-Referer': site } : {}) };
}

/**
 * Ask OpenRouter which models cost nothing today.
 *
 * Never throws: discovery is an optimisation, and a failure here should degrade
 * to OpenRouter's own router rather than take down every AI feature.
 */
async function discoverFreeModels(key: string): Promise<string[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.ids;

  try {
    const response = await fetch(CATALOGUE, {
      headers: { Authorization: `Bearer ${key}`, ...attribution() },
    });
    if (!response.ok) return cache?.ids ?? [];

    const payload = (await response.json()) as { data?: CatalogueModel[] } | null;
    const ids = pickFreeModels(payload?.data ?? []);
    if (ids.length === 0) return cache?.ids ?? [];

    cache = { at: Date.now(), ids };
    return ids;
  } catch {
    return cache?.ids ?? [];
  }
}

async function config(): Promise<CompatConfig> {
  const token = process.env.OPENROUTER_API_KEY ?? '';
  if (!token) throw new Error('AI_NOT_CONFIGURED');

  const pinned = process.env.OPENROUTER_MODEL;
  return {
    endpoint: ENDPOINT,
    token,
    extraHeaders: attribution(),
    models: resolveModels(pinned, pinned ? [] : await discoverFreeModels(token)),
    // OpenRouter falls through this list when the first model is busy — which
    // on the free roster is a normal Tuesday rather than an exception.
    supportsFallbackList: true,
  };
}

/** One structured call, returning parsed JSON that matches `opts.schema`. */
export async function callStructuredViaOpenRouter<T>(opts: StructuredCallOptions): Promise<T> {
  return compatStructured<T>(await config(), opts);
}

/** A plain-prose call, for the chat assistant. */
export async function callTextViaOpenRouter(opts: {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
}): Promise<string> {
  return compatText(await config(), opts);
}
