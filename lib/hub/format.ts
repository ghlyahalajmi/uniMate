/**
 * Display helpers for hub links. Pure, so they are safe to call during render
 * on either side.
 */

/**
 * The host, without `www.`, for the small grey line under a link's name.
 *
 * Never throws: the URL is already constrained to https by the database and
 * the form, but a row written before a constraint existed should degrade to a
 * blank label rather than crash the page.
 */
export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * One or two letters for the tile, taken from the link's name.
 *
 * Words are filtered for ones that actually start with a letter or digit, so
 * "— UniMate" initials as "U", not "—".
 */
export function initialsOf(title: string): string {
  const words = title
    .split(/[\s—–-]+/)
    .map((w) => w.trim())
    .filter((w) => /^[\p{L}\p{N}]/u.test(w));

  if (words.length === 0) return '•';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
