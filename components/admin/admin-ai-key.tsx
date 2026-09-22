'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clearAllAiKeys } from '@/lib/admin/actions';

/**
 * Where the deployment's AI key lives, and why it is not typed here.
 *
 * This panel used to take a key and write it onto every student's row. Each
 * student may read their own row, so a key shared with forty people was a key
 * forty people could take — and if one of them leaked it, nothing recorded
 * which. The box is gone rather than guarded, because there is no way to write
 * a credential into a place a browser can reach and still call it secret.
 *
 * A key for everyone belongs in the deployment's environment, where the server
 * reads it and no session can. What is left here is the count, and the one
 * action that removes rather than adds.
 */
export function AdminAiKey({ withKey, accounts }: { withKey: number; accounts: number }) {
  const router = useRouter();
  const [clearing, startClear] = useTransition();

  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-semibold mb-3">AI key</h2>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          To switch the AI features on for everyone, set <code>OPENROUTER_API_KEY</code> in the
          deployment&rsquo;s environment variables. The server reads it there and no browser can:
          a key stored against student accounts is a key every one of those students can read
          out of their own record.
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-3">
          {withKey} of {accounts} accounts still hold a key of their own.
        </p>

        {withKey > 0 ? (
          <button
            type="button"
            disabled={clearing}
            onClick={() => startClear(async () => { await clearAllAiKeys(); router.refresh(); })}
            className="mt-3 h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-sm disabled:opacity-50"
          >
            Clear all stored keys
          </button>
        ) : null}
      </div>
    </section>
  );
}
