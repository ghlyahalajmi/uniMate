'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Card, CardHeader, cx } from '@/components/ui/primitives';

interface Cell { day: string; xp: number; intensity: 0 | 1 | 2 | 3 | 4; future: boolean }

/**
 * Sixteen weeks of activity. Intensity is bucketed by XP, and the scale is
 * shown, so a dark square means a genuinely heavier day rather than an
 * arbitrary shade.
 */
export function ActivityHeatmap({ cells }: { cells: Cell[] }) {
  const { t, formatDate, formatNumber } = useI18n();
  const [hovered, setHovered] = useState<Cell | null>(null);

  const weeks: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const anyActivity = cells.some((c) => c.xp > 0);

  const shade = (intensity: number) => {
    if (intensity === 0) return 'var(--bg-inset)';
    const steps = ['', '22%', '45%', '70%', '100%'];
    return `color-mix(in srgb, var(--accent) ${steps[intensity]}, var(--bg-inset))`;
  };

  return (
    <Card as="section">
      <CardHeader title={t.momentum.heatmap} />

      {!anyActivity ? (
        <p className="text-sm text-[var(--text-secondary)]">{t.momentum.heatmapEmpty}</p>
      ) : (
        <>
          <div className="overflow-x-auto -mx-1 px-1 pb-1">
            {/* Columns are weeks; RTL flips reading order, which is correct
                here because time should still run toward the reading edge. */}
            <div className="flex gap-[3px] min-w-max">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {week.map((cell) => (
                    <button
                      key={cell.day}
                      type="button"
                      disabled={cell.future}
                      onMouseEnter={() => setHovered(cell)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(cell)}
                      onBlur={() => setHovered(null)}
                      aria-label={`${formatDate(cell.day)}: ${formatNumber(cell.xp)} XP`}
                      className={cx(
                        'w-[13px] h-[13px] rounded-[3px] transition-transform',
                        !cell.future && 'hover:scale-125 focus-visible:scale-125',
                        cell.future && 'opacity-25',
                      )}
                      style={{ background: shade(cell.intensity) }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mt-3">
            <p
              className="text-xs text-[var(--text-secondary)] tabular-nums min-h-[1.25rem]"
              role="status"
              aria-live="polite"
            >
              {hovered && !hovered.future
                ? `${formatDate(hovered.day)} · ${formatNumber(hovered.xp)} XP`
                : ''}
            </p>

            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] shrink-0">
              <span>{t.momentum.heatmapLess}</span>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className="w-[11px] h-[11px] rounded-[3px]"
                  style={{ background: shade(i) }}
                />
              ))}
              <span>{t.momentum.heatmapMore}</span>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
