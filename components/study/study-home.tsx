'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Card, CardHeader, cx } from '@/components/ui/primitives';
import { AiUnavailable, EmptyState } from '@/components/ui/states';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import type { PracticeFormat } from '@/lib/study/modes';
import { StudyView, type StudyHistoryEntry } from './study-view';
import { ChapterReviewPanel, type ChapterOption } from './chapter-review-panel';
import { StudyPlansPanel, type PlanCourse, type SavedPlan } from './study-plans-panel';

type Mode = 'review' | 'practice' | 'plan';

export interface StudyCourse {
  id: string;
  code: string;
  name: string;
  chapters: ChapterOption[];
}

/**
 * Study with AI, as three things rather than one.
 *
 * The screen used to open straight into a question-set builder, which assumed
 * the student already knew that practice was what they wanted. Most of the
 * time it is not: they have a chapter they have not read, or a week they have
 * not planned. So the first question is which course, the second is what kind
 * of help, and only then does a flow begin.
 *
 * Plans are deliberately not scoped to the chosen course — a plan that covered
 * one course at a time would be a worse plan, since the point of planning is
 * deciding what gets the week.
 */
export function StudyHome({
  aiEnabled, courses, plans, initialCourseId, initialFormat, history,
}: {
  aiEnabled: boolean;
  courses: StudyCourse[];
  plans: SavedPlan[];
  initialCourseId: string;
  initialFormat: PracticeFormat;
  history: StudyHistoryEntry[];
}) {
  const { t } = useI18n();

  const [courseId, setCourseId] = useState(initialCourseId || courses[0]?.id || '');
  const [mode, setMode] = useState<Mode>('practice');
  const [chapterId, setChapterId] = useState<string | null>(null);

  const course = courses.find((c) => c.id === courseId) ?? courses[0];
  const planCourses: PlanCourse[] = courses.map((c) => ({ id: c.id, code: c.code, name: c.name }));

  const modes: Array<{ key: Mode; label: string; body: string; icon: React.ReactNode }> = [
    { key: 'review', label: t.studyAi.modeReview, body: t.studyAi.modeReviewSub, icon: <Icon.syllabi size={20} /> },
    { key: 'practice', label: t.studyAi.modePractice, body: t.studyAi.modePracticeSub, icon: <Icon.sparkle size={20} /> },
    { key: 'plan', label: t.studyAi.modePlan, body: t.studyAi.modePlanSub, icon: <Icon.calendar size={20} /> },
  ];

  if (courses.length === 0) {
    return (
      <>
        <PageHeader title={t.study.title} subtitle={t.study.subtitle} />
        <Card>
          <EmptyState
            title={t.studyAi.chooseCourse}
            body={t.studyAi.chooseCourseSub}
            icon={<Icon.courses size={24} />}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t.study.title} subtitle={t.study.subtitle} />

      {!aiEnabled ? (
        <div className="mb-4">
          <AiUnavailable
          title={t.ai.unavailableTitle}
          body={t.ai.unavailableBody}
          action={{ href: "/settings", label: t.ai.ownKeyCta }}
        />
        </div>
      ) : null}

      {/* Which course ---------------------------------------------------- */}
      <Card className="mb-4">
        <CardHeader title={t.studyAi.chooseCourse} subtitle={t.studyAi.chooseCourseSub} />
        <div className="flex flex-wrap gap-1.5">
          {courses.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={c.id === courseId}
              onClick={() => { setCourseId(c.id); setChapterId(null); }}
              className={cx(
                'px-3 min-h-[38px] rounded-[var(--radius-sm)] text-[0.8125rem] font-medium border transition-colors',
                c.id === courseId
                  ? 'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
              )}
            >
              {c.code}
            </button>
          ))}
        </div>
      </Card>

      {/* What kind of help ------------------------------------------------ */}
      <Card className="mb-4">
        <CardHeader title={t.studyAi.chooseMode} />
        <div className="grid gap-2 sm:grid-cols-3">
          {modes.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={mode === m.key}
              onClick={() => setMode(m.key)}
              className={cx(
                'text-start p-3.5 rounded-[var(--radius-md)] border transition-colors',
                mode === m.key
                  ? 'bg-[var(--bg-accent-soft)] border-[var(--accent)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--accent)]',
              )}
            >
              <span className={cx(
                'grid place-items-center w-9 h-9 rounded-[var(--radius-sm)] mb-2',
                mode === m.key ? 'bg-[var(--accent)] text-[var(--text-on-accent)]' : 'bg-[var(--bg-inset)] text-[var(--text-secondary)]',
              )}>
                {m.icon}
              </span>
              <span className="block text-sm font-medium">{m.label}</span>
              <span className="block text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{m.body}</span>
            </button>
          ))}
        </div>
      </Card>

      {mode === 'review' && course ? (
        <ChapterReviewPanel
          courseId={course.id}
          chapters={course.chapters}
          aiEnabled={aiEnabled}
          onPractise={(id) => { setChapterId(id); setMode('practice'); }}
        />
      ) : null}

      {mode === 'practice' && course ? (
        <StudyView
          aiEnabled={aiEnabled}
          courses={planCourses}
          chapters={course.chapters}
          initialCourseId={course.id}
          initialFormat={initialFormat}
          initialChapterId={chapterId}
          history={history}
          embedded
        />
      ) : null}

      {mode === 'plan' ? (
        <StudyPlansPanel courses={planCourses} plans={plans} aiEnabled={aiEnabled} />
      ) : null}
    </>
  );
}
