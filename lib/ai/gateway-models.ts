/**
 * Choosing which model the Vercel AI Gateway should run on.
 *
 * Pure so the ranking can be tested against real catalogue shapes, with no
 * network and no server context.
 */

/**
 * The gateway names models `provider/model`. The prompts in this app were
 * written against Claude and the document readers need vision, so an Anthropic
 * model is preferred when the roster offers one.
 */
const PREFERRED_PREFIXES = ['anthropic/', 'openai/', 'google/'];

/**
 * Rank the gateway's roster: preferred providers first, then whatever is left,
 * so a missing Anthropic model degrades to another vendor rather than to
 * nothing. Exported for testing.
 */
export function rankGatewayModels(models: readonly { id?: unknown }[], limit = 4): string[] {
  const ids = models
    .map((m) => m.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const rank = (id: string) => {
    const i = PREFERRED_PREFIXES.findIndex((p) => id.startsWith(p));
    return i === -1 ? PREFERRED_PREFIXES.length : i;
  };

  return [...ids]
    .sort((a, b) => (rank(a) - rank(b)) || a.localeCompare(b))
    .slice(0, limit);
}
