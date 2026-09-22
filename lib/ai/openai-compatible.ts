import 'server-only';
import type { StructuredCallOptions } from './client';
import { extractJson } from './json';

/**
 * The OpenAI chat-completions wire format, which every gateway speaks.
 *
 * OpenRouter and Vercel's AI Gateway both accept the same request and return
 * the same envelope, so the translation from this app's shape — a system
 * prompt, one user prompt, some documents, a JSON Schema — lives here once and
 * each provider supplies only what is genuinely its own: where to post, what
 * to authenticate with, and which models to name.
 */

export interface CompatConfig {
  /** Full chat-completions URL. */
  endpoint: string;
  /** Bearer credential. Never logged, never put in the body. */
  token: string;
  /** Attribution or routing headers the provider asks for. */
  extraHeaders?: Record<string, string>;
  /**
   * First choice first. Providers that accept a fallback list get the rest as
   * `models`, which matters on rosters where a model is often busy.
   */
  models: string[];
  /** Whether this provider understands the `models` fallback array. */
  supportsFallbackList?: boolean;
  /**
   * Extra top-level fields for this provider only — OpenRouter's file parser,
   * for instance. Merged into the body, never over the fields above.
   */
  extraBody?: Record<string, unknown>;
}

type Part =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } };

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Part[];
}

async function post(cfg: CompatConfig, body: Record<string, unknown>): Promise<string> {
  if (!cfg.token) throw new Error('AI_NOT_CONFIGURED');
  if (cfg.models.length === 0) throw new Error('AI_NO_MODEL');

  let response: Response;
  try {
    response = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
        ...(cfg.extraHeaders ?? {}),
      },
      body: JSON.stringify({
        model: cfg.models[0],
        ...(cfg.supportsFallbackList && cfg.models.length > 1 ? { models: cfg.models } : {}),
        ...(cfg.extraBody ?? {}),
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
    throw new Error(`AI_HTTP_${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`);
  }

  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string | null; refusal?: string | null } }>;
  } | null;

  // A 200 carrying an error body is a shape these gateways do use.
  if (!payload || payload.error) {
    throw new Error(`AI_PROVIDER_ERROR${payload?.error?.message ? `: ${payload.error.message}` : ''}`);
  }

  const choice = payload.choices?.[0]?.message;
  if (choice?.refusal) throw new Error('AI_REFUSED');

  const text = (choice?.content ?? '').trim();
  if (!text) throw new Error('AI_EMPTY_RESPONSE');
  return text;
}

/** This app's document blocks in the shape the wire format expects. */
function partsFor(opts: StructuredCallOptions): Part[] {
  const parts: Part[] = [];
  for (const doc of opts.documents ?? []) {
    if (doc.kind === 'image') {
      parts.push({ type: 'image_url', image_url: { url: `data:${doc.mediaType};base64,${doc.data}` } });
    } else {
      parts.push({
        type: 'file',
        file: { filename: 'document.pdf', file_data: `data:application/pdf;base64,${doc.data}` },
      });
    }
  }
  parts.push({ type: 'text', text: opts.prompt });
  return parts;
}

/** One structured call, returning parsed JSON that matches `opts.schema`. */
export async function compatStructured<T>(
  cfg: CompatConfig,
  opts: StructuredCallOptions,
): Promise<T> {
  const messages: ChatMessage[] = [
    { role: 'system', content: opts.system },
    { role: 'user', content: partsFor(opts) },
  ];

  const text = await post(cfg, {
    max_tokens: opts.maxTokens ?? 16000,
    messages,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: opts.schemaName,
        // Not every model behind a gateway can satisfy strict mode, and the
        // ones that cannot reject the request outright rather than degrading.
        // The schema is still sent and still steers the reply.
        strict: false,
        schema: opts.schema,
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
export async function compatText(
  cfg: CompatConfig,
  opts: {
    system: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    maxTokens?: number;
  },
): Promise<string> {
  return post(cfg, {
    max_tokens: opts.maxTokens ?? 4000,
    messages: [
      { role: 'system', content: opts.system },
      ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
    ] satisfies ChatMessage[],
  });
}
