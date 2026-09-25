import 'server-only';
import { createPrivateKey, sign as signRaw } from 'node:crypto';

/**
 * Waking a phone, without telling anyone what woke it.
 *
 * A Web Push goes through a service belonging to whoever made the browser —
 * Google for Chrome, Apple for Safari, Mozilla for Firefox. That service can
 * see everything the push carries. So this one carries nothing: an empty body
 * with no payload at all. The service worker wakes, asks UniMate's own API
 * what is due using the student's own session, and writes the notification
 * from the answer.
 *
 * The cost is one request per notification. What it buys is that the title of
 * a reminder — which is a course code and a piece of coursework — never leaves
 * this deployment, and a push service that logged every message it delivered
 * would have logged nothing about anybody's semester.
 *
 * VAPID is what makes a push acceptable to those services without an account
 * with each of them: the request is signed with a key pair whose public half
 * the browser was given at subscribe time, which proves the push comes from
 * the same application the person subscribed to.
 */

const TWELVE_HOURS = 12 * 60 * 60;

/** How long a push service should hold the message if the device is offline. */
const TTL_SECONDS = 15 * 60;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/**
 * The signed token a push service checks before it accepts the request.
 *
 * `aud` is the *origin* of the endpoint, not the endpoint itself: the token is
 * good for every push to that service for its lifetime, so one signature
 * serves a whole run rather than one per device.
 */
function vapidToken(audience: string, subject: string, privateJwkD: string, publicKey: string): string {
  const header = base64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = base64url(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + TWELVE_HOURS,
    sub: subject,
  }));

  // The public half is carried as the JWK's x and y, recovered from the
  // uncompressed point the browser was given: 0x04 || X || Y.
  const point = Buffer.from(publicKey, 'base64url');
  if (point.length !== 65 || point[0] !== 4) throw new Error('VAPID_PUBLIC_KEY is not an uncompressed P-256 point');

  const key = createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      d: privateJwkD,
      x: base64url(point.subarray(1, 33)),
      y: base64url(point.subarray(33, 65)),
    },
    format: 'jwk',
  });

  // JOSE wants the raw r||s pair; Node's default for EC is DER, which every
  // push service rejects with a bare 401 and no explanation.
  const signature = signRaw('sha256', Buffer.from(`${header}.${claims}`), {
    key,
    dsaEncoding: 'ieee-p1363',
  });

  return `${header}.${claims}.${base64url(signature)}`;
}

export interface PushResult {
  endpoint: string;
  ok: boolean;
  status: number;
  /** True when the subscription is dead and its row should go. */
  gone: boolean;
}

/**
 * Sends one empty push. Never throws: a device that has been wiped, or a
 * service having a bad minute, must not stop the other devices in the run.
 */
export async function sendEmptyPush(endpoint: string): Promise<PushResult> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:unimate@example.com';

  if (!publicKey || !privateKey) {
    return { endpoint, ok: false, status: 0, gone: false };
  }

  try {
    const audience = new URL(endpoint).origin;
    const token = vapidToken(audience, subject, privateKey, publicKey);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${token}, k=${publicKey}`,
        TTL: String(TTL_SECONDS),
        'Content-Length': '0',
        Urgency: 'high',
      },
      signal: AbortSignal.timeout(10_000),
    });

    return {
      endpoint,
      ok: response.ok,
      status: response.status,
      // 404 and 410 mean the browser threw the subscription away: the app was
      // uninstalled, or site data was cleared. The row is dead weight now.
      gone: response.status === 404 || response.status === 410,
    };
  } catch {
    return { endpoint, ok: false, status: 0, gone: false };
  }
}

/** Whether this deployment can send at all. */
export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}
