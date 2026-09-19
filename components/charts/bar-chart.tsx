'use client';

import { useId, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';

export interface BarDatum {
  label: string;
  value: number;
  /** Optional second line under the axis label. */
  sub?: string;
}

/**
 * Horizontal bar chart. Horizontal because the categories are course codes and
 * assessment names, which do not fit as rotated tick labels on a phone.
 *
 * The axis always starts at zero — a bar whose baseline is not zero
 * misrepresents the ratio between bars, which is the whole point of the form.
 */
export function BarChart({
  data, max = 100, unit = '%', seriesVar = '--color-series-1', threshold,
}: {
  data: BarDatum[];
  max?: number;
  unit?: string;
  seriesVar?: string;
  /** Draws a reference line, e.g. a target grade. */
  threshold?: { value: number; label: string };
}) {
  const { formatNumber } = useI18n();
  const [hovered, setHovered] = useState<number | null>(null);
  const id = useId();

  const ceiling = Math.max(max, ...data.map((d) => d.value));

  return (
    <div className="space-y-2.5">
      {data.map((d, i) => {
        const pct = ceiling > 0 ? Math.max(0, Math.min(100, (d.value / ceiling) * 100)) : 0;
        const active = hovered === i;

        return (
          <div
            key={`${d.label}-${i}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
            tabIndex={0}
            role="img"
            aria-label={`${d.label}: ${formatNumber(d.value)}${unit}`}
            className="group rounded-[var(--radius-xs)]"
          >
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-[0.8125rem] font-medium truncate">
                {d.label}
                {d.sub ? (
                  <span className="text-[var(--text-muted)] font-normal"> · {d.sub}</span>
                ) : null}
              </span>
              {/* Direct label on every bar — the relief the palette gate requires. */}
              <span className="text-[0.8125rem] tabular-nums text-[var(--text-secondary)] shrink-0">
                {formatNumber(d.value)}{unit}
              </span>
            </div>

            <div className="relative h-5 rounded-[4px] bg-[var(--bg-inset)] overflow-hidden">
              <div
                className="h-full rounded-e-[4px] transition-[width,filter] duration-500 ease-out"
                style={{
                  width: `${pct}%`,
                  background: `var(${seriesVar})`,
                  filter: active ? 'brightness(1.08)' : undefined,
                }}
              />
              {threshold && ceiling > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 w-0.5 bg-[var(--text-primary)] opacity-45"
                  style={{ insetInlineStart: `${(threshold.value / ceiling) * 100}%` }}
                  title={threshold.label}
                />
              ) : null}
            </div>
          </div>
        );
      })}

      {threshold ? (
        <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] pt-1">
          <span aria-hidden="true" className="inline-block w-0.5 h-3 bg-[var(--text-primary)] opacity-45" />
          {threshold.label}
        </p>
      ) : null}
      <span id={id} className="sr-only" />
    </div>
  );
}
