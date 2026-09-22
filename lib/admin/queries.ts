import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * The admin side's reads.
 *
 * Every one of these goes through a SECURITY DEFINER function that checks
 * membership of `admins` for itself, so a session that is not an administrator
 * gets an empty result rather than a page it should not have reached. The
 * check is not "did the UI let you in".
 */

export interface AdminUserRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  university: string | null;
  is_demo: boolean;
  suspended: boolean;
  joined_at: string;
  last_sign_in: string | null;
  ai_key_hint: string | null;
  course_count: number;
  task_count: number;
}

/**
 * An admin account's address is derived from its username, in a domain that
 * student sign-up refuses. That refusal is what keeps the two credential sets
 * disjoint — an administrator's username can never collide with a student's
 * email, so "the same login" is not a state this system can reach.
 */
export const ADMIN_EMAIL_DOMAIN = 'admin.unimate.app';

export function adminEmailFor(username: string): string {
  return `${username.trim().toLowerCase()}@${ADMIN_EMAIL_DOMAIN}`;
}

/** True when the signed-in session belongs to an administrator. */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}

/** True once the admin side has been claimed. Readable signed out, by design. */
export async function adminExists(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_exists');
  return !error && data === true;
}

export async function listUsers(): Promise<AdminUserRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_list_users');
  if (error || !Array.isArray(data)) return [];
  return data as AdminUserRow[];
}

export async function aiSummary(): Promise<{ accounts: number; withKey: number; suspended: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_ai_summary');
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) return { accounts: 0, withKey: 0, suspended: 0 };
  return {
    accounts: Number(row.accounts ?? 0),
    withKey: Number(row.with_key ?? 0),
    suspended: Number(row.suspended ?? 0),
  };
}

/** The signed-in administrator's own username, for the header. */
export async function currentAdmin(): Promise<{ username: string } | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from('admins')
    .select('username')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  return data ? { username: String(data.username) } : null;
}
