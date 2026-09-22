import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import {
  OPENROUTER_MODEL, callStructuredViaOpenRouter, callTextViaOpenRouter,
} from './openrouter';
import {
  GATEWAY_MODEL, isGatewayAvailable, callStructuredViaGateway, callTextViaGateway,
} from './vercel-gateway';
import { envCredential, resolveCredential, type AiCredential, type AiProvider } from './credentials';

export type { AiProvider, AiCredential };

/**
 * Which service the agents talk to.
 *
 * Anthropic first, because the prompts and the structured-output calls were
 * written against it. OpenRouter second, so a deployment with no Anthropic key
 * still gets every AI feature — it fronts many models, free ones included,
 * behind a single key. Then the student's own key, then Vercel's gateway.
 *
 * Null means none of those is available, which stays a supported state: every
 * agent has a deterministic fallback and the product works without AI.
 */
export async function aiProvider(): Promise<AiProvider | null> {
  return (await resolveCredential())?.provider ?? null;
}

/**
 * The same question asked of the environment alone, without a database read.
 * Used where there is no signed-in student to have a key of their own.
 */
export function deploymentProvider(): AiProvider | null {
  const env = envCredential();
  if (env) return env.provider;
  return isGatewayAvailable() ? 'gateway' : null;
}

/** The Anthropic model, used when that is the provider. */
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5';

/**
 * The model the agents run on, for display and logging. Overridable so a
 * deployment can trade cost against depth without touching agent code.
 */
export function modelNameFor(provider: AiProvider | null): string {
  if (provider === 'openrouter') return OPENROUTER_MODEL;
  if (provider === 'gateway') return GATEWAY_MODEL;
  return ANTHROPIC_MODEL;
}

/**
 * The model of whatever the deployment itself is configured with. Kept for
 * logs and for anything that runs outside a student's session; a screen a
 * student is looking at asks `modelNameFor(await aiProvider())` instead, so it
 * names the model their own key runs on.
 */
export const AI_MODEL = modelNameFor(deploymentProvider());

/** True when a credential is available — the deployment's, or the student's own. */
export async function isAiConfigured(): Promise<boolean> {
  return (await resolveCredential()) !== null;
}

/**
 * Server-only Anthropic client for a given key. Not cached across keys: two
 * students may be holding two different ones, and a client built for the wrong
 * key is the kind of mix-up nothing downstream would notice.
 */
function anthropicFor(key: string): Anthropic {
  return new Anthropic({ apiKey: key });
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
  const cred = await resolveCredential();
  if (cred === null) throw new Error('AI_NOT_CONFIGURED');
  if (cred.provider === 'openrouter') return callStructuredViaOpenRouter<T>(opts, cred.key);
  if (cred.provider === 'gateway') return callStructuredViaGateway<T>(opts);

  const client = anthropicFor(cred.key);
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
  const cred = await resolveCredential();
  if (cred === null) throw new Error('AI_NOT_CONFIGURED');
  if (cred.provider === 'openrouter') return callTextViaOpenRouter(opts, cred.key);
  if (cred.provider === 'gateway') return callTextViaGateway(opts);

  const client = anthropicFor(cred.key);
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
