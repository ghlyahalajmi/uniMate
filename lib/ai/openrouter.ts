import 'server-only';
import type { StructuredCallOptions } from './client';
import { compatStructured, compatText, type CompatConfig } from './openai-compatible';
import {
  pickFreeModels, resolveModels, MAX_FALLBACK_MODELS, type CatalogueModel,
} from './models';

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
async function discoverFreeModels(key: string, needsImage = false): Promise<string[]> {
  if (!needsImage && cache && Date.now() - cache.at < CACHE_MS) return cache.ids;

  try {
    const response = await fetch(CATALOGUE, {
      headers: { Authorization: `Bearer ${key}`, ...attribution() },
    });
    if (!response.ok) return cache?.ids ?? [];

    const payload = (await response.json()) as { data?: CatalogueModel[] } | null;
    const ids = pickFreeModels(payload?.data ?? [], MAX_FALLBACK_MODELS, needsImage);
    if (ids.length === 0) return needsImage ? [] : (cache?.ids ?? []);

    // Only the general roster is worth remembering; the narrowed one is for
    // this request alone.
    if (!needsImage) cache = { at: Date.now(), ids };
    return ids;
  } catch {
    return cache?.ids ?? [];
  }
}

async function config(
  key: string,
  documents: StructuredCallOptions['documents'] = [],
): Promise<CompatConfig> {
  const token = key || process.env.OPENROUTER_API_KEY || '';
  if (!token) throw new Error('AI_NOT_CONFIGURED');

  const needsImage = documents.some((d) => d.kind === 'image');
  const hasPdf = documents.some((d) => d.kind === 'pdf');

  const pinned = process.env.OPENROUTER_MODEL;
  const discovered = pinned ? [] : await discoverFreeModels(token, needsImage);

  return {
    endpoint: ENDPOINT,
    token,
    extraHeaders: attribution(),
    // Never more than three: OpenRouter refuses a longer list outright, and
    // the refusal is a 400 that takes down every agent at once.
    models: resolveModels(pinned, discovered).slice(0, MAX_FALLBACK_MODELS),
    // OpenRouter falls through this list when the first model is busy — which
    // on the free roster is a normal Tuesday rather than an exception.
    supportsFallbackList: true,
    /*
     * A PDF chapter should work on a model that cannot read PDFs. OpenRouter's
     * own parser turns the file into text before the model sees it, and the
     * `pdf-text` engine costs nothing — which matters, because the point of
     * this route is that a student can use it with a free key.
     */
    ...(hasPdf
      ? { extraBody: { plugins: [{ id: 'file-parser', pdf: { engine: 'pdf-text' } }] } }
      : {}),
  };
}

/** One structured call, returning parsed JSON that matches `opts.schema`. */
export async function callStructuredViaOpenRouter<T>(
  opts: StructuredCallOptions, key = '',
): Promise<T> {
  return compatStructured<T>(await config(key, opts.documents), opts);
}

/** A plain-prose call, for the chat assistant. */
export async function callTextViaOpenRouter(opts: {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
}, key = ''): Promise<string> {
  return compatText(await config(key), opts);
}
