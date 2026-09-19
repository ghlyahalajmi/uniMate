'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader, ProgressBar } from '@/components/ui/primitives';
import { Select } from '@/components/ui/form';
import { Provenance } from '@/components/ui/states';
import { setCourseTarget } from '@/lib/data/actions';
import type { CourseGradeBreakdown } from '@/lib/calculations/grades';

/**
 * "What do I need?" — the answer is on screen, with its assumptions, and it
 * comes from lib/calculations rather than from a model.
 */
export function GradeTargetPanel({
  courseId, breakdown, target, bestReachable, currentTarget, scaleLetters, compact,
}: {
  courseId: string;
  breakdown: CourseGradeBreakdown;
  target: {
    verdict: string; targetLetter: string | null; targetPercent: number | null;
    requiredAveragePercent: number | null; assumptions: string[];
  };
  bestReachable: string | null;
  currentTarget: string | null;
  scaleLetters: string[];
  compact?: boolean;
}) {
  const { t, tf, formatNumber } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(currentTarget ?? '');

  const verdictTone =
    target.verdict === 'impossible' ? 'danger'
    : target.verdict === 'already_achieved' ? 'positive'
    : target.requiredAveragePercent !== null && target.requiredAveragePercent > 90 ? 'warning'
    : 'accent';

  function changeTarget(next: string) {
    setSelected(next);
    startTransition(async () => {
      await setCourseTarget(courseId, next || null);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader
        title={t.grades.whatDoINeed}
        action={
          <div className="w-[9rem]">
            <Select
              label={t.grades.pickTarget}
              options={scaleLetters.map((l) => ({ value: l, label: l }))}
              placeholder={t.common.notSet}
              value={selected}
              onChange={(e) => changeTarget(e.target.value)}
              disabled={pending}
            />
          </div>
        }
      />

      {/* The headline figures --------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Figure
          label={t.grades.currentWeighted}
          value={breakdown.currentPercent === null ? '—' : `${formatNumber(breakdown.currentPercent)}%`}
          sub={breakdown.currentLetter ?? undefined}
        />
        <Figure
          label={t.grades.remainingWeight}
          value={`${formatNumber(breakdown.remainingWeight)}%`}
        />
        <Figure
          label={t.grades.requiredScore}
          value={
            target.requiredAveragePercent === null
              ? '—'
              : `${formatNumber(target.requiredAveragePercent)}%`
          }
          tone={verdictTone}
        />
      </div>

      <ProgressBar
        value={breakdown.earnedWeightedPoints}
        max={100}
        label={t.grades.currentWeighted}
        tone={verdictTone}
        className="mt-4"
      />
      <p className="text-xs text-[var(--text-muted)] mt-1.5 tabular-nums">
        {tf(t.grades.youHave, { points: formatNumber(breakdown.earnedWeightedPoints) })}
        {' '}
        {tf(t.grades.remainsOf, { n: formatNumber(breakdown.remainingWeight) })}
      </p>

      {/* The verdict in words --------------------------------------------- */}
      <div className="mt-4">
        {target.verdict === 'reachable' && target.targetLetter ? (
          <Provenance kind="fact" label={t.ai.factLabel}>
            {tf(t.grades.needAcross, {
              target: target.targetLetter,
              required: formatNumber(target.requiredAveragePercent),
            })}
          </Provenance>
        ) : target.verdict === 'impossible' ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-soft)] p-3.5">
            <p className="text-sm text-[var(--text-primary)]">{t.grades.impossible}</p>
            {bestReachable ? (
              <p className="text-sm text-[var(--text-secondary)] mt-1.5">
                {tf(t.grades.impossibleBest, {
                  letter: bestReachable,
                  percent: formatNumber(breakdown.maxPossiblePercent),
                })}
              </p>
            ) : null}
          </div>
        ) : target.verdict === 'already_achieved' ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--positive-border)] bg-[var(--positive-soft)] p-3.5">
            <p className="text-sm text-[var(--text-primary)]">{t.grades.achieved}</p>
          </div>
        ) : target.verdict === 'no_remaining_assessments' ? (
          <p className="text-sm text-[var(--text-secondary)]">{t.grades.nothingLeft}</p>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">{t.grades.pickTarget}</p>
        )}
      </div>

      {breakdown.unaccountedWeight > 0.01 ? (
        <p className="text-xs text-[var(--warning)] mt-3 flex items-start gap-1.5">
          <span aria-hidden="true">⚠</span>
          <span>{t.grades.missingWeights}</span>
        </p>
      ) : null}

      {/* Assumptions, always visible ---------------------------------------- */}
      {target.assumptions.length && !compact ? (
        <details className="mt-4 group">
          <summary className="text-[0.8125rem] font-medium cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)] list-none flex items-center gap-1.5">
            <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
            {t.grades.assumptions}
          </summary>
          <ul className="mt-2 space-y-1.5 ps-4">
            {target.assumptions.map((a) => (
              <li key={a} className="text-xs text-[var(--text-secondary)] list-disc">{a}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

function Figure({
  label, value, sub, tone,
}: {
  label: string; value: string; sub?: string;
  tone?: 'accent' | 'positive' | 'warning' | 'danger';
}) {
  const colour =
    tone === 'danger' ? 'var(--danger)'
    : tone === 'warning' ? 'var(--warning)'
    : tone === 'positive' ? 'var(--positive)'
    : tone === 'accent' ? 'var(--accent)'
    : 'var(--text-primary)';

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] p-3">
      <p className="font-display text-xl sm:text-2xl font-semibold tabular-nums leading-none" style={{ color: colour }}>
        {value}
      </p>
      {sub ? <p className="text-xs text-[var(--text-secondary)] mt-1">{sub}</p> : null}
      <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-tight">{label}</p>
    </div>
  );
}
