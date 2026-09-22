'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { signInSchema, signUpSchema, fieldErrors } from '@/lib/validation/schemas';
import { isPasswordPwned } from '@/lib/auth/pwned';
import { ADMIN_EMAIL_DOMAIN } from '@/lib/admin/queries';

export interface AuthState {
  errors?: Record<string, string>;
  message?: string;
  success?: boolean;
}

/** Maps Supabase auth errors onto dictionary keys, never raw API text. */
function authErrorKey(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'errInvalid';
  if (m.includes('rate limit') || m.includes('too many')) return 'errRateLimited';
  if (m.includes('password')) return 'errWeakPassword';
  if (m.includes('email')) return 'errEmail';
  return 'errGeneric';
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { message: authErrorKey(error.message) };

  const next = String(formData.get('next') ?? '/dashboard');
  revalidatePath('/', 'layout');
  redirect(next.startsWith('/') ? next : '/dashboard');
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');
  if (password !== confirm) return { errors: { confirmPassword: 'errMismatch' } };

  const parsed = signUpSchema.safeParse({
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    password,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // The administrators' domain is not a student address. Refusing it here is
  // what makes "admin credentials are separate" true rather than a convention.
  if (parsed.data.email.toLowerCase().endsWith(`@${ADMIN_EMAIL_DOMAIN}`)) {
    return { errors: { email: 'errEmail' } };
  }

  // A password that has already been published in a breach is the one thing
  // worth refusing outright: it is not guessed, it is looked up.
  if (await isPasswordPwned(parsed.data.password)) {
    return { errors: { password: 'errPwnedPassword' } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${await siteUrl()}/auth/callback`,
    },
  });
  if (error) return { message: authErrorKey(error.message) };

  /*
   * No session means the provider is still set to confirm by email. The
   * account is created confirmed all the same — a trigger stamps the
   * confirmation time as the row is written — so signing in with the password
   * just typed finishes the job rather than sending the student to their
   * inbox. Only if that genuinely fails do they get told to check their mail.
   */
  if (!data.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (signInError) return { success: true, message: 'checkEmail' };
  }

  revalidatePath('/', 'layout');
  redirect('/onboarding');
}

/**
 * The demonstration account, opened with one press.
 *
 * The credentials are read from the environment rather than written here.
 * They belong to a shared, deliberately public login — but a password typed
 * into a source file is a password in every clone, every fork and every
 * search of the repository, and "there are no credentials in this repository"
 * has to be true of the demo one too or it is not a claim worth making.
 *
 * With nothing configured the button says so rather than failing silently.
 */
export async function signInDemoAction(): Promise<AuthState> {
  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;
  if (!email || !password) return { message: 'errDemoUnavailable' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      message: 'errDemoUnavailable',
    };
  }
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function requestResetAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email.includes('@')) return { errors: { email: 'errEmail' } };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteUrl()}/auth/update-password`,
  });

  // Always the same answer, so this cannot be used to discover accounts.
  return { success: true, message: 'resetSent' };
}

export async function updatePasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get('password') ?? '');
  if (password.length < 8) return { errors: { password: 'errWeakPassword' } };
  if (await isPasswordPwned(password)) return { errors: { password: 'errPwnedPassword' } };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { message: authErrorKey(error.message) };

  return { success: true, message: 'passwordUpdated' };
}

async function siteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
