'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { adminEmailFor, isAdmin, adminExists } from './queries';
import { isPasswordPwned } from '@/lib/auth/pwned';

export interface AdminState {
  error?: string;
  ok?: boolean;
}

const USERNAME = /^[a-z0-9_.-]{3,32}$/;

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
  const username = String(formData.get('username') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!USERNAME.test(username) || password.length < 8) return { error: 'invalid' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: adminEmailFor(username),
    password,
  });
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
  const username = String(formData.get('username') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');

  if (!USERNAME.test(username)) return { error: 'badUsername' };
  if (password.length < 10) return { error: 'shortPassword' };
  if (password !== confirm) return { error: 'mismatch' };
  if (await isPasswordPwned(password)) return { error: 'pwned' };
  if (await adminExists()) return { error: 'taken' };

  const supabase = await createClient();
  const email = adminEmailFor(username);

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

export async function adminSignOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/admin/sign-in');
}
