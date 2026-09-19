'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Button, Card, CardHeader } from '@/components/ui/primitives';
import { TextInput, Select } from '@/components/ui/form';
import { Icon } from '@/components/shell/icons';
import { manualGpa, pointsNeededForTargetGpa, type GpaResult, type ManualGpaRow } from '@/lib/calculations/gpa';

let nextId = 0;
function blankRow(): ManualGpaRow {
  nextId += 1;
  return { id: `row-${nextId}`, courseName: '', credits: 3, letter: '' };
}

/**
 * Standalone GPA calculator. Works against the student's own grading scale,
 * so a university that does not use a 4.0 mapping still gets correct answers.
 */
export function GpaCalculator({
  scale, cumulative,
}: {
  scale: Array<{ letter: string; min_percent: number; points: number }>;
  cumulative: GpaResult;
}) {
  const { t, formatNumber } = useI18n();
  const [rows, setRows] = useState<ManualGpaRow[]>(() => [blankRow(), blankRow(), blankRow()]);
  const [targetGpa, setTargetGpa] = useState('3.50');

  const result = useMemo(() => manualGpa(rows.filter((r) => r.letter), scale), [rows, scale]);

  const combinedCredits = cumulative.gradedCredits + result.gradedCredits;
  const combinedPoints = cumulative.qualityPoints + result.qualityPoints;
  const combinedGpa = combinedCredits > 0
    ? Math.round((combinedPoints / combinedCredits) * 100) / 100
    : null;

  const plannedCredits = rows.reduce((s, r) => s + (Number(r.credits) || 0), 0);
  const needed = pointsNeededForTargetGpa(cumulative, plannedCredits, Number(targetGpa) || 0);

  function update(id: string, patch: Partial<ManualGpaRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={t.grades.calculator}
          action={
            <Button size="sm" variant="secondary" onClick={() => setRows((p) => [...p, blankRow()])}>
              <Icon.plus size={16} />
              {t.grades.addRow}
            </Button>
          }
        />

        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-12 sm:col-span-6">
                <TextInput
                  label={t.courses.name}
                  value={r.courseName}
                  onChange={(e) => update(r.id, { courseName: e.target.value })}
                  placeholder="CE301"
                />
              </div>
              <div className="col-span-5 sm:col-span-2">
                <TextInput
                  label={t.courses.creditsLabel}
                  type="number" step="0.5" min="0" max="24"
                  value={r.credits}
                  onChange={(e) => update(r.id, { credits: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-5 sm:col-span-3">
                <Select
                  label={t.grades.letter}
                  options={scale.map((s) => ({ value: s.letter, label: `${s.letter} (${s.points})` }))}
                  placeholder="—"
                  value={r.letter}
                  onChange={(e) => update(r.id, { letter: e.target.value })}
                />
              </div>
              <div className="col-span-2 sm:col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => setRows((p) => (p.length > 1 ? p.filter((x) => x.id !== r.id) : p))}
                  aria-label={`${t.common.delete} ${r.courseName || t.common.course}`}
                  className="w-10 h-[42px] grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                >
                  <Icon.trash size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title={t.grades.semesterGpaLabel} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Figure label={t.grades.semesterGpaLabel} value={result.gpa === null ? '—' : formatNumber(result.gpa, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} emphasis />
          <Figure label={t.grades.totalCredits} value={formatNumber(result.gradedCredits)} />
          <Figure label={t.grades.qualityPoints} value={formatNumber(result.qualityPoints, { maximumFractionDigits: 2 })} />
          <Figure
            label={t.grades.cumulativeGpaLabel}
            value={combinedGpa === null ? '—' : formatNumber(combinedGpa, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          />
        </div>

        {/* Row-by-row working, so the number is checkable. */}
        {result.rows.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t.grades.calculator}</caption>
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th scope="col" className="text-start py-2 pe-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t.common.course}</th>
                  <th scope="col" className="text-end py-2 pe-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t.courses.creditsLabel}</th>
                  <th scope="col" className="text-end py-2 pe-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t.grades.letter}</th>
                  <th scope="col" className="text-end py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t.grades.points}</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.courseId} className="border-b border-[var(--border-subtle)] last:border-0">
                    <td className="py-2 pe-3">{r.courseName || '—'}</td>
                    <td className="py-2 pe-3 text-end tabular-nums">{formatNumber(r.credits)}</td>
                    <td className="py-2 pe-3 text-end tabular-nums">{r.letter ?? '—'}</td>
                    <td className="py-2 text-end tabular-nums">{r.qualityPoints === null ? '—' : formatNumber(r.qualityPoints, { maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader title={t.onboarding.targetGpa} />
        <div className="grid sm:grid-cols-2 gap-4 items-end">
          <TextInput
            label={t.onboarding.targetGpa}
            type="number" step="0.01" min="0" max="5"
            value={targetGpa}
            onChange={(e) => setTargetGpa(e.target.value)}
          />
          <div className="rounded-[var(--radius-md)] bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] p-3">
            {needed === null ? (
              <p className="text-sm text-[var(--text-secondary)]">{t.grades.nothingLeft}</p>
            ) : needed > Math.max(...scale.map((s) => s.points)) ? (
              <p className="text-sm text-[var(--danger)]">{t.grades.impossible}</p>
            ) : needed <= 0 ? (
              <p className="text-sm text-[var(--positive)]">{t.grades.achieved}</p>
            ) : (
              <>
                <p className="font-display text-2xl font-semibold tabular-nums">
                  {formatNumber(needed, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {t.grades.points} · {formatNumber(plannedCredits)} {t.common.credits}
                </p>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Figure({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] p-3">
      <p
        className="font-display text-2xl font-semibold tabular-nums leading-none"
        style={emphasis ? { color: 'var(--accent)' } : undefined}
      >
        {value}
      </p>
      <p className="text-[0.6875rem] text-[var(--text-muted)] mt-1.5 leading-tight">{label}</p>
    </div>
  );
}
