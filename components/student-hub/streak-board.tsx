'use client';

import { useI18n } from '@/lib/i18n/provider';
import { Badge, Card, CardHeader, cx } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { Icon } from '@/components/shell/icons';
import type { LeaderboardRow } from '@/lib/momentum/leaderboard';

/**
 * Who is keeping their run going.
 *
 * A student appears here only while their streak is live, and with a name
 * only if they chose to show one — otherwise the row reads "A student". The
 * board carries a position, a name-or-not and a number of days, and that is
 * the whole of what one account can see about another.
 */
export function StreakBoard({ rows }: { rows: LeaderboardRow[] }) {
  const { t, tf, formatNumber } = useI18n();

  return (
    <Card>
      <CardHeader title={t.hub.board} subtitle={t.hub.boardSub} />

      {rows.length === 0 ? (
        <EmptyState
          title={t.hub.boardEmpty}
          body={t.hub.boardEmptyBody}
          icon={<Icon.flame size={24} />}
          compact
        />
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r) => (
            <li
              key={`${r.place}-${r.displayName ?? 'anon'}-${r.streak}`}
              className={cx(
                'flex items-center gap-3 p-2.5 rounded-[var(--radius-md)] border transition-colors',
                r.isMe
                  ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)]'
                  : 'border-transparent hover:bg-[var(--bg-inset)]',
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  'shrink-0 w-7 h-7 grid place-items-center rounded-full text-xs font-semibold tabular-nums',
                  r.place === 1
                    ? 'bg-[var(--warning-soft)] text-[var(--warning)] border border-[var(--warning-border)]'
                    : 'bg-[var(--bg-inset)] text-[var(--text-secondary)]',
                )}
              >
                {formatNumber(r.place)}
              </span>

              <span className="min-w-0 flex-1 text-sm truncate">
                {r.displayName ?? t.hub.boardAnon}
                {r.isMe ? (
                  <Badge tone="accent" className="ms-2">{t.hub.boardYou}</Badge>
                ) : null}
              </span>

              <span className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium tabular-nums">
                <Icon.flame size={14} className="text-[var(--warning)]" />
                {r.streak === 1 ? t.hub.boardDay : tf(t.hub.boardDays, { n: formatNumber(r.streak) })}
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="text-xs text-[var(--text-muted)] mt-3.5 leading-relaxed">{t.hub.boardPrivacy}</p>
    </Card>
  );
}
