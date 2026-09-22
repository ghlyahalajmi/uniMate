import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { isGatewayUsable } from './vercel-gateway';

/**
 * Which credential the agents run on, and whose it is.
 *
 * There are two ways UniMate can reach a model. The deployment can carry a key
 * in its environment, which switches the AI on for everybody. Or a student can
 * save their own key — OpenRouter's free tier costs nothing — which switches it
 * on for their account alone.
 *
 * The second one exists because the first is not something a student can do.
 * "AI features are not configured" used to be a dead end unless you owned the
 * deployment; now it is a setting.
 *
 * Null stays a supported state: every agent has a deterministic fallback, and
 * grades, GPA, tasks and the calendar never touch a model at all.
 */

export type AiProvider = 'anthropic' | 'openrouter' | 'gateway';

export interface AiCredential {
  provider: AiProvider;
  /** Empty only for the gateway, which authenticates with the deployment's own token. */
  key: string;
  /** Whose key it is. Decides what Settings says, never what is sent. */
  source: 'deployment' | 'student';
}

/** The deployment's own credential, from the environment. */
export function envCredential(): AiCredential | null {
  const anthropic = process.env.ANTHROPIC_API_KEY;
  if (anthropic) return { provider: 'anthropic', key: anthropic, source: 'deployment' };

  const openrouter = process.env.OPENROUTER_API_KEY;
  if (openrouter) return { provider: 'openrouter', key: openrouter, source: 'deployment' };

  return null;
}

/**
 * The signed-in student's own key.
 *
 * Read with their session, so RLS is what decides they may see it — there is no
 * service-role read anywhere in this path and no way to ask for someone else's
 * row. The value is used to make the request and is never returned to a page.
 */
export async function studentCredential(): Promise<AiCredential | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from('ai_credentials')
    .select('provider, api_key')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (error || !data?.api_key) return null;
  const provider = data.provider === 'anthropic' ? 'anthropic' : 'openrouter';
  return { provider, key: data.api_key, source: 'student' };
}

/**
 * What Settings may show: the provider and the last four characters, from the
 * generated column, so the page never holds the key even for a moment.
 */
export async function studentKeyHint(): Promise<{ provider: AiProvider; hint: string } | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from('ai_credentials')
    .select('provider, hint')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (error || !data) return null;
  return {
    provider: data.provider === 'anthropic' ? 'anthropic' : 'openrouter',
    hint: typeof data.hint === 'string' ? data.hint : '',
  };
}

/**
 * The credential this request runs on.
 *
 * The deployment's key first, because it is the one an administrator chose for
 * everyone. Then the student's own. The Vercel gateway last: it needs no key at
 * all when OIDC federation is on, which makes it the right fallback and the
 * wrong first choice.
 */
export async function resolveCredential(): Promise<AiCredential | null> {
  const env = envCredential();
  if (env) return env;

  const student = await studentCredential();
  if (student) return student;

  if (await isGatewayUsable()) return { provider: 'gateway', key: '', source: 'deployment' };
  return null;
}

/**
 * Whether a key works, asked of the provider before it is saved.
 *
 * A key that turns out to be wrong two screens later reads as "the AI is
 * broken", so it is checked once, here, while the student is still looking at
 * the field they typed it into.
 */
export async function verifyKey(provider: AiProvider, key: string): Promise<boolean> {
  try {
    if (provider === 'openrouter') {
      const response = await fetch('https://openrouter.ai/api/v1/key', {
        headers: { Authorization: `Bearer ${key}` },
      });
      return response.ok;
    }

    const response = await fetch('https://api.anthropic.com/v1/models?limit=1', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    });
    return response.ok;
  } catch {
    // A network failure is not a wrong key, and refusing to save on one would
    // strand a student behind an outage they cannot see.
    return true;
  }
}
