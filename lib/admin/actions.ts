'use server';

import { timingSafeEqual } from 'node:crypto';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { adminIdentifierToEmail, adminUsernameFrom, isAdmin, adminExists } from './queries';
import { isPasswordPwned } from '@/lib/auth/pwned';

export interface AdminState {
  error?: string;
  ok?: boolean;
}

/**
 * Compare two secrets without leaking the answer through how long it took.
 *
 * A plain `===` returns faster the earlier it finds a difference, which is
 * enough to recover a token one character at a time given patience.
 */
function timingSafeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Sign in to the admin side.
 *
 * A username, not an email, and it is mapped into a domain that student
 * sign-up cannot produce. That is what keeps the two credential sets apart:
 * not a flag on a shared account, but an address a student cannot register.
 *
 * A correct password on an account that is not an administrator is signed
 * straight back out — the session must not be left standing.
 */
export async function adminSignIn(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const identifier = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');

  const email = adminIdentifierToEmail(identifier);
  if (!email || password.length < 8) return { error: 'invalid' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'invalid' };

  if (!(await isAdmin())) {
    await supabase.auth.signOut();
    return { error: 'notAdmin' };
  }

  revalidatePath('/', 'layout');
  redirect('/admin');
}

/**
 * Claim the admin side, once.
 *
 * The database refuses this the moment one administrator exists, so the page
 * being reachable is not what protects it. Whoever runs it chooses their own
 * username and password, which is why no credential for this ever has to be
 * written down or sent anywhere.
 */
export async function adminBootstrap(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const identifier = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');
  const token = String(formData.get('setupToken') ?? '');

  /*
   * Claiming the admin side takes something only the deployment's owner has.
   *
   * Before this, whoever opened the page first became the administrator of the
   * whole deployment — and the page's address is published in a public
   * repository. Being early is not a credential.
   *
   * With no token configured the page cannot be used at all, which is the safe
   * direction: a deployment nobody has set a token on is a deployment nobody
   * can claim.
   */
  const expected = process.env.ADMIN_SETUP_TOKEN ?? '';
  if (expected.length < 16) return { error: 'setupClosed' };
  if (!timingSafeEquals(token, expected)) return { error: 'badToken' };

  // A username or an email, because people reach for both and refusing one of
  // them reads as "my password is wrong" rather than "wrong field".
  const email = adminIdentifierToEmail(identifier);
  if (!email) return { error: 'badUsername' };
  if (password.length < 10) return { error: 'shortPassword' };
  if (password !== confirm) return { error: 'mismatch' };
  if (await isPasswordPwned(password)) return { error: 'pwned' };
  if (await adminExists()) return { error: 'taken' };

  const username = adminUsernameFrom(identifier);
  const supabase = await createClient();

  /*
   * Whoever sets this up is usually signed in as a student already. Ending
   * that session first means the admin account is created and signed into
   * cleanly, rather than layered on top of a session that is about to be
   * replaced anyway.
   */
  await supabase.auth.signOut();

  const { error: signUpError } = await supabase.auth.signUp({ email, password });
  if (signUpError) return { error: 'signUpFailed' };

  // Email confirmation is stamped as the row is written, so the password just
  // chosen is enough to get a session here.
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: 'signUpFailed' };

  const { error: claimError } = await supabase.rpc('admin_bootstrap', { p_username: username });
  if (claimError) {
    await supabase.auth.signOut();
    return { error: 'taken' };
  }

  revalidatePath('/', 'layout');
  redirect('/admin');
}

/** Suspend or restore a student account. */
export async function setSuspended(userId: string, suspended: boolean): Promise<AdminState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_suspended', {
    p_user: userId,
    p_suspended: suspended,
  });
  if (error) return { error: 'failed' };

  revalidatePath('/admin');
  return { ok: true };
}

/**
 * Remove a student's stored AI key.
 *
 * Note what an administrator can do and what they cannot: clear a key that is
 * failing, never read one.
 */
export async function clearAiKeyFor(userId: string): Promise<AdminState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_clear_ai_key', { p_user: userId });
  if (error) return { error: 'failed' };

  revalidatePath('/admin');
  return { ok: true };
}

/**
 * Change the signed-in administrator's own password.
 *
 * Supabase checks the session, not the old password, so the old one is
 * verified here by signing in with it first. Without that, anyone who got hold
 * of an unlocked browser could lock the real administrator out of their own
 * deployment in two clicks.
 */
export async function adminChangePassword(
  _prev: AdminState, formData: FormData,
): Promise<AdminState> {
  const current = String(formData.get('currentPassword') ?? '');
  const next = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');

  if (!(await isAdmin())) return { error: 'notAdmin' };
  if (next.length < 10) return { error: 'shortPassword' };
  if (next !== confirm) return { error: 'mismatch' };
  if (next === current) return { error: 'same' };
  if (await isPasswordPwned(next)) return { error: 'pwned' };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const email = auth.user?.email;
  if (!email) return { error: 'notAdmin' };

  const { error: wrongCurrent } = await supabase.auth.signInWithPassword({
    email, password: current,
  });
  if (wrongCurrent) return { error: 'wrongCurrent' };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: 'failed' };

  revalidatePath('/admin');
  return { ok: true };
}

/** Remove every stored key, for one that has been revoked at the provider. */
export async function clearAllAiKeys(): Promise<AdminState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_clear_all_ai_keys');
  if (error) return { error: 'failed' };

  revalidatePath('/admin');
  return { ok: true };
}

export async function adminSignOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/admin/sign-in');
}
