'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n/provider';
import { Button, Card, cx } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import { GradeTargetPanel } from './grade-target-panel';
import { AssessmentFormModal } from './assessment-table';
import { GradeScaleEditor } from './grade-scale-editor';
import { GpaCalculator } from './gpa-calculator';
import type { CourseGradeBreakdown } from '@/lib/calculations/grades';
import type { GpaResult } from '@/lib/calculations/gpa';

interface CourseCard {
  id: string; code: string; name: string; targetGrade: string | null;
  breakdown: CourseGradeBreakdown;
  target: {
    verdict: string; targetLetter: string | null; targetPercent: number | null;
    requiredAveragePercent: number | null; assumptions: string[];
  };
  bestReachable: string | null;
}

type Tab = 'need' | 'calculator' | 'scale';

export function GradesView({
  courseCards, cumulative, semester, scale, courseOptions, targetGpa,
}: {
  courseCards: CourseCard[];
  cumulative: GpaResult;
  semester: GpaResult;
  scale: Array<{ letter: string; min_percent: number; points: number }>;
  courseOptions: Array<{ value: string; label: string }>;
  targetGpa: number | null;
}) {
  const { t, formatNumber } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('need');
  const [addOpen, setAddOpen] = useState(false);

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'need', label: t.grades.whatDoINeed },
    { key: 'calculator', label: t.grades.calculator },
    { key: 'scale', label: t.grades.gradeScale },
  ];

  return (
    <>
      <PageHeader
        title={t.grades.title}
        subtitle={t.grades.subtitle}
        action={
          <Button onClick={() => setAddOpen(true)} disabled={courseOptions.length === 0}>
            <Icon.plus size={17} />
            <span className="hidden sm:inline">{t.courseDetail.addAssessment}</span>
          </Button>
        }
      />

      {/* GPA summary ------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat
          label={t.grades.cumulativeGpaLabel}
          value={cumulative.gpa === null ? '—' : formatNumber(cumulative.gpa, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        />
        <Stat
          label={t.grades.semesterGpaLabel}
          value={semester.gpa === null ? '—' : formatNumber(semester.gpa, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          note={t.grades.projectedNote}
        />
        <Stat label={t.grades.totalCredits} value={formatNumber(cumulative.gradedCredits)} />
        <Stat label={t.grades.qualityPoints} value={formatNumber(cumulative.qualityPoints, { maximumFractionDigits: 2 })} />
      </div>

      {targetGpa !== null && cumulative.gpa !== null ? (
        <p className="text-xs text-[var(--text-secondary)] -mt-2 mb-5">
          {t.onboarding.targetGpa}: {formatNumber(targetGpa, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      ) : null}

      <p className="text-xs text-[var(--text-muted)] mb-5">{t.grades.projectedNote}</p>

      {/* Tabs -------------------------------------------------------------- */}
      <div role="tablist" aria-label={t.grades.title} className="flex gap-1 overflow-x-auto pb-1 mb-5">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            role="tab"
            aria-selected={tab === tb.key}
            onClick={() => setTab(tb.key)}
            className={cx(
              'shrink-0 px-3.5 min-h-[38px] rounded-[var(--radius-sm)] text-[0.8125rem] font-medium transition-colors',
              tab === tb.key
                ? 'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-inset)]',
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'need' ? (
        courseCards.length === 0 ? (
          <Card>
            <EmptyState
              title={t.grades.whatDoINeed}
              body={t.grades.empty}
              action={
                <Link
                  href="/courses"
                  className="inline-flex items-center gap-2 px-4 min-h-[42px] rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--accent)] text-[var(--text-on-accent)]"
                >
                  <Icon.plus size={17} />
                  {t.courses.addCourse}
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {courseCards.map((c) => (
              <div key={c.id}>
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <Link href={`/courses/${c.id}`} className="font-display text-lg font-semibold hover:underline">
                    {c.code}
                  </Link>
                  <span className="text-sm text-[var(--text-secondary)] truncate">{c.name}</span>
                </div>
                <GradeTargetPanel
                  courseId={c.id}
                  breakdown={c.breakdown}
                  target={c.target}
                  bestReachable={c.bestReachable}
                  currentTarget={c.targetGrade}
                  scaleLetters={scale.map((s) => s.letter)}
                />
              </div>
            ))}
          </div>
        )
      ) : null}

      {tab === 'calculator' ? <GpaCalculator scale={scale} cumulative={cumulative} /> : null}

      {tab === 'scale' ? (
        <GradeScaleEditor scale={scale} onSaved={() => router.refresh()} />
      ) : null}

      <AssessmentFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => router.refresh()}
        courseOptions={courseOptions}
      />
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card padded={false} className="p-3.5">
      <p className="font-display text-2xl font-semibold tabular-nums leading-none">{value}</p>
      <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-tight">{label}</p>
      {note ? <span className="sr-only">{note}</span> : null}
    </Card>
  );
}
