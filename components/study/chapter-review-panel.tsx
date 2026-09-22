'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader, cx } from '@/components/ui/primitives';
import { AiThinking, EmptyState, ErrorState } from '@/components/ui/states';
import { Icon } from '@/components/shell/icons';

export interface ChapterOption {
  id: string;
  title: string;
  /** False for PowerPoint and Word, which no agent can read yet. */
  readable: boolean;
}

interface ReviewSection { heading: string; body: string }

interface Review {
  overview: string;
  sections: ReviewSection[];
  keyTerms: Array<{ term: string; meaning: string }>;
  formulas: string[];
  pitfalls: string[];
  checklist: string[];
  notes: string[];
}

type Phase = 'choosing' | 'reading' | 'done' | 'error';

/**
 * Review one chapter of a course.
 *
 * The chapter list is the student's own upload, in their own order, so the
 * choice reads like their course rather than like a file system. Files nothing
 * can read are shown but not selectable — hiding them would leave the student
 * wondering where the slides they uploaded went.
 */
export function ChapterReviewPanel({
  courseId, chapters, onPractise,
}: {
  courseId: string;
  chapters: ChapterOption[];
  /** Hand a chapter to the practice flow, so revision leads somewhere. */
  onPractise: (chapterId: string) => void;
}) {
  const { t, tf } = useI18n();
  const [phase, setPhase] = useState<Phase>('choosing');
  const [chosen, setChosen] = useState<string>('');
  const [review, setReview] = useState<Review | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const readable = chapters.filter((c) => c.readable);

  async function run(materialId: string) {
    setChosen(materialId);
    setPhase('reading');
    setError(null);
    try {
      const res = await fetch('/api/ai/chapter-review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ materialId }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(
          data.error === 'not_readable' ? t.studyAi.onlyReadable
          : t.errors.generic,
        );
        setPhase('error');
        return;
      }
      setReview(data.review as Review);
      setTitle(String(data.chapterTitle ?? ''));
      setPhase('done');
    } catch {
      setError(t.errors.network);
      setPhase('error');
    }
  }

  if (chapters.length === 0) {
    return (
      <Card>
        <EmptyState
          title={t.studyAi.noChapters}
          body={t.studyAi.noChaptersHint}
          icon={<Icon.syllabi size={24} />}
          action={
            <Link href={`/courses/${courseId}`}>
              <Button variant="secondary">{t.studyAi.openCourse}</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  if (phase === 'reading') {
    return (
      <Card>
        <AiThinking stages={[t.studyAi.reviewing, t.studyAi.overview, t.studyAi.checklist]} />
      </Card>
    );
  }

  if (phase === 'done' && review) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader title={tf(t.studyAi.reviewOf, { name: title })} subtitle={review.overview} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => { setPhase('choosing'); setReview(null); }}>
              {t.studyAi.reviewAgain}
            </Button>
            <Button onClick={() => onPractise(chosen)}>
              <Icon.sparkle size={17} />
              {t.studyAi.practiceOn}
            </Button>
          </div>
        </Card>

        {review.notes.length ? (
          <Card className="bg-[var(--warning-soft)] border-[var(--warning-border)]">
            <ul className="space-y-1">
              {review.notes.map((n) => (
                <li key={n} className="text-sm">{n}</li>
              ))}
            </ul>
          </Card>
        ) : null}

        {review.sections.length ? (
          <Card>
            <ul className="space-y-4">
              {review.sections.map((sec) => (
                <li key={sec.heading}>
                  <h3 className="font-display text-[0.9375rem] font-semibold">{sec.heading}</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed mt-1">{sec.body}</p>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {review.keyTerms.length ? (
          <Card>
            <CardHeader title={t.studyAi.keyTerms} />
            <dl className="grid sm:grid-cols-2 gap-3">
              {review.keyTerms.map((k) => (
                <div key={k.term} className="min-w-0">
                  <dt className="text-sm font-medium">{k.term}</dt>
                  <dd className="text-[0.8125rem] text-[var(--text-secondary)] mt-0.5">{k.meaning}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ) : null}

        {review.formulas.length ? (
          <Card>
            <CardHeader title={t.studyAi.formulas} />
            <ul className="space-y-2">
              {review.formulas.map((f) => (
                <li key={f} className="text-sm font-mono px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg-inset)] overflow-x-auto">
                  {f}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {review.pitfalls.length ? (
          <Card>
            <CardHeader title={t.studyAi.pitfalls} />
            <ul className="space-y-1.5">
              {review.pitfalls.map((p) => (
                <li key={p} className="text-sm flex gap-2">
                  <span aria-hidden="true" className="text-[var(--warning)]">!</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {review.checklist.length ? (
          <Card>
            <CardHeader title={t.studyAi.checklist} />
            <ul className="space-y-1.5">
              {review.checklist.map((c) => (
                <li key={c} className="text-sm flex gap-2">
                  <Icon.check size={15} className="shrink-0 mt-0.5 text-[var(--positive)]" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {phase === 'error' && error ? (
        <ErrorState message={error} onRetry={() => setPhase('choosing')} retryLabel={t.common.retry} />
      ) : null}

      <Card>
        <CardHeader title={t.studyAi.chooseChapter} subtitle={t.studyAi.onlyReadable} />
        <ul className="space-y-2">
          {chapters.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={!c.readable}
                onClick={() => void run(c.id)}
                className={cx(
                  'w-full flex items-center gap-3 text-start px-3.5 py-3 rounded-[var(--radius-md)] border transition-colors',
                  c.readable
                    ? 'border-[var(--border-subtle)] hover:border-[var(--accent)] hover:bg-[var(--bg-accent-soft)]'
                    : 'border-[var(--border-subtle)] opacity-60 cursor-not-allowed',
                )}
              >
                <Icon.syllabi size={17} className="shrink-0 text-[var(--text-muted)]" />
                <span className="min-w-0 flex-1 text-sm font-medium truncate">{c.title}</span>
                {c.readable ? null : (
                  <Badge tone="warning" className="shrink-0">{t.common.notSet}</Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
        {readable.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] mt-3">{t.studyAi.onlyReadable}</p>
        ) : null}
      </Card>
    </div>
  );
}
