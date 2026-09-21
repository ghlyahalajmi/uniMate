/**
 * Models behind OpenRouter vary in how well they honour `response_format`, and
 * a good few still wrap JSON in a markdown fence or add a sentence in front of
 * it. Rather than fail a whole agent run over punctuation, take the outermost
 * JSON value out of the reply.
 */
export function extractJson(raw: string): string {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  const start = text.search(/[[{]/);
  if (start === -1) return text;

  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}
