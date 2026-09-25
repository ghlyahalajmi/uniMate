'use client';

import {
  useActionState, useCallback, useEffect, useMemo, useState, useSyncExternalStore, useTransition,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader, cx } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { TextInput, TextArea, Select } from '@/components/ui/form';
import { Modal, useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import { saveFlashcard, deleteFlashcard, reviewFlashcard, completeReviewSession } from '@/lib/flashcards/actions';
import { BOX_INTERVALS, MAX_BOX, deckMastery, isDue } from '@/lib/flashcards/scheduler';
import { actionMessage } from '@/lib/i18n/action-messages';
import type { ActionState } from '@/lib/data/actions';

const EMPTY: ActionState = {};

/** The browser's local calendar day. A primitive, so React can compare it. */
function browserDay(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/** Nothing pushes a new day at us; we only need the value, not updates. */
function subscribeNothing(): () => void {
  return () => {};
}

export interface CardRow {
  id: string;
  front: string;
  back: string;
  topic: string | null;
  courseId: string | null;
  courseCode: string | null;
  box: number;
  dueOn: string;
  reviews: number;
}

/**
 * A card's colour, decided by its topic.
 *
 * Not at random, and not by position in the deck: the same topic keeps the
 * same colour from one card to the next and from one session to the next, so
 * the colour carries meaning — three blue cards in a row are three cards
 * about the same thing. A card with no topic falls to its course code, and a
 * card with neither gets the plain surface.
 *
 * The palette is the one the Notes screen already uses, which is a set of
 * light-and-dark pairs that have been checked for contrast. Inventing six
 * more colours here would mean checking them again and having two palettes
 * that almost match.
 */
const CARD_TINTS = ['yellow', 'mint', 'sky', 'rose', 'lilac', 'kraft'] as const;

function tintFor(card: CardRow): string {
  const key = (card.topic ?? card.courseCode ?? '').trim().toLowerCase();
  if (!key) return 'default';

  // A small stable hash, so the answer never depends on render order.
  let sum = 0;
  for (let i = 0; i < key.length; i++) sum = (sum * 31 + key.charCodeAt(i)) % 100_000;
  return CARD_TINTS[sum % CARD_TINTS.length];
}

/**
 * One side of the card.
 *
 * Both sides occupy the same grid cell, so the taller decides the height and
 * the card does not resize as it turns. The back is pre-rotated in CSS.
 */
function CardFace({
  tint, area, side, children,
}: {
  tint: string;
  area: string;
  side: 'front' | 'back';
  children: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        'paper flip-face min-h-[15rem] p-6 rounded-[var(--radius-lg)]',
        'border border-[var(--border-subtle)] shadow-sm',
        'flex flex-col justify-center text-center',
        side === 'back' && 'flip-face--back',
      )}
      data-tint={tint}
      style={{ gridArea: area }}
    >
      {children}
    </div>
  );
}

type Mode = 'deck' | 'review' | 'done';

