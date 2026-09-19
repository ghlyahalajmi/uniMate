'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';

export interface LinePoint { label: string; value: number; sub?: string }

/**
 * Single-series line chart with a crosshair and tooltip.
 *
 * The y-axis starts at zero. A score chart with a cropped baseline makes a
 * three-point difference look like a collapse, which is exactly the
 * misreading this product cannot afford.
 */
export function LineChart({
  data, max = 100, unit = '%', seriesVar = '--color-series-1', height = 200,
}: {
  data: LinePoint[];
  max?: number;
  unit?: string;
  seriesVar?: string;
  height?: number;
}) {
  const { formatNumber } = useI18n();
  const [active, setActive] = useState<number | null>(null);

  const W = 640;
  const H = height;
  const PAD = { top: 12, right: 14, bottom: 26, left: 38 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const ceiling = Math.max(max, ...data.map((d) => d.value)) || 1;

  const points = useMemo(
    () =>
      data.map((d, i) => ({
        ...d,
        x: PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW),
        y: PAD.top + plotH - (d.value / ceiling) * plotH,
      })),
    [data, ceiling, plotW, plotH, PAD.left, PAD.top],
  );

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${path} L${points[points.length - 1]?.x.toFixed(1)},${PAD.top + plotH} L${points[0]?.x.toFixed(1)},${PAD.top + plotH} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    value: Math.round(ceiling * f),
    y: PAD.top + plotH - f * plotH,
  }));

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`${data.length} points, ${formatNumber(data[0]?.value ?? 0)}${unit} to ${formatNumber(data[data.length - 1]?.value ?? 0)}${unit}`}
        onMouseLeave={() => setActive(null)}
      >
        {/* Recessive grid */}
        {ticks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={PAD.left} x2={W - PAD.right} y1={tick.y} y2={tick.y}
              stroke="var(--grid-line)" strokeWidth="1"
            />
            <text
              x={PAD.left - 7} y={tick.y + 3.5}
              textAnchor="end" fontSize="10" fill="var(--text-muted)"
            >
              {tick.value}
            </text>
          </g>
        ))}

        <defs>
          <linearGradient id="unimate-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`var(${seriesVar})`} stopOpacity="0.16" />
            <stop offset="100%" stopColor={`var(${seriesVar})`} stopOpacity="0" />
          </linearGradient>
        </defs>

        {points.length > 1 ? <path d={areaPath} fill="url(#unimate-area)" /> : null}
        {points.length > 1 ? (
          <path
            d={path}
            fill="none"
            stroke={`var(${seriesVar})`}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* Crosshair on the hovered point */}
        {active !== null && points[active] ? (
          <line
            x1={points[active].x} x2={points[active].x}
            y1={PAD.top} y2={PAD.top + plotH}
            stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 3"
          />
        ) : null}

        {points.map((p, i) => (
          <g key={`${p.label}-${i}`}>
            {/* A generous invisible hit target — the visible dot is 8px. */}
            <rect
              x={p.x - Math.max(12, plotW / Math.max(data.length, 1) / 2)}
              y={PAD.top}
              width={Math.max(24, plotW / Math.max(data.length, 1))}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setActive(i)}
              style={{ cursor: 'pointer' }}
            />
            <circle
              cx={p.x} cy={p.y} r={active === i ? 5.5 : 4}
              fill={`var(${seriesVar})`}
              stroke="var(--bg-surface)"
              strokeWidth="2"
            />
          </g>
        ))}

        {/* x labels: first, last, and the hovered one, so they never collide */}
        {points.map((p, i) => {
          const show = i === 0 || i === points.length - 1 || i === active;
          if (!show) return null;
          return (
            <text
              key={`x-${i}`}
              x={p.x} y={H - 8}
              textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
              fontSize="10" fill="var(--text-muted)"
            >
              {p.label.length > 12 ? `${p.label.slice(0, 11)}…` : p.label}
            </text>
          );
        })}
      </svg>

      {active !== null && points[active] ? (
        <div
          role="status"
          className="absolute pointer-events-none px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-float)] text-xs whitespace-nowrap z-10"
          style={{
            left: `${(points[active].x / W) * 100}%`,
            top: `${(points[active].y / H) * 100}%`,
            transform: 'translate(-50%, -130%)',
          }}
        >
          <span className="font-medium">{points[active].label}</span>
          <span className="text-[var(--text-secondary)] ms-2 tabular-nums">
            {formatNumber(points[active].value)}{unit}
          </span>
          {points[active].sub ? (
            <span className="block text-[var(--text-muted)]">{points[active].sub}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
