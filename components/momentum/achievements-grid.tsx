'use client';

import { useI18n } from '@/lib/i18n/provider';
import { Card, CardHeader, cx } from '@/components/ui/primitives';
import { Icon, type IconName } from '@/components/shell/icons';
import { ACHIEVEMENTS, type AchievementCode } from '@/lib/momentum/achievements';

interface Earned { code: AchievementCode; evidence: string | null; unlockedAt: string }

const TIER_STYLE = {
  bronze: { ring: 'var(--color-brass-400)', soft: 'var(--warning-soft)', text: 'var(--warning)' },
  silver: { ring: 'var(--color-ink-400)',   soft: 'var(--bg-inset)',     text: 'var(--text-secondary)' },
  gold:   { ring: 'var(--color-brass-600)', soft: 'var(--warning-soft)', text: 'var(--warning)' },
} as const;

export function AchievementsGrid({ earned }: { earned: Earned[] }) {
  const { t, tf, formatDate } = useI18n();
  const copy = t.momentum as unknown as Record<string, string>;
  const byCode = new Map(earned.map((e) => [e.code, e]));

  // Earned first, then by tier, so progress is visible at a glance.
  const tierRank = { gold: 0, silver: 1, bronze: 2 } as const;
  const ordered = [...ACHIEVEMENTS].sort((a, b) => {
    const ae = byCode.has(a.code) ? 0 : 1;
    const be = byCode.has(b.code) ? 0 : 1;
    return ae - be || tierRank[a.tier] - tierRank[b.tier];
  });

  return (
    <Card as="section">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Icon.trophy size={18} className="text-[var(--warning)]" />
            {t.momentum.achievements}
          </span>
        }
        subtitle={tf(t.momentum.achievementsSub, { earned: earned.length, total: ACHIEVEMENTS.length })}
      />

      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {ordered.map((a) => {
          const got = byCode.get(a.code);
          const style = TIER_STYLE[a.tier];
          const Glyph = Icon[a.icon as IconName] ?? Icon.trophy;

          return (
            <li
              key={a.code}
              className={cx(
                'rounded-[var(--radius-md)] border p-3 transition-colors',
                got
                  ? 'border-[var(--border-subtle)]'
                  : 'border-dashed border-[var(--border-subtle)] opacity-55',
              )}
              style={got ? { background: style.soft } : undefined}
            >
              <span
                aria-hidden="true"
                className="w-9 h-9 grid place-items-center rounded-full mb-2"
                style={{
                  background: got ? 'var(--bg-surface)' : 'var(--bg-inset)',
                  boxShadow: got ? `0 0 0 2px ${style.ring}` : undefined,
                  color: got ? style.text : 'var(--text-muted)',
                }}
              >
                {got ? <Glyph size={17} /> : <Icon.lock size={15} />}
              </span>

              <p className="text-[0.8125rem] font-medium leading-tight">
                {copy[`a_${a.code}`] ?? a.code}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1 leading-snug">
                {copy[`a_${a.code}_d`] ?? ''}
              </p>

              {got ? (
                <p className="text-xs text-[var(--text-muted)] mt-1.5">
                  {tf(t.momentum.unlockedOn, { date: formatDate(got.unlockedAt) })}
                </p>
              ) : (
                <p className="text-xs text-[var(--text-muted)] mt-1.5">{t.momentum.locked}</p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
