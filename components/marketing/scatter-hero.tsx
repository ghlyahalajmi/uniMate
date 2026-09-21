'use client';

import { useI18n } from '@/lib/i18n/provider';
import { DashboardPreview } from './dashboard-preview';

/**
 * The one idea the landing page has to land: university life arrives
 * scattered, and UniMate gathers it.
 *
 * Seven chips — the things a semester actually throws at you — start spread
 * around the frame and drift inward, settling behind the dashboard as it
 * fades up. No video: seven absolutely-positioned spans and two keyframes,
 * which costs nothing to download and cannot buffer. It plays once on load
 * rather than looping, because a hero that keeps moving is a hero you have to
 * look away from to read the page.
 *
 * `prefers-reduced-motion` is already honoured globally — animations collapse
 * to near-zero duration there, so the chips simply appear in place and the
 * dashboard is on screen immediately.
 */
export function ScatterHero() {
  const { t } = useI18n();

  const chips = [
    { label: t.nav.courses,    x: '4%',  y: '10%', delay: 0 },
    { label: t.tasks.title,    x: '78%', y: '4%',  delay: 0.1 },
    { label: t.calendar.title, x: '88%', y: '38%', delay: 0.2 },
    { label: t.grades.myGpa,   x: '0%',  y: '52%', delay: 0.15 },
    { label: t.nav.calendar,   x: '14%', y: '82%', delay: 0.3 },
    { label: t.notes.title,    x: '82%', y: '76%', delay: 0.25 },
    { label: t.study.title,    x: '46%', y: '92%', delay: 0.35 },
  ];

  return (
    <div className="relative">
      {/*
        Decorative only: the same words are already in the navigation and the
        feature list below, so a screen reader gains nothing from seven
        floating labels and loses the thread of the page.
      */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        {chips.map((c) => (
          <span
            key={c.label}
            className="absolute hidden sm:inline-flex items-center px-3 py-1.5 rounded-full
                       text-xs font-medium whitespace-nowrap
                       bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                       text-[var(--text-secondary)] shadow-[var(--shadow-card)]
                       animate-gather"
            style={{
              insetInlineStart: c.x,
              top: c.y,
              // Each chip carries how far it has to travel, so one keyframe
              // serves all seven and they converge rather than sliding as a
              // block.
              ['--gather-x' as string]: `calc(${pull(c.x)} * 1px)`,
              ['--gather-y' as string]: `calc(${pull(c.y)} * 1px)`,
              animationDelay: `${c.delay}s`,
            }}
          >
            {c.label}
          </span>
        ))}
      </div>

      <div className="animate-settle">
        <DashboardPreview />
      </div>
    </div>
  );
}

/**
 * How far a chip starts from where it ends, in pixels.
 *
 * A chip at 4% is near the left edge and must travel right; one at 88% travels
 * left. The result is a signed offset applied as the animation's starting
 * translate, so every chip moves toward the middle.
 */
function pull(percent: string): number {
  const value = Number.parseFloat(percent);
  if (!Number.isFinite(value)) return 0;
  // -1 at the far edge, 0 in the middle, +1 at the other edge; scaled to a
  // travel distance that reads as drift rather than a swoop.
  return ((50 - value) / 50) * -90;
}
