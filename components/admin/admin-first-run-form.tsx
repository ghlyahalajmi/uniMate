'use client';

import { useActionState } from 'react';
import { adminBootstrap, type AdminState } from '@/lib/admin/actions';
import { AdminShell, AdminField, AdminSubmit, AdminError } from './admin-ui';

const EMPTY: AdminState = {};

const MESSAGES: Record<string, string> = {
  badUsername: 'Use 3–32 characters: lowercase letters, digits, dot, dash or underscore.',
  shortPassword: 'Use at least 10 characters.',
  mismatch: 'The two passwords do not match.',
  pwned: 'That password has appeared in a public data breach. Choose a different one.',
  taken: 'An administrator already exists. Sign in instead.',
  signUpFailed: 'That username could not be created. Try another.',
};

/**
 * Claiming the admin side, once.
 *
 * Whoever sets this up chooses the credentials themselves, which is the whole
 * point: no password has to be generated, written down, or sent through a chat
 * window to reach the person who will use it.
 */
export function AdminFirstRunForm() {
  const [state, action, pending] = useActionState(adminBootstrap, EMPTY);

  return (
    <AdminShell
      title="Create the administrator account"
      subtitle="Nobody administers this deployment yet. Choose a username and password — this page stops working the moment an administrator exists."
    >
      <form action={action} className="space-y-4">
        <AdminField
          label="Admin username" name="username" autoComplete="username" required
          hint="Not an email, and separate from every student account."
        />
        <AdminField
          label="Password" name="password" type="password" autoComplete="new-password" required
          hint="At least 10 characters. Checked against known breached passwords."
        />
        <AdminField
          label="Confirm password" name="confirmPassword" type="password"
          autoComplete="new-password" required
        />

        {state.error ? <AdminError>{MESSAGES[state.error] ?? 'That did not work.'}</AdminError> : null}

        <AdminSubmit pending={pending}>Create administrator</AdminSubmit>
      </form>
    </AdminShell>
  );
}
