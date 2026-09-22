'use client';

import { useActionState } from 'react';
import { adminSignIn, type AdminState } from '@/lib/admin/actions';
import { AdminShell, AdminField, AdminSubmit, AdminError } from './admin-ui';

const EMPTY: AdminState = {};

export function AdminSignInForm() {
  const [state, action, pending] = useActionState(adminSignIn, EMPTY);

  return (
    <AdminShell
      title="UniMate administration"
      subtitle="Administrator accounts are separate from student accounts. Sign in with your admin username — signing in here ends any student session in this browser."
    >
      <form action={action} className="space-y-4">
        <AdminField label="Admin username" name="username" autoComplete="username" required />
        <AdminField label="Password" name="password" type="password" autoComplete="current-password" required />

        {state.error ? (
          <AdminError>
            {state.error === 'notAdmin'
              ? 'That account is not an administrator.'
              : 'That username and password did not work.'}
          </AdminError>
        ) : null}

        <AdminSubmit pending={pending}>Sign in</AdminSubmit>
      </form>
    </AdminShell>
  );
}
