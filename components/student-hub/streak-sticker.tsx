'use client';

import { useI18n } from '@/lib/i18n/provider';
import { cx } from '@/components/ui/primitives';

/**
 * A sticker that says something true about where the student is standing.
 *
 * Not a random slogan: the tier is chosen from their own streak, and the line
 * changes with it, so it reads as somebody noticing rather than a banner that
 * says "Keep going!" to a person who has kept going for sixty days.
 *
 * Drawn rather than an emoji — an emoji is a different picture on every
 * platform, and half of them do not carry at 44px.
 */

type Tier = 'start' | 'building' | 'strong' | 'fire';

function tierFor(streak: number): Tier {
  if (streak >= 30) return 'fire';
  if (streak >= 7) return 'strong';
  if (streak >= 3) return 'building';
  return 'start';
}

/** Four tiers, four of the palette's own pairs — no colour invented here. */
const LOOK: Record<Tier, { ring: string; ink: string; glow: string }> = {
  start:    { ring: 'var(--accent)',   ink: 'var(--accent-soft-text)', glow: 'var(--bg-accent-soft)' },
  building: { ring: 'var(--positive)', ink: 'var(--positive)',         glow: 'var(--positive-soft)' },
  strong:   { ring: 'var(--warning)',  ink: 'var(--warning)',          glow: 'var(--warning-soft)' },
  fire:     { ring: 'var(--danger)',   ink: 'var(--danger)',           glow: 'var(--danger-soft)' },
};

export function StreakSticker({ streak, place }: { streak: number; place: number }) {
  const { t, tf, formatNumber } = useI18n();
  const tier = tierFor(streak);
  const look = LOOK[tier];

  const line =
    place === 1 ? t.hub.stickerLeading
      : tier === 'fire' ? t.hub.stickerFire
        : tier === 'strong' ? t.hub.stickerStrong
          : tier === 'building' ? t.hub.stickerBuilding
            : t.hub.stickerStart;

  return (
    <div
      className={cx(
        'relative flex items-center gap-3 p-3 rounded-[var(--radius-md)] border',
        'overflow-hidden',
      )}
      style={{ borderColor: look.ring, background: look.glow }}
    >
      {/* A quiet bloom behind the badge, so the sticker reads as a sticker
          rather than as one more row of the table. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -start-6 -top-8 w-28 h-28 rounded-full opacity-40"
        style={{ background: `radial-gradient(circle, ${look.ring} 0%, transparent 70%)` }}
      />

      <span className="relative shrink-0">
        <Badge tier={tier} colour={look.ring} />
      </span>

      <span className="relative min-w-0">
        <span className="block text-sm font-semibold" style={{ color: look.ink }}>
          {line}
        </span>
        <span className="block text-xs text-[var(--text-secondary)] mt-0.5">
          {streak === 1
            ? t.hub.stickerDayOne
            : tf(t.hub.stickerDays, { n: formatNumber(streak) })}
        </span>
      </span>
    </div>
  );
}

/**
 * The badge itself: a seal with a mark that grows with the tier — a single
 * spark, a rising bar, a full flame.
 */
function Badge({ tier, colour }: { tier: Tier; colour: string }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" role="presentation" aria-hidden="true">
      {/* The scalloped seal. Twelve points is enough to read as a sticker and
          few enough to stay crisp at this size. */}
      <path
        d={seal(22, 22, 19, 16.5, 12)}
        fill="var(--bg-surface)"
        stroke={colour}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {tier === 'start' ? (
        <path d="M22 13 l2.2 5.4 5.8.5-4.4 3.8 1.3 5.7L22 25.4l-4.9 3 1.3-5.7-4.4-3.8 5.8-.5Z"
          fill={colour} />
      ) : null}
      {tier === 'building' ? (
        <g fill={colour}>
          <rect x="15" y="24" width="4" height="6" rx="1" />
          <rect x="20" y="20" width="4" height="10" rx="1" />
          <rect x="25" y="16" width="4" height="14" rx="1" />
        </g>
      ) : null}
      {tier === 'strong' ? (
        <g fill="none" stroke={colour} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 22.5 l4.5 4.5 L29 17" />
        </g>
      ) : null}
      {tier === 'fire' ? (
        <path
          d="M22 12c3 4 5 6 5 9.5a5 5 0 0 1-10 0c0-2 .8-3.3 2-4.6.3 1.6 1 2.4 1.8 2.8-.6-2.6-.2-5 1.2-7.7Z"
          fill={colour}
        />
      ) : null}
    </svg>
  );
}

/** Points of a scalloped seal, alternating between two radii. */
function seal(cx: number, cy: number, outer: number, inner: number, points: number): string {
  const step = Math.PI / points;
  let d = '';
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = i * step - Math.PI / 2;
    d += `${i === 0 ? 'M' : 'L'}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)} `;
  }
  return `${d}Z`;
}
