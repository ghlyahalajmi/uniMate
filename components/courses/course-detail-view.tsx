'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader, cx } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import { GradeTargetPanel } from '@/components/grades/grade-target-panel';
import { AssessmentTable } from '@/components/grades/assessment-table';
import { CourseFormModal } from './course-form';
import type { Course, Grade, Question, Syllabus, SyllabusEvent, Task } from '@/types/database';
import type { CourseGradeBreakdown } from '@/lib/calculations/grades';

type Tab = 'overview' | 'assessments' | 'syllabus' | 'questions' | 'tasks';

export function CourseDetailView({
  course, grades, tasks, syllabus, events, questions,
  breakdown, target, bestReachable, scaleLetters,
}: {
  course: Course;
  grades: Grade[];
  tasks: Task[];
  syllabus: Syllabus | null;
  events: SyllabusEvent[];
  questions: Question[];
  breakdown: CourseGradeBreakdown;
  target: {
    verdict: string; targetLetter: string | null; targetPercent: number | null;
    requiredAveragePercent: number | null; assumptions: string[];
  };
  bestReachable: string | null;
  scaleLetters: string[];
}) {
  const { t, tf, formatTime, formatDate, formatNumber } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [editOpen, setEditOpen] = useState(false);

  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = events
    .filter((e) => e.event_date && e.event_date >= todayIso)
    .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''));
  const openTasks = tasks.filter((tk) => tk.status !== 'completed');

  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: 'overview', label: t.courseDetail.overview },
    { key: 'assessments', label: t.courseDetail.assessments, count: grades.length },
    { key: 'syllabus', label: t.courseDetail.syllabus, count: events.length },
    { key: 'questions', label: t.courseDetail.questions, count: questions.length },
    { key: 'tasks', label: t.courseDetail.tasksTab, count: openTasks.length },
  ];

  return (
    <>
      <div className="mb-2">
        <Link
          href="/courses"
          className="inline-flex items-center gap-1.5 min-h-[32px] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <Icon.chevronEnd size={15} className="rotate-180 flip-rtl" />
          {t.nav.courses}
        </Link>
      </div>

      <PageHeader
        title={`${course.course_code} — ${course.course_name}`}
        subtitle={[
          course.instructor,
          `${formatNumber(course.credits)} ${t.common.credits}`,
          course.semester,
          course.room,
        ].filter(Boolean).join(' · ')}
        action={
          <>
            <Link
              href={`/study?course=${course.id}`}
              className="inline-flex items-center gap-2 px-3.5 min-h-[42px] rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
            >
              <Icon.study size={17} />
              <span className="hidden sm:inline">{t.courseDetail.practiceNow}</span>
            </Link>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Icon.edit size={16} />
              <span className="hidden sm:inline">{t.common.edit}</span>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-1.5 mb-5">
        <Badge tone={course.status === 'active' ? 'accent' : 'neutral'}>{t.courses[course.status]}</Badge>
        {course.days.length ? (
          <Badge>
            {course.days.map((d) => t.weekdaysShort[d]).join(', ')}
            {course.start_time ? ` · ${formatTime(course.start_time)}–${formatTime(course.end_time)}` : ''}
          </Badge>
        ) : null}
        {course.difficulty ? <Badge>{t.courses.difficulty} {course.difficulty}/5</Badge> : null}
        {course.is_demo ? <Badge tone="warning">{t.common.demoData}</Badge> : null}
      </div>

      {/* Tabs -------------------------------------------------------------- */}
      <div role="tablist" aria-label={t.courseDetail.overview} className="flex gap-1 overflow-x-auto pb-1 mb-5 -mx-1 px-1">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            role="tab"
            aria-selected={tab === tb.key}
            onClick={() => setTab(tb.key)}
            className={cx(
              'shrink-0 px-3.5 min-h-[38px] rounded-[var(--radius-sm)] text-[0.8125rem] font-medium transition-colors whitespace-nowrap',
              tab === tb.key
                ? 'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-inset)]',
            )}
          >
            {tb.label}
            {tb.count !== undefined && tb.count > 0 ? (
              <span className="ms-1.5 text-[var(--text-muted)] tabular-nums">{tb.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-5">
            <GradeTargetPanel
              courseId={course.id}
              breakdown={breakdown}
              target={target}
              bestReachable={bestReachable}
              currentTarget={course.target_grade}
              scaleLetters={scaleLetters}
            />

            <Card>
              <CardHeader title={t.courseDetail.deadlines} />
              {upcoming.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">{t.courseDetail.noDeadlines}</p>
              ) : (
                <ul className="space-y-3">
                  {upcoming.slice(0, 6).map((e) => (
                    <li key={e.id} className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium truncate">{e.title}</span>
                        <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                          {t.eventTypes[e.event_type]}
                          {e.weight ? ` · ${e.weight}%` : ''}
                        </span>
                      </span>
                      <span className="text-xs tabular-nums text-[var(--text-secondary)] shrink-0">
                        {formatDate(e.event_date)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader title={t.courseDetail.topics} />
              {!syllabus?.topics?.length ? (
                <p className="text-sm text-[var(--text-secondary)]">{t.courseDetail.noTopics}</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {syllabus.topics.map((topic) => (
                    <li key={topic}>
                      <Badge>{topic}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader
                title={t.courseDetail.tasksTab}
                action={
                  <Link href="/tasks" className="inline-flex items-center min-h-[32px] text-[0.8125rem] text-[var(--accent-soft-text)] hover:underline">
                    {t.common.viewAll}
                  </Link>
                }
              />
              {openTasks.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">{t.courseDetail.noTasks}</p>
              ) : (
                <ul className="space-y-2.5">
                  {openTasks.slice(0, 5).map((tk) => (
                    <li key={tk.id} className="flex items-start gap-2.5">
                      <span
                        aria-hidden="true"
                        className={cx(
                          'mt-[5px] w-2 h-2 rounded-full shrink-0',
                          tk.priority === 'high' ? 'bg-[var(--danger)]'
                          : tk.priority === 'medium' ? 'bg-[var(--warning)]'
                          : 'bg-[var(--border-strong)]',
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm leading-snug">{tk.title}</span>
                        {tk.due_date ? (
                          <span className="block text-xs text-[var(--text-muted)]">{formatDate(tk.due_date)}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'assessments' ? (
        <AssessmentTable
          courseId={course.id}
          grades={grades}
          weightTotal={breakdown.totalDefinedWeight}
          onChanged={() => router.refresh()}
        />
      ) : null}

      {tab === 'syllabus' ? (
        <div className="space-y-4">
          {!syllabus ? (
            <Card>
              <EmptyState
                title={t.courseDetail.syllabus}
                body={t.courseDetail.noSyllabus}
                action={
                  <Link
                    href={`/syllabi?course=${course.id}`}
                    className="inline-flex items-center gap-2 px-4 min-h-[42px] rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--accent)] text-[var(--text-on-accent)]"
                  >
                    <Icon.upload size={17} />
                    {t.syllabi.upload}
                  </Link>
                }
              />
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader title={syllabus.file_name ?? t.courseDetail.syllabus} subtitle={syllabus.summary ?? undefined} />
                <dl className="grid sm:grid-cols-2 gap-4 text-sm">
                  {syllabus.office_hours ? (
                    <div>
                      <dt className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{t.syllabi.officeHours}</dt>
                      <dd className="mt-1">{syllabus.office_hours}</dd>
                    </div>
                  ) : null}
                  {syllabus.required_material ? (
                    <div>
                      <dt className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{t.syllabi.material}</dt>
                      <dd className="mt-1">{syllabus.required_material}</dd>
                    </div>
                  ) : null}
                  {syllabus.policies ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{t.syllabi.policies}</dt>
                      <dd className="mt-1">{syllabus.policies}</dd>
                    </div>
                  ) : null}
                </dl>
              </Card>

              <Card>
                <CardHeader title={t.syllabi.events} />
                {events.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">{t.courseDetail.noDeadlines}</p>
                ) : (
                  <ul className="divide-y divide-[var(--border-subtle)]">
                    {events.map((e) => (
                      <li key={e.id} className="py-2.5 flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{e.title}</span>
                          <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                            {t.eventTypes[e.event_type]}{e.weight ? ` · ${e.weight}%` : ''}
                          </span>
                          {e.description ? (
                            <span className="block text-xs text-[var(--text-secondary)] mt-1">{e.description}</span>
                          ) : null}
                        </span>
                        <span className="text-xs tabular-nums text-[var(--text-secondary)] shrink-0">
                          {e.event_date ? formatDate(e.event_date) : t.common.notSet}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}
        </div>
      ) : null}

      {tab === 'questions' ? (
        <Card>
          <CardHeader
            title={t.courseDetail.questions}
            action={
              <Link
                href={`/study?course=${course.id}`}
                className="inline-flex items-center min-h-[32px] text-[0.8125rem] text-[var(--accent-soft-text)] hover:underline"
              >
                {t.courseDetail.practiceNow}
              </Link>
            }
          />
          {questions.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">{t.courseDetail.noQuestions}</p>
          ) : (
            <ul className="space-y-3">
              {questions.map((q) => (
                <li key={q.id} className="pb-3 border-b border-[var(--border-subtle)] last:border-0 last:pb-0">
                  <p className="text-sm">{q.question_text}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {q.topic ? <Badge>{q.topic}</Badge> : null}
                    <Badge tone={q.difficulty === 'hard' ? 'warning' : 'neutral'}>{t.study[q.difficulty]}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === 'tasks' ? (
        <Card>
          <CardHeader
            title={t.courseDetail.tasksTab}
            action={
              <Link href="/tasks" className="inline-flex items-center min-h-[32px] text-[0.8125rem] text-[var(--accent-soft-text)] hover:underline">
                {t.common.viewAll}
              </Link>
            }
          />
          {tasks.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">{t.courseDetail.noTasks}</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {tasks.map((tk) => (
                <li key={tk.id} className="py-2.5 flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className={cx('block text-sm', tk.status === 'completed' && 'line-through text-[var(--text-muted)]')}>
                      {tk.title}
                    </span>
                    <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                      {t.tasks[tk.priority]}
                      {tk.estimated_minutes ? ` · ${tk.estimated_minutes} ${t.common.minutes}` : ''}
                      {tk.source === 'ai' ? ` · ${t.common.ai}` : ''}
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-[var(--text-secondary)] shrink-0">
                    {tk.due_date ? formatDate(tk.due_date) : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <CourseFormModal
        open={editOpen}
        course={course}
        onClose={() => setEditOpen(false)}
        onSaved={() => router.refresh()}
      />

      {Math.abs(breakdown.totalDefinedWeight - 100) > 0.01 && grades.length > 0 ? (
        <p className="text-xs text-[var(--warning)] mt-4">
          {tf(t.courseDetail.weightWarning, { n: breakdown.totalDefinedWeight })}
        </p>
      ) : null}
    </>
  );
}
