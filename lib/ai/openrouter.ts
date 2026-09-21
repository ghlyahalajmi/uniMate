import 'server-only';
import type { JsonSchema, StructuredCallOptions } from './client';
import { extractJson } from './json';

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

/**
 * The default routes the request rather than naming a model, because model ids
 * on OpenRouter come and go and a hardcoded one turns into a 404 months later.
 * Set `OPENROUTER_MODEL` to pin a specific model — including a `:free` one.
 */
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? 'openrouter/auto';

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

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...attribution(),
      },
      body: JSON.stringify({ model: OPENROUTER_MODEL, ...body }),
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
