import 'server-only';
import { createHash } from 'node:crypto';

/**
 * Whether a password is one of the ones already published in a breach.
 *
 * Supabase offers this as a switch in its dashboard, against the same list.
 * The switch is not something this repository can set, and a password that has
 * already leaked is the single most useful thing to refuse, so the check is
 * done here instead.
 *
 * k-anonymity: only the first five characters of the SHA-1 are sent. The
 * service answers with every suffix under that prefix and the comparison
 * happens locally, so the password — and anything that could be turned back
 * into it — never leaves this process.
 */
const ENDPOINT = 'https://api.pwnedpasswords.com/range';

export async function isPasswordPwned(password: string): Promise<boolean> {
  try {
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const response = await fetch(`${ENDPOINT}/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;

    const body = await response.text();
    return body.split('\n').some((line) => {
      const [hash, count] = line.trim().split(':');
      return hash === suffix && Number(count) > 0;
    });
  } catch {
    // The service being unreachable is not evidence against the password, and
    // refusing a sign-up over it would be a worse failure than allowing one.
    return false;
  }
}
