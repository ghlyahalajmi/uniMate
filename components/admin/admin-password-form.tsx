'use client';

import { useActionState, useState } from 'react';
import { adminChangePassword, type AdminState } from '@/lib/admin/actions';
import { AdminField, AdminSubmit, AdminError } from './admin-ui';

const EMPTY: AdminState = {};

const MESSAGES: Record<string, string> = {
  notAdmin: 'Sign in again and retry.',
  shortPassword: 'Use at least 10 characters.',
  mismatch: 'The two new passwords do not match.',
  same: 'That is the password you already have.',
  pwned: 'That password has appeared in a public data breach. Choose a different one.',
  wrongCurrent: 'The current password is wrong.',
  failed: 'That did not work. Try again.',
};

/**
 * Changing the administrator password, from inside the admin side.
 *
 * Here because the first password often is not the one anybody chose — it gets
 * generated during setup, written down, read out. A deployment whose only
 * administrator credential can never be replaced is one where that first
 * password is permanent.
 */
export function AdminPasswordForm() {
  const [state, action, pending] = useActionState(adminChangePassword, EMPTY);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="h-9 px-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-sm hover:bg-[var(--bg-inset)]"
      >
        Change password
      </button>

      {open ? (
        <form
          action={action}
          // A panel hung off the button rather than pushed into the header row,
          // so opening it does not shove the page around.
          className="absolute end-0 top-full mt-2 z-20 w-[min(92vw,360px)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3 shadow-[var(--shadow-float)] text-start"
        >
          <p className="text-sm font-medium">Change your admin password</p>

          <AdminField label="Current password" name="currentPassword" type="password" autoComplete="current-password" required />
          <AdminField label="New password" name="password" type="password" autoComplete="new-password" required
            hint="At least 10 characters. Checked against known breached passwords." />
          <AdminField label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" required />

          {state.error ? <AdminError>{MESSAGES[state.error] ?? 'That did not work.'}</AdminError> : null}
          {state.ok ? <p className="text-[0.8125rem] text-[var(--success)]">Password changed.</p> : null}

          <div className="flex items-center gap-2">
            <AdminSubmit pending={pending}>Change password</AdminSubmit>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
