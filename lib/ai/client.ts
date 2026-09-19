import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

/**
 * The model the agents run on. Overridable so a deployment can trade cost
 * against depth without touching agent code.
 */
export const AI_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5';

let cached: Anthropic | null = null;

/** True when an API key is present. Never exposes the key itself. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Server-only Anthropic client. Returns null when no key is configured, which
 * is a supported state: every agent has a deterministic fallback so the
 * product keeps working without AI.
 */
export function getAnthropic(): Anthropic | null {
  if (!isAiConfigured()) return null;
  cached ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return cached;
}

/** JSON Schema subset we hand to `output_config.format`. */
export type JsonSchema = Record<string, unknown>;

export interface StructuredCallOptions {
  system: string;
  prompt: string;
  schema: JsonSchema;
  /** Label for logs and error messages; not sent to the API. */
  schemaName: string;
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high';
  /** Images or PDFs to read alongside the prompt. */
  documents?: Array<
    | { kind: 'image'; mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; data: string }
    | { kind: 'pdf'; data: string }
  >;
}

/**
 * One structured call to Claude, returning parsed JSON that matches `schema`.
 *
 * Uses `output_config.format` so the response is schema-valid rather than
 * prose we have to scrape. Throws on transport or parse failure — callers run
 * inside `runAgent`, which turns a throw into a logged `failed` ai_run and a
 * deterministic fallback.
 */
export async function callStructured<T>(opts: StructuredCallOptions): Promise<T> {
  const client = getAnthropic();
  if (!client) throw new Error('AI_NOT_CONFIGURED');

  const content: Anthropic.ContentBlockParam[] = [];

  for (const doc of opts.documents ?? []) {
    if (doc.kind === 'image') {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: doc.mediaType, data: doc.data },
      });
    } else {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: doc.data },
      });
    }
  }
  content.push({ type: 'text', text: opts.prompt });

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: opts.effort ?? 'medium',
      format: { type: 'json_schema', schema: opts.schema },
    },
    messages: [{ role: 'user', content }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('AI_REFUSED');
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  if (!text.trim()) throw new Error('AI_EMPTY_RESPONSE');

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('AI_INVALID_JSON');
  }
}

/** A plain-prose call, for the chat assistant where JSON would get in the way. */
export async function callText(opts: {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high';
}): Promise<string> {
  const client = getAnthropic();
  if (!client) throw new Error('AI_NOT_CONFIGURED');

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    system: opts.system,
    thinking: { type: 'adaptive' },
    output_config: { effort: opts.effort ?? 'medium' },
    messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
  });

  if (response.stop_reason === 'refusal') throw new Error('AI_REFUSED');

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}
