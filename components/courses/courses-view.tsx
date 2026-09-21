'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, cx } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { ConfirmDialog } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import { CourseFormModal } from './course-form';
import { CourseTile } from './course-tile';
import { deleteCourse } from '@/lib/data/actions';
import { actionMessage } from '@/lib/i18n/action-messages';
import type { Course } from '@/types/database';

export interface CourseRow extends Course {
  currentPercent: number | null;
  currentLetter: string | null;
  assessmentCount: number;
  weightTotal: number;
}

export function CoursesView({ rows, openNew }: { rows: CourseRow[]; openNew: boolean }) {
  const { t, tf, formatTime, formatNumber } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(openNew);
  const [editing, setEditing] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState<CourseRow | null>(null);
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');

  const filtered = rows.filter((r) =>
    filter === 'all' ? true : filter === 'active' ? r.status === 'active' || r.status === 'planned' : r.status === 'completed',
  );

  const filters = [
    { key: 'active' as const, label: t.courses.active },
    { key: 'completed' as const, label: t.courses.completed },
    { key: 'all' as const, label: t.common.all },
  ];

  return (
    <>
      <PageHeader
        title={t.courses.title}
        subtitle={t.courses.subtitle}
        action={
          <>
            <Link
              href="/courses/from-syllabus"
              className="inline-flex items-center gap-2 px-3.5 min-h-[42px] rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-colors"
            >
              <Icon.syllabi size={17} />
              <span className="hidden sm:inline">{t.courses.addBySyllabus}</span>
            </Link>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Icon.plus size={17} />
              <span className="hidden sm:inline">{t.courses.addCourse}</span>
            </Button>
          </>
        }
      />

      <div
        role="tablist"
        aria-label={t.common.filter}
        className="inline-flex gap-1 p-1 rounded-[var(--radius-md)] bg-[var(--bg-inset)] mb-5"
      >
        {filters.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cx(
              'px-3.5 min-h-[36px] rounded-[var(--radius-sm)] text-[0.8125rem] font-medium transition-colors',
              filter === f.key
                ? 'bg-[var(--bg-surface)] shadow-[var(--shadow-card)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            title={t.courses.title}
            body={filter === 'completed' ? t.courses.emptyCompleted : t.courses.empty}
            action={
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                  <Icon.plus size={17} />
                  {t.courses.addCourse}
                </Button>
                <Link
                  href="/courses/from-syllabus"
                  className="inline-flex items-center justify-center gap-2 px-4 min-h-[42px] rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-colors"
                >
                  <Icon.syllabi size={17} />
                  {t.courses.addBySyllabus}
                </Link>
              </div>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((c) => (
            <Card as="li" key={c.id} interactive className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <CourseTile code={c.course_code} name={c.course_name} color={c.color} />
                  <div className="min-w-0">
                    <Link
                      href={`/courses/${c.id}`}
                      className="font-display text-lg font-semibold hover:underline block truncate"
                    >
                      {c.course_code}
                    </Link>
                    <p className="text-sm text-[var(--text-secondary)] truncate">{c.course_name}</p>
                  </div>
                </div>
                <div className="flex gap-0.5 shrink-0 -me-1.5 -mt-1">
                  <button
                    type="button"
                    onClick={() => { setEditing(c); setFormOpen(true); }}
                    aria-label={`${t.common.edit} ${c.course_code}`}
                    className="w-9 h-9 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
                  >
                    <Icon.edit size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(c)}
                    aria-label={`${t.common.delete} ${c.course_code}`}
                    className="w-9 h-9 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  >
                    <Icon.trash size={16} />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-3">
                <Badge tone={c.status === 'active' ? 'accent' : c.status === 'completed' ? 'positive' : 'neutral'}>
                  {t.courses[c.status]}
                </Badge>
                <Badge>{formatNumber(c.credits)} {t.common.credits}</Badge>
                {c.status === 'completed' && c.final_grade ? (
                  <Badge tone="positive">{c.final_grade}</Badge>
                ) : c.currentLetter ? (
                  <Badge tone="accent">{formatNumber(c.currentPercent)}% · {c.currentLetter}</Badge>
                ) : null}
                {c.source === 'ai' ? <Badge tone="neutral">{t.common.ai}</Badge> : null}
              </div>

              <dl className="mt-3 pt-3 border-t border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] space-y-1">
                {c.instructor ? (
                  <div className="flex gap-1.5">
                    <dt className="sr-only">{t.courses.instructor}</dt>
                    <dd className="truncate">{c.instructor}</dd>
                  </div>
                ) : null}
                <div className="flex gap-1.5">
                  <dt className="sr-only">{t.courses.daysLabel}</dt>
                  <dd>
                    {c.days.length
                      ? `${c.days.map((d) => t.weekdaysShort[d]).join(', ')}${c.start_time ? ` · ${formatTime(c.start_time)}–${formatTime(c.end_time)}` : ''}${c.room ? ` · ${c.room}` : ''}`
                      : t.courses.noSchedule}
                  </dd>
                </div>
                {c.assessmentCount > 0 && Math.abs(c.weightTotal - 100) > 0.01 ? (
                  <div className="text-[var(--warning)]">
                    {tf(t.courseDetail.weightWarning, { n: c.weightTotal })}
                  </div>
                ) : null}
              </dl>
            </Card>
          ))}
        </ul>
      )}

      <CourseFormModal
        open={formOpen}
        course={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={deleting ? tf(t.courses.deleteConfirm, { name: deleting.course_code }) : ''}
        body={t.courses.deleteBody}
        onConfirm={async () => {
          if (!deleting) return;
          const result = await deleteCourse(deleting.id);
          if (result.ok) toast.success(actionMessage(t, result.messageKey));
          else toast.error(actionMessage(t, result.messageKey));
          setDeleting(null);
          router.refresh();
        }}
      />
    </>
  );
}
