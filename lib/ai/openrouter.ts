import 'server-only';
import type { JsonSchema, StructuredCallOptions } from './client';
import { extractJson } from './json';
import { pickFreeModels, resolveModels, type CatalogueModel } from './models';

/**
 * OpenRouter, as a second way to power the AI features.
 *
 * The app was written against Anthropic's API and still prefers it when a key
 * is present. This exists so a deployment that has no Anthropic key — or does
 * not want a second paid account — can still run every agent, including on
 * OpenRouter's free models.
 *
 * OpenRouter speaks the OpenAI chat-completions shape, so this module is a
 * translation layer: our `system` + `prompt` + `documents` become one messages
 * array, and our JSON Schema becomes `response_format`.
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

type Part =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } };

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Part[];
}

/**
 * OpenRouter asks for these so usage shows up against the right app. Neither
 * is required, and neither carries anything about the student.
 */
function attribution(): Record<string, string> {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  return { 'X-Title': 'UniMate', ...(site ? { 'HTTP-Referer': site } : {}) };
}

async function post(body: Record<string, unknown>): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('AI_NOT_CONFIGURED');

  const pinned = process.env.OPENROUTER_MODEL;
  const models = resolveModels(pinned, pinned ? [] : await discoverFreeModels(key));

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...attribution(),
      },
      // `model` is the first choice and `models` lets OpenRouter fall through
      // the rest when one is rate-limited or has been retired — which on the
      // free roster is a normal Tuesday, not an exception.
      body: JSON.stringify({
        model: models[0],
        ...(models.length > 1 ? { models } : {}),
        ...body,
      }),
    });
  } catch {
    throw new Error('AI_UNREACHABLE');
  }

  if (!response.ok) {
    // The body usually names the real cause — an unknown model, no credit, a
    // rate limit. Carrying it through means it lands in the ai_runs log
    // instead of being flattened into a bare status code.
    const detail = await response.text().catch(() => '');
    throw new Error(
      `AI_HTTP_${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
    );
  }

  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string | null; refusal?: string | null } }>;
  } | null;

  // A 200 with an error body is a shape OpenRouter does use.
  if (!payload || payload.error) {
    throw new Error(`AI_PROVIDER_ERROR${payload?.error?.message ? `: ${payload.error.message}` : ''}`);
  }

  const choice = payload.choices?.[0]?.message;
  if (choice?.refusal) throw new Error('AI_REFUSED');

  const text = (choice?.content ?? '').trim();
  if (!text) throw new Error('AI_EMPTY_RESPONSE');
  return text;
}

/** Our document blocks in the shape OpenRouter expects. */
function partsFor(opts: StructuredCallOptions): Part[] {
  const parts: Part[] = [];
  for (const doc of opts.documents ?? []) {
    if (doc.kind === 'image') {
      parts.push({
        type: 'image_url',
        image_url: { url: `data:${doc.mediaType};base64,${doc.data}` },
      });
    } else {
      parts.push({
        type: 'file',
        file: {
          filename: 'document.pdf',
          file_data: `data:application/pdf;base64,${doc.data}`,
        },
      });
    }
  }
  parts.push({ type: 'text', text: opts.prompt });
  return parts;
}

/** One structured call, returning parsed JSON that matches `opts.schema`. */
export async function callStructuredViaOpenRouter<T>(opts: StructuredCallOptions): Promise<T> {
  const messages: ChatMessage[] = [
    { role: 'system', content: opts.system },
    { role: 'user', content: partsFor(opts) },
  ];

  const text = await post({
    max_tokens: opts.maxTokens ?? 16000,
    messages,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: opts.schemaName,
        // Not every model behind OpenRouter can satisfy strict mode, and the
        // ones that cannot reject the request outright rather than degrading.
        // The schema is still sent and still steers the reply.
        strict: false,
        schema: opts.schema as JsonSchema,
      },
    },
  });

  try {
    return JSON.parse(extractJson(text)) as T;
  } catch {
    throw new Error('AI_INVALID_JSON');
  }
}

/** A plain-prose call, for the chat assistant. */
export async function callTextViaOpenRouter(opts: {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
}): Promise<string> {
  return post({
    max_tokens: opts.maxTokens ?? 4000,
    messages: [
      { role: 'system', content: opts.system },
      ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
    ] satisfies ChatMessage[],
  });
}