export function FlashcardsView({
  serverToday, cards, courseOptions, initialCourseId = '',
}: {
  serverToday: string;
  cards: CardRow[];
  courseOptions: Array<{ value: string; label: string }>;
  /** Set when the deck was opened from a course, which then scopes the screen. */
  initialCourseId?: string;
}) {
  const { t, tf, formatNumber } = useI18n();
  const router = useRouter();
  const toast = useToast();

  // The server rendered against its own date. A student revising at 01:00 in
  // Kuwait is on a different day from a server in Virginia, and the queue they
  // see should be theirs — so the browser's day is read through an external
  // store: correct after hydration, and matching the server during it.
  const today = useSyncExternalStore(subscribeNothing, browserDay, () => serverToday);

  const [mode, setMode] = useState<Mode>('deck');
  const [courseFilter, setCourseFilter] = useState(initialCourseId);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CardRow | null>(null);
  const [deleting, setDeleting] = useState<CardRow | null>(null);
  const [, startTransition] = useTransition();

  // Review session state.
  const [queue, setQueue] = useState<CardRow[]>([]);
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [recalled, setRecalled] = useState(0);
  const [requeued, setRequeued] = useState<Set<string>>(new Set());
  const [lastOutcome, setLastOutcome] = useState<{ box: number; dueOn: string; lapsed: boolean } | null>(null);

  const visible = useMemo(
    () => (courseFilter ? cards.filter((c) => c.courseId === courseFilter) : cards),
    [cards, courseFilter],
  );

  const due = useMemo(() => visible.filter((c) => isDue(c.dueOn, today)), [visible, today]);
  const mastery = useMemo(() => deckMastery(visible.map((c) => c.box)), [visible]);

  const boxes = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const c of visible) counts[Math.min(Math.max(c.box, 1), MAX_BOX) - 1] += 1;
    return counts;
  }, [visible]);

  const startReview = useCallback((set: CardRow[]) => {
    if (set.length === 0) return;
    setQueue(set);
    setPosition(0);
    setRevealed(false);
    setRecalled(0);
    setRequeued(new Set());
    setLastOutcome(null);
    setMode('review');
  }, []);

  const current = queue[position];

  const answer = useCallback(async (knew: boolean) => {
    if (!current) return;

    const result = await reviewFlashcard(current.id, knew, new Date().getTimezoneOffset());
    if (result.ok && result.box !== undefined && result.dueOn !== undefined) {
      setLastOutcome({ box: result.box, dueOn: result.dueOn, lapsed: !knew && current.box > 1 });
    }
    if (knew) setRecalled((n) => n + 1);

    // A missed card comes back once more this session — seeing it again while
    // it is still fresh is the point of getting it wrong. Only once, though,
    // or a card you cannot recall would trap you in a loop.
    let nextQueue = queue;
    if (!knew && !requeued.has(current.id)) {
      nextQueue = [...queue, current];
      setQueue(nextQueue);
      setRequeued((prev) => new Set(prev).add(current.id));
    }

    if (position + 1 >= nextQueue.length) {
      const reviewed = position + 1;
      const got = recalled + (knew ? 1 : 0);
      const res = await completeReviewSession({
        reviewed,
        recalled: got,
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      });
      const m = res.momentum;
      if (m) {
        if (m.streakExtended) toast.success(tf(t.momentum.toastStreak, { n: m.streakAfter }));
        for (const code of m.newAchievements ?? []) {
          const name = (t.momentum as unknown as Record<string, string>)[`a_${code}`] ?? code;
          toast.success(tf(t.momentum.toastAchievement, { name }));
        }
      }
      setMode('done');
      router.refresh();
      return;
    }

    setPosition((p) => p + 1);
    setRevealed(false);
  }, [current, queue, position, requeued, recalled, router, toast, tf, t]);

  // Space reveals, then 1 and 2 answer. A deck is a rhythm, same as a quiz.
  useEffect(() => {
    if (mode !== 'review') return;
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA') return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setRevealed(true); return; }
      if (revealed && (e.key === '1' || e.key === '2')) { e.preventDefault(); void answer(e.key === '1'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, revealed, answer]);

  function confirmDelete() {
    if (!deleting) return;
    const card = deleting;
    setDeleting(null);
    startTransition(async () => {
      const res = await deleteFlashcard(card.id);
      if (res.ok) { toast.success(actionMessage(t, res.messageKey)); router.refresh(); }
      else toast.error(actionMessage(t, res.messageKey));
    });
  }

  // --- Review -----------------------------------------------------------------

  if (mode === 'review' && current) {
    return (
      <>
        <PageHeader title={t.flashcards.title} subtitle={t.flashcards.subtitle} />
        <div className="space-y-4">
          <Card padded={false} className="p-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium tabular-nums">
                {tf(t.flashcards.cardOf, { n: formatNumber(position + 1), total: formatNumber(queue.length) })}
              </p>
              <Badge>{tf(t.flashcards.boxLabel, { n: formatNumber(current.box) })}</Badge>
            </div>
            <ol className="flex gap-1 mt-3" aria-hidden="true">
              {queue.map((c, i) => (
                <li
                  key={`${c.id}-${i}`}
                  className={cx(
                    'h-1.5 flex-1 rounded-full',
                    i < position ? 'bg-[var(--positive)]'
                      : i === position ? 'bg-[var(--accent)]' : 'bg-[var(--bg-inset)]',
                  )}
                />
              ))}
            </ol>
          </Card>

          {/*
            The card, and it turns over.

            Pressing it anywhere flips it, because that is what a card does
            and because the whole target is easier to hit than a button — on
            a phone this is the gesture the screen is for. The button is still
            below for anyone navigating by keyboard or reading the page out.
          */}
          <div className="flip deck-shadow relative z-0 rounded-[var(--radius-lg)]">
            <button
              type="button"
              onClick={() => setRevealed((was) => !was)}
              aria-label={revealed ? t.flashcards.showQuestion : t.flashcards.showAnswer}
              className="w-full text-start cursor-pointer"
            >
              <div
                className="flip-inner grid rounded-[var(--radius-lg)]"
                data-face={revealed ? 'back' : 'front'}
                style={{ gridTemplateAreas: '"card"' }}
              >
                <CardFace tint={tintFor(current)} area="card" side="front">
                  <div className="flex flex-wrap justify-center gap-1.5 mb-4">
                    {current.courseCode ? <Badge tone="accent">{current.courseCode}</Badge> : null}
                    {current.topic ? <Badge>{current.topic}</Badge> : null}
                  </div>
                  <p className="font-display text-xl leading-snug text-balance-title">
                    {current.front}
                  </p>
                  <p className="text-xs opacity-60 mt-5">{t.flashcards.tapToFlip}</p>
                </CardFace>

                <CardFace tint={tintFor(current)} area="card" side="back">
                  <p className="text-xs uppercase tracking-[0.14em] opacity-60 mb-3">
                    {t.flashcards.answerLabel}
                  </p>
                  <p className="text-base leading-relaxed whitespace-pre-line">{current.back}</p>
                </CardFace>
              </div>
            </button>
          </div>

          {revealed ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="lg" onClick={() => void answer(false)}>
                {t.flashcards.missed}
              </Button>
              <Button size="lg" onClick={() => void answer(true)}>
                <Icon.check size={18} />
                {t.flashcards.gotIt}
              </Button>
            </div>
          ) : (
            <Button fullWidth size="lg" onClick={() => setRevealed(true)}>
              {t.flashcards.showAnswer}
            </Button>
          )}

          {lastOutcome ? (
            <p className="text-xs text-[var(--text-muted)] text-center">
              {lastOutcome.lapsed ? `${t.flashcards.lapsed} · ` : ''}
              {describeNext(lastOutcome.box, lastOutcome.dueOn, today, t, tf, formatNumber)}
            </p>
          ) : null}
        </div>
      </>
    );
  }

  // --- Session finished --------------------------------------------------------

  if (mode === 'done') {
    const reviewed = queue.length;
    const pct = reviewed > 0 ? Math.round((recalled / reviewed) * 100) : 0;
    return (
      <>
        <PageHeader title={t.flashcards.title} subtitle={t.flashcards.subtitle} />
        <Card className="text-center">
          <p
            className="font-display text-5xl font-semibold tabular-nums"
            style={{ color: pct >= 80 ? 'var(--positive)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)' }}
          >
            {formatNumber(pct)}%
          </p>
          <p className="font-display text-xl font-semibold mt-3">{t.flashcards.doneTitle}</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {tf(t.flashcards.doneBody, { recalled: formatNumber(recalled), reviewed: formatNumber(reviewed) })}
          </p>
          <Button fullWidth size="lg" className="mt-5" onClick={() => setMode('deck')}>
            {t.flashcards.finish}
          </Button>
        </Card>
      </>
    );
  }

  // --- Deck --------------------------------------------------------------------

  // The sidebar has no Flashcards entry: a deck is reached from its course, so
  // when one sent us here the way back is named rather than left to the
  // browser's Back button.
  const fromCourse = initialCourseId
    ? courseOptions.find((c) => c.value === initialCourseId)
    : undefined;
  const fromCourseCode = fromCourse?.label.split('—')[0]?.trim() ?? '';

  return (
    <>
      {fromCourse ? (
        <div className="mb-2">
          <Link
            href={`/courses/${initialCourseId}`}
            className="inline-flex items-center gap-1.5 min-h-[32px] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Icon.chevronEnd size={15} className="rotate-180 flip-rtl" />
            {tf(t.practice.backToCourse, { code: fromCourseCode })}
          </Link>
        </div>
      ) : null}

      <PageHeader
        title={t.flashcards.title}
        subtitle={t.flashcards.subtitle}
        action={
          <Button size="sm" variant="secondary" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Icon.plus size={16} />
            {t.flashcards.addCard}
          </Button>
        }
      />

      <div className="space-y-4">
        {cards.length === 0 ? (
          <Card>
            <EmptyState
              title={t.flashcards.emptyTitle}
              body={t.flashcards.emptyBody}
              icon={<Icon.flashcards size={24} />}
              action={
                <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                  <Icon.plus size={16} />
                  {t.flashcards.addCard}
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            <Card className="relative overflow-hidden bg-[var(--bg-accent-soft)] border-[var(--border-subtle)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-16 -end-16 w-44 h-44 rounded-full opacity-40"
                style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }}
              />
              <div className="relative">
                <dl className="grid grid-cols-3 gap-2">
                  <Stat label={t.flashcards.due} value={formatNumber(due.length)} accent />
                  <Stat label={t.flashcards.total} value={formatNumber(visible.length)} />
                  <Stat label={t.flashcards.mastery} value={`${formatNumber(Math.round(mastery * 100))}%`} />
                </dl>

                {due.length > 0 ? (
                  <Button size="lg" fullWidth className="mt-4" onClick={() => startReview(due)}>
                    <Icon.play size={18} />
                    {t.flashcards.startReview}
                  </Button>
                ) : (
                  <div className="mt-4">
                    <p className="text-sm font-medium">{t.flashcards.noneDueTitle}</p>
                    <p className="text-[0.8125rem] text-[var(--text-secondary)] mt-1 leading-relaxed">
                      {t.flashcards.noneDueBody}
                    </p>
                    <Button
                      variant="secondary" fullWidth className="mt-3"
                      onClick={() => startReview(visible)}
                      disabled={visible.length === 0}
                    >
                      {t.flashcards.reviewAll}
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title={t.flashcards.spread} subtitle={t.flashcards.howItWorks} />
              <ul className="flex items-end gap-2 h-24" aria-hidden="true">
                {boxes.map((count, i) => {
                  const tallest = Math.max(...boxes, 1);
                  return (
                    <li key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <span className="text-xs tabular-nums text-[var(--text-muted)]">{formatNumber(count)}</span>
                      <span
                        className="w-full rounded-[var(--radius-sm)] bg-[var(--accent)]"
                        style={{ height: `${Math.max(4, (count / tallest) * 100)}%`, opacity: 0.35 + i * 0.16 }}
                      />
                      <span className="text-xs tabular-nums text-[var(--text-muted)]">{formatNumber(i + 1)}</span>
                    </li>
                  );
                })}
              </ul>
              <ul className="sr-only">
                {boxes.map((count, i) => (
                  <li key={i}>{tf(t.flashcards.boxAxis, { n: formatNumber(i + 1), count: formatNumber(count) })}</li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader title={t.flashcards.manageTitle} />
              {/* Below the heading rather than beside it: the header's action
                  slot is shrink-0, and a course name is longer than 320px. */}
              {courseOptions.length > 0 ? (
                <div className="mb-4">
                  <Select
                    label={t.common.course}
                    value={courseFilter}
                    onChange={(e) => setCourseFilter(e.target.value)}
                    placeholder={t.flashcards.allCourses}
                    options={courseOptions}
                  />
                </div>
              ) : null}
              <ul className="divide-y divide-[var(--border-subtle)]">
                {visible.map((c) => (
                  <li key={c.id} className="py-3 flex items-start gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{c.front}</span>
                      <span className="block text-xs text-[var(--text-muted)] mt-0.5 truncate">{c.back}</span>
                      <span className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {c.courseCode ? <Badge tone="accent">{c.courseCode}</Badge> : null}
                        <Badge>{tf(t.flashcards.boxLabel, { n: formatNumber(c.box) })}</Badge>
                        {isDue(c.dueOn, today) ? <Badge tone="warning">{t.flashcards.due}</Badge> : null}
                      </span>
                    </span>
                    <span className="flex gap-1 shrink-0">
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => { setEditing(c); setFormOpen(true); }}
                        aria-label={t.flashcards.editCard}
                      >
                        <Icon.edit size={15} />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => setDeleting(c)}
                        aria-label={t.common.delete}
                      >
                        <Icon.trash size={15} />
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>

      <CardForm
        open={formOpen}
        card={editing}
        courseOptions={courseOptions}
        onClose={() => { setFormOpen(false); setEditing(null); }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={t.flashcards.deleteConfirm}
        body={deleting?.front ?? ''}
      />
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
      <dd
        className={cx('font-display text-2xl font-semibold tabular-nums mt-0.5')}
        style={accent ? { color: 'var(--accent-soft-text)' } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

function CardForm({
  open, card, courseOptions, onClose,
}: {
  open: boolean;
  card: CardRow | null;
  courseOptions: Array<{ value: string; label: string }>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [state, action, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveFlashcard(prev, formData);
      if (result.ok) {
        toast.success(actionMessage(t, result.messageKey));
        router.refresh();
        onClose();
      } else if (result.messageKey) {
        toast.error(actionMessage(t, result.messageKey));
      }
      return result;
    },
    EMPTY,
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={card ? t.flashcards.editCard : t.flashcards.newCard}
    >
      <form action={action} className="space-y-4">
        {card ? <input type="hidden" name="id" value={card.id} /> : null}

        <TextArea
          label={t.flashcards.front}
          name="front"
          defaultValue={card?.front ?? ''}
          hint={t.flashcards.frontHint}
          error={state.errors?.front}
          rows={2}
          required
        />
        <TextArea
          label={t.flashcards.back}
          name="back"
          defaultValue={card?.back ?? ''}
          hint={t.flashcards.backHint}
          error={state.errors?.back}
          rows={4}
          required
        />
        <Select
          label={t.common.course}
          name="course_id"
          defaultValue={card?.courseId ?? ''}
          placeholder={t.flashcards.allCourses}
          options={courseOptions}
        />
        <TextInput
          label={t.study.topic}
          name="topic"
          defaultValue={card?.topic ?? ''}
          hint={t.common.optional}
        />

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button type="submit" loading={pending}>{t.common.save}</Button>
        </div>
      </form>
    </Modal>
  );
}

/** "Back tomorrow" reads better than a date, and is what the student asked. */
function describeNext(
  box: number,
  dueOn: string,
  today: string,
  t: ReturnType<typeof useI18n>['t'],
  tf: ReturnType<typeof useI18n>['tf'],
  formatNumber: ReturnType<typeof useI18n>['formatNumber'],
): string {
  if (dueOn <= today) return t.flashcards.backToday;
  const days = BOX_INTERVALS[box] ?? 1;
  return days === 1 ? t.flashcards.backTomorrow : tf(t.flashcards.backInDays, { n: formatNumber(days) });
}
