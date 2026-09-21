'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Card, ProgressBar } from '@/components/ui/primitives';
import { Icon } from '@/components/shell/icons';

export interface CoachStripData {
  levelNumber: number;
  levelProgress: number;
  momentum: number;
  recommendationLabel: string;
  recommendationReason: string;
  recommendationMinutes: number;
  recommendationHref: string;
  milestoneCode: string | null;
  milestoneCurrent: number;
  milestoneTarget: number;
  coachKey: string;
  coachValues: Record<string, string | number>;
}

/**
 * The coaching loop, condensed for the dashboard: where the student stands,
 * what to do next, and what they are working toward — each linking through to
 * the Journey screen for the full picture.
 *
 * The written coach line is fetched after paint. Until it arrives (or if no
 * model is configured) the deterministic line from the rules is shown, so this
 * is never empty and never waits.
 */
export function CoachStrip({ data }: { data: CoachStripData }) {
  const { t, tf } = useI18n();
  const [ai, setAi] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/coach', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d?.ok && d.message) setAi(d.message); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const j = t.journey as Record<string, string>;
  const levelName = j[`l${data.levelNumber}`] ?? '';
  const coachLine = ai ?? tf(j[`msg_${data.coachKey}`] ?? '', data.coachValues);

  return (
    <Card className="p-4 mb-5">
      {/* Coach line */}
      {coachLine ? (
        <p className="text-[0.9375rem] leading-relaxed mb-4 flex items-start gap-2">
          <Icon.sparkle size={16} className="mt-1 shrink-0 text-[var(--accent)]" />
          <span>{coachLine}</span>
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {/* Level */}
        <Link href="/journey" className="block rounded-[var(--radius-md)] p-2 -m-2 hover:bg-[var(--bg-inset)]">
          <p className="text-xs text-[var(--text-muted)] mb-1">{t.journey.levelTitle}</p>
          <p className="text-sm font-semibold mb-1.5">
            {tf(t.journey.levelOf, { n: data.levelNumber })} — {levelName}
          </p>
          <ProgressBar
            value={Math.round(data.levelProgress * 100)}
            label={t.journey.levelTitle}
          />
        </Link>

        {/* Momentum */}
        <Link href="/journey" className="block rounded-[var(--radius-md)] p-2 -m-2 hover:bg-[var(--bg-inset)]">
          <p className="text-xs text-[var(--text-muted)] mb-1">{t.journey.momentumTitle}</p>
          <p className="text-sm font-semibold mb-1.5 tabular-nums">
            {data.momentum} <span className="font-normal text-[var(--text-muted)]">/ 100</span>
          </p>
          <ProgressBar value={data.momentum} label={t.journey.momentumTitle} />
        </Link>

        {/* Next milestone */}
        {data.milestoneCode ? (
          <Link href="/journey" className="block rounded-[var(--radius-md)] p-2 -m-2 hover:bg-[var(--bg-inset)]">
            <p className="text-xs text-[var(--text-muted)] mb-1">{t.journey.milestoneTitle}</p>
            <p className="text-sm font-semibold mb-1.5 line-clamp-1">
              {j[`m_${data.milestoneCode}`] ?? data.milestoneCode}
            </p>
            <ProgressBar
              value={data.milestoneCurrent}
              max={data.milestoneTarget}
              label={t.journey.milestoneTitle}
              tone="positive"
            />
          </Link>
        ) : null}
      </div>

      {/* What to do now */}
      <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
        <p className="text-xs text-[var(--text-muted)] mb-1">🎯 {t.journey.nowTitle}</p>
        <p className="text-sm font-medium mb-0.5">{data.recommendationLabel}</p>
        <p className="text-xs text-[var(--text-secondary)] mb-3">{data.recommendationReason}</p>
        <Link
          href={data.recommendationHref}
          className={
            'inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-4 min-h-[40px] ' +
            'text-sm font-medium bg-[var(--accent)] text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)]'
          }
        >
          <Icon.play size={14} /> {t.journey.startNow}
          <span className="text-xs opacity-80">
            · {tf(t.journey.minutes, { n: data.recommendationMinutes })}
          </span>
        </Link>
      </div>
    </Card>
  );
}
