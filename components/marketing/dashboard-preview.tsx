'use client';

import { useI18n } from '@/lib/i18n/provider';
import { cx } from '@/components/ui/primitives';

/**
 * A static, illustrative rendering of the dashboard for the landing page.
 * It is presentational only — no data, no links — and it is labelled as an
 * illustration so nobody mistakes it for a live account.
 */
export function DashboardPreview() {
  const { t, dir } = useI18n();

  const classes = [
    { time: '10:00', code: 'CE301', name: 'Digital Signal Processing', room: 'Room 204' },
    { time: '12:00', code: 'MATH201', name: 'Differential Equations', room: 'Room 301' },
  ];

  const courses = [
    { code: 'CE301', current: 86, target: 'A-', needed: 92, tone: 'accent' as const },
    { code: 'CE315', current: 85, target: 'A', needed: 96, tone: 'warning' as const },
    { code: 'MATH201', current: 67, target: 'B', needed: 84, tone: 'danger' as const },
  ];

  return (
    <figure className="m-0">
      <div
        className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-float)] overflow-hidden"
        aria-hidden="true"
      >
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 px-4 h-9 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-2)]">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--border-strong)]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--border-strong)]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--border-strong)]" />
        </div>

        <div className="p-4 sm:p-6 grid gap-4 sm:grid-cols-5">
          {/* Left column */}
          <div className="sm:col-span-3 space-y-4">
            <div>
              <p className="font-display text-xl font-semibold">
                {t.dashboard.goodAfternoon}, Sara.
              </p>
              <p className="text-[0.8125rem] text-[var(--text-secondary)] mt-0.5">
                2 {dir === 'rtl' ? 'محاضرات' : 'classes'} · 3 {dir === 'rtl' ? 'مهام' : 'tasks'}
              </p>
            </div>

            <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3.5">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
                {t.dashboard.todayClasses}
              </p>
              <ul className="space-y-2">
                {classes.map((c) => (
                  <li key={c.code} className="flex items-center gap-3 text-[0.8125rem]">
                    <span className="tabular-nums font-medium text-[var(--accent)] w-11 shrink-0">{c.time}</span>
                    <span className="font-medium shrink-0">{c.code}</span>
                    <span className="text-[var(--text-secondary)] truncate flex-1 min-w-0">{c.name}</span>
                    <span className="text-[var(--text-muted)] text-xs shrink-0 hidden sm:block">{c.room}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3.5">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
                {t.dashboard.gradeProgress}
              </p>
              <ul className="space-y-2.5">
                {courses.map((c) => (
                  <li key={c.code}>
                    <div className="flex items-baseline justify-between text-[0.8125rem] mb-1">
                      <span className="font-medium">{c.code}</span>
                      <span className="tabular-nums text-[var(--text-secondary)]">
                        {c.current}% → {c.target}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--bg-inset)] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${c.current}%`,
                          background:
                            c.tone === 'danger' ? 'var(--danger)'
                            : c.tone === 'warning' ? 'var(--warning)'
                            : 'var(--accent)',
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right column */}
          <div className="sm:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: t.dashboard.cumulativeGpa, value: '3.16' },
                { label: t.dashboard.activeCourses, value: '5' },
              ].map((s) => (
                <div key={s.label} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3">
                  <p className="font-display text-2xl font-semibold tabular-nums">{s.value}</p>
                  <p className="text-[0.6875rem] text-[var(--text-muted)] mt-0.5 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-accent-soft)] p-3.5">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--accent-soft-text)] mb-1.5">
                {t.dashboard.aiInsight}
              </p>
              <p className="text-[0.8125rem] leading-relaxed text-[var(--text-primary)]">
                {dir === 'rtl'
                  ? 'اختبار MATH201 النصفي بعد ٢٤ يوماً ويشكّل ٢٠٪ من المقرر. فكّر في مراجعة المعادلات التفاضلية من الدرجة الأولى هذا الأسبوع.'
                  : 'Your MATH201 midterm is in 24 days and carries 20% of the course. Consider reviewing first-order ODEs this week.'}
              </p>
            </div>

            <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3.5">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
                {t.dashboard.todayTasks}
              </p>
              <ul className="space-y-2 text-[0.8125rem]">
                {['Rework Quiz 1 mistakes', 'Read Chapter 4 — Z-transform', 'Practice 10 DSP questions'].map((task, i) => (
                  <li key={task} className="flex items-start gap-2">
                    <span
                      className={cx(
                        'mt-[3px] w-3.5 h-3.5 rounded-[4px] border shrink-0',
                        i === 0 ? 'border-[var(--danger)]' : 'border-[var(--border-strong)]',
                      )}
                    />
                    <span className="text-[var(--text-secondary)]">{task}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="text-xs text-[var(--text-muted)] mt-3 text-center">
        {t.common.demoData}
      </figcaption>
    </figure>
  );
}
