'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setSuspended, clearAiKeyFor, adminSignOut } from '@/lib/admin/actions';
import type { AdminUserRow } from '@/lib/admin/queries';

/**
 * The accounts screen.
 *
 * What is here is what managing accounts needs: who exists, when they joined,
 * whether they are suspended, whether they have an AI key of their own, and
 * how much they have entered. What is not here is anyone's academic content —
 * no grades, no notes, no tasks, no questions. An administrator has no more
 * right to read a student's marks than another student does, and the database
 * would not serve them if this page asked.
 */
export function AdminUsersView({
  users, summary, username,
}: {
  users: AdminUserRow[];
  summary: { accounts: number; withKey: number; suspended: number };
  username: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((u) =>
      [u.email, u.full_name, u.university].some((v) => v?.toLowerCase().includes(needle)),
    );
  }, [users, query]);

  const act = (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    start(async () => {
      await fn();
      setBusyId(null);
      router.refresh();
    });
  };

  return (
    <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
      <header className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            UniMate administration
          </p>
          <h1 className="font-display text-2xl font-semibold mt-1">Accounts</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Signed in as <span className="font-medium">{username}</span>
          </p>
        </div>
        <form action={adminSignOut}>
          <button
            type="submit"
            className="h-9 px-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-sm hover:bg-[var(--bg-inset)]"
          >
            Sign out
          </button>
        </form>
      </header>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Student accounts" value={summary.accounts} />
        <Stat label="With their own AI key" value={summary.withKey} />
        <Stat label="Suspended" value={summary.suspended} />
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, email or university"
        aria-label="Search accounts"
        className="w-full h-10 px-3 mb-4 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-inset)] text-sm outline-none focus:border-[var(--accent)]"
      />

      <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
        {shown.length === 0 ? (
          <p className="p-5 text-sm text-[var(--text-muted)]">No account matches that.</p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {shown.map((u) => (
              <li key={u.user_id} className="p-4 flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {u.full_name || u.email || 'Unnamed account'}
                    {u.is_demo ? (
                      <span className="ms-2 text-xs text-[var(--warning)]">demo</span>
                    ) : null}
                    {u.suspended ? (
                      <span className="ms-2 text-xs text-[var(--danger)]">suspended</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{u.email}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {u.university ? `${u.university} · ` : ''}
                    joined {u.joined_at.slice(0, 10)}
                    {u.last_sign_in ? ` · last seen ${u.last_sign_in.slice(0, 10)}` : ' · never signed in'}
                    {' · '}{u.course_count} courses, {u.task_count} tasks
                  </p>
                  <p className="text-xs mt-1">
                    {u.ai_key_hint
                      ? <span className="text-[var(--text-secondary)]">AI key ····{u.ai_key_hint}</span>
                      : <span className="text-[var(--text-muted)]">no AI key</span>}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {u.ai_key_hint ? (
                    <button
                      type="button"
                      disabled={pending && busyId === u.user_id}
                      onClick={() => act(u.user_id, () => clearAiKeyFor(u.user_id))}
                      className="h-9 px-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-sm hover:bg-[var(--bg-inset)] disabled:opacity-60"
                    >
                      Clear key
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={pending && busyId === u.user_id}
                    onClick={() => act(u.user_id, () => setSuspended(u.user_id, !u.suspended))}
                    className="h-9 px-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-sm hover:bg-[var(--bg-inset)] disabled:opacity-60"
                  >
                    {u.suspended ? 'Restore' : 'Suspend'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-[var(--text-muted)] mt-4 leading-relaxed">
        Account facts only. No student&rsquo;s grades, notes, tasks or answers are readable from
        here, and an AI key can be cleared but never read — not by an administrator, and not by
        anyone else.
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
      <p className="font-display text-xl font-semibold">{value}</p>
      <p className="text-xs text-[var(--text-muted)] mt-0.5">{label}</p>
    </div>
  );
}
