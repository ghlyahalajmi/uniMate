'use client';

import { useId, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader, cx } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { TextInput, Select } from '@/components/ui/form';
import { Icon } from '@/components/shell/icons';
import { manualGpa, pointsNeededForTargetGpa, type GpaResult, type ManualGpaRow } from '@/lib/calculations/gpa';

let nextId = 0;
function blankRow(): ManualGpaRow {
  nextId += 1;
  return { id: `row-${nextId}`, courseName: '', credits: 3, letter: '' };
}

/**
 * MY GPA — add your courses, then submit.
 *
 * The figures deliberately do not update as you type. A number that moves
 * while you are still entering the row it depends on invites you to read it
 * before it means anything; submitting is the moment the student says "these
 * are my courses", and only then does a result appear. `submitted` holds the
 * rows as they were at that moment, so editing afterwards cannot silently
 * change a figure already on screen — the result is marked stale instead.
 *
 * The arithmetic itself stays in lib/calculations/gpa.ts, against the
 * student's own grading scale.
 */
export function GpaCalculator({
  scale, cumulative,
}: {
  scale: Array<{ letter: string; min_percent: number; points: number }>;
  cumulative: GpaResult;
}) {
  const { t, tf, formatNumber } = useI18n();
  const headingId = useId();

  const [rows, setRows] = useState<ManualGpaRow[]>([]);
  const [draft, setDraft] = useState<ManualGpaRow | null>(() => blankRow());
  const [submitted, setSubmitted] = useState<ManualGpaRow[] | null>(null);
  const [showWorking, setShowWorking] = useState(false);
  const [targetGpa, setTargetGpa] = useState('3.50');

  const graded = useMemo(() => (submitted ?? []).filter((r) => r.letter), [submitted]);
  const result = useMemo(() => manualGpa(graded, scale), [graded, scale]);

  // A result on screen that no longer matches the list above it is worse than
  // no result, so say so rather than quietly recomputing.
  const stale = submitted !== null && !sameRows(submitted, rows);

  const plannedCredits = rows.reduce((s, r) => s + (Number(r.credits) || 0), 0);
  const needed = pointsNeededForTargetGpa(cumulative, plannedCredits, Number(targetGpa) || 0);
  const ungraded = rows.filter((r) => !r.letter).length;

  function commitDraft() {
    if (!draft) return;
    const name = draft.courseName.trim();
    setRows((prev) => [...prev, { ...draft, courseName: name }]);
    setDraft(null);
  }

  /**
   * A row being typed still counts.
   *
   * The form used to require OK before Calculate would do anything, so a
   * student who filled the course in and pressed Calculate — the obvious
   * move — got a disabled button and no number, which reads as a calculator
   * that does not calculate. Anything complete enough to grade is folded in
   * when they press Calculate.
   */
  const pendingDraft = draft && draft.letter ? { ...draft, courseName: draft.courseName.trim() } : null;
  const rowsToCalculate = pendingDraft ? [...rows, pendingDraft] : rows;

  function calculate() {
    if (pendingDraft) {
      setRows(rowsToCalculate);
      setDraft(null);
    }
    setSubmitted(rowsToCalculate);
  }

  return (
    <div className="space-y-4">
      {/* MY GPA — the headline box ---------------------------------------- */}
      <Card className="relative overflow-hidden bg-[var(--bg-accent-soft)] border-[var(--border-subtle)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -end-16 w-44 h-44 rounded-full opacity-40"
          style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }}
        />
        <div className="relative">
          <h2
            id={headingId}
            className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-soft-text)]"
          >
            {t.grades.myGpa}
          </h2>

          <div className="mt-2 grid grid-cols-2 gap-4" aria-describedby={headingId}>
            <Readout
              label={t.grades.calculatedGpa}
              value={
                submitted === null || result.gpa === null
                  ? '—'
                  : formatNumber(result.gpa, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              }
              emphasis
            />
            <Readout
              label={t.grades.calculatedCredits}
              value={submitted === null ? '—' : formatNumber(result.gradedCredits)}
            />
          </div>

          {submitted !== null && stale ? (
            <p className="text-xs text-[var(--warning)] mt-3">{t.grades.recalculate}</p>
          ) : null}
          {submitted === null ? (
            <p className="text-xs text-[var(--text-secondary)] mt-3">{t.grades.myGpaSub}</p>
          ) : null}
        </div>
      </Card>

      {/* The courses ------------------------------------------------------ */}
      <Card>
        <CardHeader
          title={t.grades.courseList}
          action={
            draft === null ? (
              <Button size="sm" variant="secondary" onClick={() => setDraft(blankRow())}>
                <Icon.plus size={16} />
                {t.grades.addCourse}
              </Button>
            ) : undefined
          }
        />

        {rows.length === 0 && draft === null ? (
          <EmptyState
            title={t.grades.noCoursesYet}
            body={t.grades.noCoursesYetBody}
            icon={<Icon.grades size={24} />}
            compact
            action={
              <Button onClick={() => setDraft(blankRow())}>
                <Icon.plus size={16} />
                {t.grades.addCourse}
              </Button>
            }
          />
        ) : null}

        {rows.length > 0 ? (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {rows.map((r) => (
              <li key={r.id} className="py-2.5 flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">
                    {r.courseName || t.syllabusImport.untitled}
                  </span>
                  <span className="block text-xs text-[var(--text-muted)]">
                    {formatNumber(Number(r.credits) || 0)} {t.common.credits}
                  </span>
                </span>
                {r.letter ? (
                  <Badge tone="accent">{r.letter}</Badge>
                ) : (
                  <Badge tone="warning">{t.common.notSet}</Badge>
                )}
                <button
                  type="button"
                  onClick={() => setRows((p) => p.filter((x) => x.id !== r.id))}
                  aria-label={tf(t.grades.removeCourse, { name: r.courseName || t.syllabusImport.untitled })}
                  className="shrink-0 w-8 h-8 grid place-items-center rounded-[var(--radius-sm)]
                             text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]
                             transition-colors"
                >
                  <span aria-hidden="true" className="text-base leading-none">×</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {/* The row being added, with its own OK and Cancel. ---------------- */}
        {draft !== null ? (
          <div
            className={cx(
              'mt-3 p-3 rounded-[var(--radius-md)] border border-[var(--accent)]',
              'bg-[var(--bg-accent-soft)] animate-fade-up',
            )}
          >
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-12 sm:col-span-6">
                <TextInput
                  label={t.courses.name}
                  value={draft.courseName}
                  onChange={(e) => setDraft({ ...draft, courseName: e.target.value })}
                  placeholder="CE301"
                  autoFocus
                />
              </div>
              <div className="col-span-5 sm:col-span-2">
                <TextInput
                  label={t.courses.creditsLabel}
                  type="number" step="0.5" min="0" max="24"
                  value={draft.credits}
                  onChange={(e) => setDraft({ ...draft, credits: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-7 sm:col-span-4">
                <Select
                  label={t.grades.letter}
                  options={scale.map((s) => ({ value: s.letter, label: `${s.letter} (${s.points})` }))}
                  placeholder="—"
                  value={draft.letter}
                  onChange={(e) => setDraft({ ...draft, letter: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-3">
              <Button size="sm" variant="secondary" onClick={() => setDraft(null)}>
                {t.common.cancel}
              </Button>
              {/* A course with no grade contributes nothing and lands in the
                  list as "Not set", so OK waits for one. */}
              <Button size="sm" onClick={commitDraft} disabled={!draft.letter}>
                {t.grades.ok}
              </Button>
            </div>
          </div>
        ) : null}

        {/* Submit ---------------------------------------------------------- */}
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
          {ungraded > 0 ? (
            <p className="text-xs text-[var(--text-muted)] mb-2">{t.grades.needGradeFirst}</p>
          ) : null}
          <Button
            fullWidth size="lg"
            onClick={calculate}
            disabled={rowsToCalculate.length === 0 || ungraded > 0}
          >
            {t.grades.submit}
          </Button>
        </div>
      </Card>

      {/* The working, so the number is checkable. ------------------------- */}
      {submitted !== null && result.rows.length > 0 ? (
        <Card>
          <CardHeader
            title={t.grades.calculator}
            action={
              <Button size="sm" variant="ghost" onClick={() => setShowWorking((v) => !v)} aria-expanded={showWorking}>
                {showWorking ? t.grades.hideWorking : t.grades.showWorking}
                <Icon.chevronDown size={14} className={cx('transition-transform', showWorking && 'rotate-180')} />
              </Button>
            }
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Figure label={t.grades.qualityPoints} value={formatNumber(result.qualityPoints, { maximumFractionDigits: 2 })} />
            <Figure label={t.grades.totalCredits} value={formatNumber(result.gradedCredits)} />
            <Figure
              label={t.grades.cumulativeGpaLabel}
              value={(() => {
                const credits = cumulative.gradedCredits + result.gradedCredits;
                if (credits <= 0) return '—';
                const gpa = (cumulative.qualityPoints + result.qualityPoints) / credits;
                return formatNumber(Math.round(gpa * 100) / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              })()}
            />
          </div>

          {showWorking ? (
            <div className="mt-4 overflow-x-auto animate-fade-up">
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
      ) : null}

      {/* Target GPA — unchanged behaviour, kept where it was. ------------- */}
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

/** The two headline figures: big, quiet label underneath. */
function Readout({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <p
        className="font-display text-4xl sm:text-5xl font-semibold tabular-nums leading-none"
        style={emphasis ? { color: 'var(--accent-soft-text)' } : undefined}
      >
        {value}
      </p>
      <p className="text-xs text-[var(--text-secondary)] mt-2 leading-tight">{label}:</p>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] p-3">
      <p className="font-display text-2xl font-semibold tabular-nums leading-none">{value}</p>
      <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-tight">{label}</p>
    </div>
  );
}

/** Whether the submitted snapshot still matches what is on screen. */
function sameRows(a: ManualGpaRow[], b: ManualGpaRow[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((row, i) =>
    row.id === b[i].id
    && row.courseName === b[i].courseName
    && Number(row.credits) === Number(b[i].credits)
    && row.letter === b[i].letter);
}
