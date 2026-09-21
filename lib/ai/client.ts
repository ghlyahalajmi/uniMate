import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import {
  OPENROUTER_MODEL, callStructuredViaOpenRouter, callTextViaOpenRouter,
} from './openrouter';

/**
 * Which service the agents talk to.
 *
 * Anthropic first, because the prompts and the structured-output calls were
 * written against it. OpenRouter second, so a deployment with no Anthropic key
 * still gets every AI feature — it fronts many models, free ones included,
 * behind a single key.
 *
 * Null means neither is configured, which stays a supported state: every agent
 * has a deterministic fallback and the product works without AI.
 */
export type AiProvider = 'anthropic' | 'openrouter';

export function aiProvider(): AiProvider | null {
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  return null;
}

/** The Anthropic model, used when that is the provider. */
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5';

/**
 * The model the agents run on, for display and logging. Overridable so a
 * deployment can trade cost against depth without touching agent code.
 */
export const AI_MODEL = process.env.ANTHROPIC_API_KEY
  ? ANTHROPIC_MODEL
  : process.env.OPENROUTER_API_KEY
    ? OPENROUTER_MODEL
    : ANTHROPIC_MODEL;

let cached: Anthropic | null = null;

/** True when either provider has a key. Never exposes the key itself. */
export function isAiConfigured(): boolean {
  return aiProvider() !== null;
}

/**
 * Server-only Anthropic client. Returns null when no key is configured, which
 * is a supported state: every agent has a deterministic fallback so the
 * product keeps working without AI.
 */
export function getAnthropic(): Anthropic | null {
  if (aiProvider() !== 'anthropic') return null;
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
  const provider = aiProvider();
  if (provider === null) throw new Error('AI_NOT_CONFIGURED');
  if (provider === 'openrouter') return callStructuredViaOpenRouter<T>(opts);

  const client = getAnthropic();
  if (!client) throw new Error('AI_NOT_CONFIGURED');

  const model = ANTHROPIC_MODEL;

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
    model,
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
  const provider = aiProvider();
  if (provider === null) throw new Error('AI_NOT_CONFIGURED');
  if (provider === 'openrouter') return callTextViaOpenRouter(opts);

  const client = getAnthropic();
  if (!client) throw new Error('AI_NOT_CONFIGURED');

  const model = ANTHROPIC_MODEL;

  const response = await client.messages.create({
    model,
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
