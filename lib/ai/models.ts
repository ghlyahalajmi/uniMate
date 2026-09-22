/**
 * Choosing which OpenRouter model to run on, without anyone having to name one.
 *
 * Hardcoding a model id does not survive contact with time: the free roster on
 * OpenRouter is rotated constantly, and a pinned id quietly becomes a 404 some
 * months later. So the list is read from OpenRouter itself and filtered down to
 * the models that cost nothing, and the request carries several of them so the
 * provider can fall through if the first is busy.
 *
 * This module is the pure half — no network, no environment — so the choice can
 * be tested against real catalogue shapes.
 */

/** A model as OpenRouter's /models endpoint describes it. */
export interface CatalogueModel {
  id?: unknown;
  context_length?: unknown;
  pricing?: { prompt?: unknown; completion?: unknown } | null;
  architecture?: { input_modalities?: unknown } | null;
  supported_parameters?: unknown;
}

/** A price field is free when it parses to exactly zero. */
function isFree(value: unknown): boolean {
  if (typeof value === 'number') return value === 0;
  if (typeof value !== 'string' || value.trim() === '') return false;
  const n = Number(value);
  return Number.isFinite(n) && n === 0;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * How many models a request may name.
 *
 * OpenRouter rejects a request whose `models` array is longer than three —
 * "'models' array must have 3 items or fewer", a flat 400 that fails every
 * agent at once. Learned the hard way: five were being sent and nothing
 * worked, on a key that was perfectly good.
 */
export const MAX_FALLBACK_MODELS = 3;

/**
 * The free models worth trying, best first.
 *
 * "Best" here is deliberately crude, because the catalogue gives little to go
 * on: a model that advertises structured output is ranked above one that does
 * not, since every agent but the chat assistant asks for JSON, and a longer
 * context wins the tie because syllabus PDFs are long. Order is otherwise
 * stable so the same catalogue always yields the same list.
 *
 * `needsImage` narrows it to models that can actually see a picture. A
 * photographed timetable handed to a text-only model is not a worse answer, it
 * is an invented one.
 */
export function pickFreeModels(
  models: readonly CatalogueModel[],
  limit = MAX_FALLBACK_MODELS,
  needsImage = false,
): string[] {
  const scored = models
    .filter((m) => typeof m.id === 'string' && m.id.length > 0)
    .filter((m) => isFree(m.pricing?.prompt) && isFree(m.pricing?.completion))
    .filter((m) => !needsImage || asStrings(m.architecture?.input_modalities).includes('image'))
    .map((m) => {
      const params = asStrings(m.supported_parameters);
      const structured =
        params.includes('response_format') || params.includes('structured_outputs');
      const context = typeof m.context_length === 'number' ? m.context_length : 0;
      return { id: m.id as string, structured, context };
    });

  scored.sort((a, b) => {
    if (a.structured !== b.structured) return a.structured ? -1 : 1;
    if (a.context !== b.context) return b.context - a.context;
    return a.id.localeCompare(b.id);
  });

  return scored.slice(0, limit).map((m) => m.id);
}

/**
 * Which models a request should name, given what is configured and what the
 * catalogue offered.
 *
 * A pinned `OPENROUTER_MODEL` always wins and is used alone — someone who named
 * a model meant that model. Otherwise the discovered free list is used, and if
 * discovery produced nothing at all the caller is left with OpenRouter's own
 * router rather than no request.
 */
export function resolveModels(pinned: string | undefined, discovered: readonly string[]): string[] {
  const trimmed = pinned?.trim();
  if (trimmed) return [trimmed];
  if (discovered.length > 0) return [...discovered];
  return ['openrouter/auto'];
}
