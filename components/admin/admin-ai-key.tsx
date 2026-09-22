'use client';

import { useActionState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setAiKeyForAll, clearAllAiKeys, type AdminState } from '@/lib/admin/actions';
import { AdminField, AdminSubmit, AdminError } from './admin-ui';

const EMPTY: AdminState & { applied?: number } = {};

const MESSAGES: Record<string, string> = {
  notAdmin: 'Sign in again and retry.',
  badKey: 'That does not look like a key. Paste the whole thing.',
  rejected: 'The provider did not accept that key. Check it was copied in full and has not been revoked.',
  failed: 'That did not work. Try again.',
};

/**
 * The deployment's AI key, set once for everyone.
 *
 * Students no longer paste keys — this is an administrator's job now. The key
 * is written onto each student's own row, which is what keeps it readable by
 * their session and nobody else's: not another student's, and not this screen's
 * afterwards. An administrator can set a key and clear a key. Reading one back
 * is not something any function in the schema does.
 */
export function AdminAiKey({ withKey, accounts }: { withKey: number; accounts: number }) {
  const [state, action, pending] = useActionState(setAiKeyForAll, EMPTY);
  const router = useRouter();
  const [clearing, startClear] = useTransition();

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-semibold mb-3">AI key</h2>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-1">
          One OpenRouter key, applied to every student account. Create a free one at{' '}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2"
          >
            openrouter.ai/keys
          </a>
          . It is checked against the provider before it is stored.
        </p>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          {withKey} of {accounts} accounts currently hold a key.
        </p>

        <form action={action} className="space-y-3 max-w-[420px]">
          <AdminField
            label="OpenRouter key" name="key" type="password" autoComplete="off" required
            hint="Stored on each account and never shown again — not even here."
          />

          {state.error ? <AdminError>{MESSAGES[state.error] ?? 'That did not work.'}</AdminError> : null}
          {state.ok ? (
            <p className="text-[0.8125rem] text-[var(--positive)]">
              Applied to {state.applied} account{state.applied === 1 ? '' : 's'}.
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <AdminSubmit pending={pending}>Apply to every account</AdminSubmit>
            <button
              type="button"
              disabled={clearing || withKey === 0}
              onClick={() => startClear(async () => { await clearAllAiKeys(); router.refresh(); })}
              className="h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-sm disabled:opacity-50"
            >
              Clear all keys
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
