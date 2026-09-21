'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader, cx } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { Icon } from '@/components/shell/icons';
import { setBoardNameVisible } from '@/lib/momentum/board-actions';
import type { LeaderboardRow } from '@/lib/momentum/leaderboard';

/**
 * Who is keeping their run going — as a contest rather than a table.
 *
 * The top three stand on a podium, tallest in the middle, because that is the
 * shape everyone already reads as a ranking; the rest follow as a list. The
 * gap to first place is stated for anyone not on it, which is the line that
 * makes tomorrow's streak feel worth having.
 *
 * A student appears here only while their streak is live, and with a name
 * only if they chose to show one. That choice is offered on the board itself,
 * not just in Settings: it is most likely to be made while looking at the
 * thing it affects.
 */
export function StreakBoard({ rows }: { rows: LeaderboardRow[] }) {
  const { t, tf, formatNumber } = useI18n();
  const router = useRouter();
  const [saving, startTransition] = useTransition();

  const me = rows.find((r) => r.isMe) ?? null;
  const leader = rows[0] ?? null;
  const gap = me && leader ? leader.streak - me.streak : null;

  // Middle slot is first place, so the podium reads 2 · 1 · 3 like a real one.
  const podium = [rows[1] ?? null, rows[0] ?? null, rows[2] ?? null];
  const rest = rows.slice(3);

  function toggleName() {
    if (!me) return;
    startTransition(async () => {
      const res = await setBoardNameVisible(me.displayName === null);
      if (res.ok) router.refresh();
    });
  }

  return (
    <Card className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-48 rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle, var(--warning) 0%, transparent 70%)' }}
      />

      <div className="relative">
        <CardHeader title={t.hub.board} subtitle={t.hub.boardSub} />

        {rows.length === 0 ? (
          <EmptyState
            title={t.hub.boardEmpty}
            body={t.hub.boardEmptyBody}
            icon={<Icon.flame size={24} />}
            compact
          />
        ) : (
          <>
            {/* The podium ------------------------------------------------- */}
            <ol className="flex items-end justify-center gap-2 sm:gap-3 mt-1">
              {podium.map((r, i) => {
                if (!r) return null;
                const place = r.place;
                const tier = TIER[Math.min(place, 3) as 1 | 2 | 3];
                return (
                  <li
                    key={`${place}-${r.displayName ?? 'anon'}`}
                    className={cx('flex-1 min-w-0 flex flex-col items-center', HEIGHT[i])}
                  >
                    {place === 1 ? (
                      <Icon.trophy size={22} className="text-[var(--warning)] mb-1 animate-mark-node" />
                    ) : null}

                    <span className="text-xs font-medium truncate max-w-full text-center">
                      {r.displayName ?? t.hub.boardAnon}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs tabular-nums text-[var(--text-muted)] mb-1.5">
                      <Icon.flame size={11} className="text-[var(--warning)]" />
                      {formatNumber(r.streak)}
                    </span>

                    <div
                      className={cx(
                        'w-full rounded-t-[var(--radius-md)] border border-b-0 grid place-items-start justify-center pt-2',
                        tier.block,
                        r.isMe && 'ring-2 ring-[var(--accent)] ring-inset',
                      )}
                      style={{ height: BLOCK[i] }}
                    >
                      <span className={cx('font-display text-lg font-semibold tabular-nums', tier.text)}>
                        {formatNumber(place)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div aria-hidden="true" className="h-px bg-[var(--border-strong)] -mt-px" />

            {/* Everyone else ---------------------------------------------- */}
            {rest.length > 0 ? (
              <ol className="space-y-1 mt-3">
                {rest.map((r) => (
                  <li
                    key={`${r.place}-${r.displayName ?? 'anon'}`}
                    className={cx(
                      'flex items-center gap-3 px-2.5 py-2 rounded-[var(--radius-md)] border transition-colors',
                      r.isMe
                        ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)]'
                        : 'border-transparent hover:bg-[var(--bg-inset)]',
                    )}
                  >
                    <span className="shrink-0 w-6 text-xs font-semibold tabular-nums text-[var(--text-muted)]">
                      {formatNumber(r.place)}
                    </span>
                    <span className="min-w-0 flex-1 text-sm truncate">
                      {r.displayName ?? t.hub.boardAnon}
                      {r.isMe ? <Badge tone="accent" className="ms-2">{t.hub.boardYou}</Badge> : null}
                    </span>
                    <span className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium tabular-nums">
                      <Icon.flame size={14} className="text-[var(--warning)]" />
                      {r.streak === 1 ? t.hub.boardDay : tf(t.hub.boardDays, { n: formatNumber(r.streak) })}
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}

            {/* The challenge, and the name choice -------------------------- */}
            {me ? (
              <div className="mt-4 pt-3.5 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-[0.8125rem] flex-1 min-w-0">
                  {gap === null || gap < 0 ? null
                    : gap === 0 && me.place === 1 ? t.hub.boardLeading
                      : gap === 0 ? t.hub.boardTied
                        : tf(t.hub.boardBehind, { n: formatNumber(gap) })}
                </p>
                <Button size="sm" variant="secondary" onClick={toggleName} loading={saving}>
                  {me.displayName === null ? t.hub.boardShowName : t.hub.boardHideName}
                </Button>
              </div>
            ) : null}

            {me ? (
              <p className="text-xs text-[var(--text-muted)] mt-2">
                {me.displayName === null ? t.hub.boardHidden : t.hub.boardShown}
              </p>
            ) : null}
          </>
        )}

        <p className="text-xs text-[var(--text-muted)] mt-3 leading-relaxed">{t.hub.boardPrivacy}</p>
      </div>
    </Card>
  );
}

/** Gold, silver, bronze — drawn from the palette rather than literal metals. */
const TIER = {
  1: { block: 'bg-[var(--warning-soft)] border-[var(--warning-border)]', text: 'text-[var(--warning)]' },
  2: { block: 'bg-[var(--bg-inset)] border-[var(--border-subtle)]', text: 'text-[var(--text-secondary)]' },
  3: { block: 'bg-[var(--bg-surface-2)] border-[var(--border-subtle)]', text: 'text-[var(--text-muted)]' },
} as const;

/** Second, first, third — the middle column is the tall one. */
const HEIGHT = ['pt-6', 'pt-0', 'pt-9'] as const;
const BLOCK = ['3.25rem', '4.75rem', '2.5rem'] as const;
