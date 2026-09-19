'use client';

import { useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Button, Card, CardHeader } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { Icon } from '@/components/shell/icons';
import type { WrappedData } from '@/lib/momentum/queries';

/**
 * A screenshot-shaped recap of the term.
 *
 * Drawn as pure SVG — no foreignObject — so it serialises into a canvas and
 * exports as a PNG without a rasterising dependency. Every figure on it comes
 * from the student's own records.
 */
export function WrappedCard({ data }: { data: WrappedData }) {
  const { t, formatNumber } = useI18n();
  const toast = useToast();
  const svgRef = useRef<SVGSVGElement>(null);
  const [saving, setSaving] = useState(false);

  const hasSomething =
    data.totalXp > 0 || data.tasksCompleted > 0 || data.questionsAnswered > 0;

  async function saveAsImage() {
    const svg = svgRef.current;
    if (!svg) return;
    setSaving(true);
    try {
      const serialised = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([serialised], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('render failed'));
        img.src = url;
      });

      // Export at 2x so it stays crisp when shared.
      const canvas = document.createElement('canvas');
      canvas.width = W * 2;
      canvas.height = H * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no canvas context');
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, W, H);
      URL.revokeObjectURL(url);

      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!png) throw new Error('encode failed');

      const href = URL.createObjectURL(png);
      const a = document.createElement('a');
      a.href = href;
      a.download = `unimate-wrapped-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      toast.success(t.momentum.wrappedSaved);
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setSaving(false);
    }
  }

  if (!hasSomething) {
    return (
      <Card as="section">
        <CardHeader title={t.momentum.wrapped} subtitle={t.momentum.wrappedSub} />
        <p className="text-sm text-[var(--text-secondary)]">{t.momentum.wrappedEmpty}</p>
      </Card>
    );
  }

  const stats: Array<{ label: string; value: string }> = [
    { label: t.momentum.wrappedStreak, value: formatNumber(data.longestStreak) },
    { label: t.momentum.wrappedDays,   value: formatNumber(data.activeDays) },
    { label: t.momentum.wrappedFocus,  value: formatNumber(data.focusHours) },
    { label: t.momentum.tasksDone,     value: formatNumber(data.tasksCompleted) },
    { label: t.momentum.questionsAnswered, value: formatNumber(data.questionsAnswered) },
    { label: t.momentum.wrappedBadges, value: formatNumber(data.achievementCount) },
  ];

  return (
    <Card as="section">
      <CardHeader
        title={t.momentum.wrapped}
        subtitle={t.momentum.wrappedSub}
        action={
          <Button size="sm" variant="secondary" onClick={saveAsImage} loading={saving}>
            <Icon.share size={15} />
            <span className="hidden sm:inline">{t.momentum.wrappedShare}</span>
          </Button>
        }
      />

      <div className="overflow-x-auto">
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ maxWidth: W, height: 'auto', borderRadius: 18, display: 'block', margin: '0 auto' }}
          role="img"
          aria-label={`${t.momentum.wrapped}: ${stats.map((s) => `${s.label} ${s.value}`).join(', ')}`}
        >
          <defs>
            <linearGradient id="wrap-bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3d2fae" />
              <stop offset="55%" stopColor="#2f2489" />
              <stop offset="100%" stopColor="#1a1450" />
            </linearGradient>
            <linearGradient id="wrap-accent" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#e8b463" />
              <stop offset="100%" stopColor="#d99b33" />
            </linearGradient>
          </defs>

          <rect width={W} height={H} rx="18" fill="url(#wrap-bg)" />
          {/* Soft orbs for depth, clipped by the card's own rounding. */}
          <circle cx={W - 60} cy="70" r="150" fill="#6354e8" opacity="0.22" />
          <circle cx="40" cy={H - 40} r="120" fill="#e8b463" opacity="0.1" />

          {/* Header */}
          <text x="40" y="58" fill="#ffffff" fontSize="15" fontWeight="600" letterSpacing="2.5"
                fontFamily="Inter, system-ui, sans-serif" opacity="0.75">
            UNIMATE
          </text>
          <text x="40" y="104" fill="#ffffff" fontSize="36" fontWeight="600"
                fontFamily="Georgia, 'Times New Roman', serif">
            {truncate(data.studentName ?? 'My semester', 22)}
          </text>
          <text x="40" y="132" fill="#d6d2fb" fontSize="16"
                fontFamily="Inter, system-ui, sans-serif">
            {data.semester ?? ''}
          </text>

          {/* Level badge */}
          <rect x={W - 172} y="36" width="132" height="52" rx="26" fill="#ffffff" opacity="0.13" />
          <text x={W - 106} y="60" fill="#ffffff" fontSize="12" textAnchor="middle" opacity="0.8"
                fontFamily="Inter, system-ui, sans-serif" letterSpacing="1.5">
            LEVEL
          </text>
          <text x={W - 106} y="80" fill="#ffffff" fontSize="20" fontWeight="700" textAnchor="middle"
                fontFamily="Inter, system-ui, sans-serif">
            {data.level}
          </text>

          <line x1="40" y1="158" x2={W - 40} y2="158" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1" />

          {/* Stat grid: three columns, two rows */}
          {stats.map((s, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const x = 40 + col * ((W - 80) / 3);
            const y = 214 + row * 104;
            return (
              <g key={s.label}>
                <text x={x} y={y} fill="#ffffff" fontSize="40" fontWeight="700"
                      fontFamily="Inter, system-ui, sans-serif">
                  {s.value}
                </text>
                <text x={x} y={y + 24} fill="#b3abf6" fontSize="13"
                      fontFamily="Inter, system-ui, sans-serif">
                  {truncate(s.label, 20)}
                </text>
              </g>
            );
          })}

          <line x1="40" y1="408" x2={W - 40} y2="408" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1" />

          {/* Highlights */}
          {data.topCourse ? (
            <>
              <text x="40" y="444" fill="#b3abf6" fontSize="12" letterSpacing="1.2"
                    fontFamily="Inter, system-ui, sans-serif">
                {truncate(t.momentum.wrappedTop.toUpperCase(), 18)}
              </text>
              <text x="40" y="472" fill="#ffffff" fontSize="22" fontWeight="600"
                    fontFamily="Inter, system-ui, sans-serif">
                {data.topCourse.code} · {formatNumber(data.topCourse.percent)}%
              </text>
            </>
          ) : null}

          {data.strongestSubject ? (
            <>
              <text x={W / 2 + 20} y="444" fill="#b3abf6" fontSize="12" letterSpacing="1.2"
                    fontFamily="Inter, system-ui, sans-serif">
                {truncate(t.momentum.wrappedStrongest.toUpperCase(), 18)}
              </text>
              <text x={W / 2 + 20} y="472" fill="#ffffff" fontSize="22" fontWeight="600"
                    fontFamily="Inter, system-ui, sans-serif">
                {data.strongestSubject}
              </text>
            </>
          ) : null}

          {/* XP bar */}
          <rect x="40" y="508" width={W - 80} height="8" rx="4" fill="#ffffff" opacity="0.15" />
          <rect x="40" y="508" width={Math.max(24, (W - 80) * 0.72)} height="8" rx="4" fill="url(#wrap-accent)" />
          <text x="40" y="542" fill="#ffffff" fontSize="14" fontWeight="600"
                fontFamily="Inter, system-ui, sans-serif">
            {formatNumber(data.totalXp)} XP
          </text>
          <text x={W - 40} y="542" fill="#8b80f0" fontSize="13" textAnchor="end"
                fontFamily="Inter, system-ui, sans-serif">
            unimate
          </text>
        </svg>
      </div>
    </Card>
  );
}

const W = 720;
const H = 570;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
