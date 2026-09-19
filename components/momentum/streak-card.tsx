'use client';

import { useI18n } from '@/lib/i18n/provider';
import { Card, cx } from '@/components/ui/primitives';
import { Icon } from '@/components/shell/icons';
import type { LevelInfo, StreakInfo } from '@/lib/momentum/engine';

/**
 * The headline: a level ring wrapped around the streak count.
 *
 * The ring is real progress toward the next level, not decoration — its sweep
 * is `level.progress`, and the number inside is the streak the records
 * actually support.
 */
export function StreakCard({
  streak, level, xpToday, dailyCap, compact,
}: {
  streak: StreakInfo;
  level: LevelInfo;
  xpToday: number;
  dailyCap: number;
  compact?: boolean;
}) {
  const { t, tf, formatNumber } = useI18n();

  const size = compact ? 108 : 148;
  const stroke = compact ? 8 : 11;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const swept = circumference * Math.min(1, Math.max(0, level.progress));

  const lit = streak.current > 0;
  const levelTitle = (t.momentum as unknown as Record<string, string>)[level.titleKey] ?? '';

  return (
    <Card className={cx('relative overflow-hidden', compact && 'p-4')}>
      {/* A warm wash behind a live streak, cool when it has lapsed. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-0 opacity-60"
        style={{
          background: lit
            ? 'radial-gradient(70% 70% at 22% 10%, var(--warning-soft) 0%, transparent 65%)'
            : 'radial-gradient(70% 70% at 22% 10%, var(--bg-inset) 0%, transparent 65%)',
        }}
      />

      <div className="relative flex items-center gap-5">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
            <circle
              cx={size / 2} cy={size / 2} r={r}
              fill="none" stroke="var(--bg-inset)" strokeWidth={stroke}
            />
            <circle
              cx={size / 2} cy={size / 2} r={r}
              fill="none"
              stroke="url(#momentum-ring)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${swept} ${circumference}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
            />
            <defs>
              <linearGradient id="momentum-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--warning)" />
              </linearGradient>
            </defs>
          </svg>

          <div className="absolute inset-0 grid place-content-center text-center">
            <Icon.flame
              size={compact ? 18 : 22}
              className={cx('mx-auto', lit ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]')}
            />
            <span
              className="font-display font-semibold tabular-nums leading-none mt-1"
              style={{ fontSize: compact ? '1.75rem' : '2.5rem' }}
            >
              {formatNumber(streak.current)}
            </span>
            <span className="text-xs text-[var(--text-muted)] mt-0.5">{t.momentum.streak}</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold leading-tight">
            {t.momentum.level} {level.level}
            {levelTitle ? <span className="text-[var(--text-secondary)] font-normal"> · {levelTitle}</span> : null}
          </p>

          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {level.xpForNextLevel > 0
              ? tf(t.momentum.toNextLevel, {
                  n: formatNumber(level.xpForNextLevel - level.xpIntoLevel),
                  level: level.level + 1,
                })
              : t.momentum.maxLevel}
          </p>

          <dl className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-sm">
            <div className="flex items-baseline gap-1.5">
              <dt className="text-[var(--text-muted)] text-xs">{t.momentum.xpTotal}</dt>
              <dd className="tabular-nums font-medium">{formatNumber(level.totalXp)}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-[var(--text-muted)] text-xs">{t.momentum.longest}</dt>
              <dd className="tabular-nums font-medium">{formatNumber(streak.longest)}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-[var(--text-muted)] text-xs">{t.momentum.xpToday}</dt>
              <dd className="tabular-nums font-medium">
                {formatNumber(xpToday)}
                <span className="text-[var(--text-muted)] font-normal"> / {formatNumber(dailyCap)}</span>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* One honest line about where the streak stands. */}
      <div className="relative mt-4 pt-4 border-t border-[var(--border-subtle)]">
        {streak.atRisk ? (
          <div className="flex items-start gap-2.5">
            <Icon.alert size={17} className="text-[var(--warning)] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">{t.momentum.atRiskTitle}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t.momentum.atRiskBody}</p>
            </div>
          </div>
        ) : streak.activeToday ? (
          <p className="text-sm flex items-center gap-2 text-[var(--positive)]">
            <Icon.check size={17} />
            {t.momentum.activeToday}
          </p>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">{t.momentum.startToday}</p>
        )}
      </div>
    </Card>
  );
}
