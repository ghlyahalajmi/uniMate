'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { Button, Card, cx } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import { addReminder } from '@/lib/data/actions';
import { TextInput } from '@/components/ui/form';
import type { Weekday } from '@/types/database';

const WEEK_ORDER: Weekday[] = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

interface ClassRow {
  id: string; code: string; name: string;
  days: Weekday[]; start: string | null; end: string | null; room: string | null;
}

type EntryKind = 'assessment' | 'task' | 'reminder';

interface DatedRow {
  id: string; kind: EntryKind; date: string;
  title: string; courseCode: string | null; detail: string | null;
}

export function CalendarView({ classes, dated }: { classes: ClassRow[]; dated: DatedRow[] }) {
  const { t, formatDate, formatTime, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string>(() => isoOf(new Date()));
  const [view, setView] = useState<'month' | 'agenda'>('month');
  const [rebuilding, setRebuilding] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDay, setReminderDay] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [reminderTime, setReminderTime] = useState('');

  const byDate = useMemo(() => {
    const map = new Map<string, DatedRow[]>();
    for (const d of dated) {
      const list = map.get(d.date) ?? [];
      list.push(d);
      map.set(d.date, list);
    }
    return map;
  }, [dated]);

  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const todayIso = isoOf(new Date());

  const selectedDate = new Date(`${selected}T00:00:00`);
  const selectedWeekday = WEEK_ORDER[selectedDate.getDay()];
  const selectedClasses = classes
    .filter((c) => c.days.includes(selectedWeekday))
    .sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  const selectedEntries = byDate.get(selected) ?? [];

  const agenda = useMemo(
    () => [...dated].filter((d) => d.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 40),
    [dated, todayIso],
  );

  const monthLabel = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-KW-u-nu-latn' : 'en-GB', {
    month: 'long', year: 'numeric',
  }).format(cursor);

  const hasAnything = classes.length > 0 || dated.length > 0;

  /**
   * Write a reminder for a day.
   *
   * The button here used to run the AI reminder builder, which reads upcoming
   * assessments and invents a revision ramp — a different feature wearing the
   * same word, and one that simply failed with no model configured. What the
   * button says it does is what it now does: pick a day, say what it is, set
   * a time if you want one.
   */
  async function saveReminder() {
    const title = reminderTitle.trim();
    if (!title) return;
    setRebuilding(true);
    try {
      const result = await addReminder({
        title,
        remindOn: reminderDay,
        remindAt: reminderTime || null,
      });
      if (result.ok) {
        toast.success(t.calendar.reminderSaved);
        setReminderTitle('');
        setReminderTime('');
        setReminderOpen(false);
        router.refresh();
      } else {
        toast.error(t.errors.generic);
      }
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t.calendar.title}
        subtitle={t.calendar.subtitle}
        action={
          <Button variant="secondary" onClick={() => setReminderOpen((v) => !v)}>
            <Icon.bell size={16} />
            <span className="hidden sm:inline">{t.calendar.addReminder}</span>
          </Button>
        }
      />

      {reminderOpen ? (
        <Card className="mb-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label={t.calendar.reminderWhat}
              placeholder={t.calendar.reminderWhatHint}
              value={reminderTitle}
              onChange={(e) => setReminderTitle(e.target.value)}
              className="sm:col-span-2"
            />
            <TextInput
              label={t.calendar.reminderDay}
              type="date"
              value={reminderDay}
              onChange={(e) => setReminderDay(e.target.value)}
            />
            <TextInput
              label={t.calendar.reminderTime}
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">{t.calendar.reminderTimeHint}</p>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setReminderOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={saveReminder}
              loading={rebuilding}
              loadingLabel={t.common.saving}
              disabled={!reminderTitle.trim()}
            >
              <Icon.check size={17} />
              {t.calendar.addReminder}
            </Button>
          </div>
        </Card>
      ) : null}

      {!hasAnything ? (
        <Card><EmptyState title={t.calendar.title} body={t.calendar.empty} /></Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div
              role="tablist"
              aria-label={t.calendar.title}
              className="inline-flex gap-1 p-1 rounded-[var(--radius-md)] bg-[var(--bg-inset)]"
            >
              {(['month', 'agenda'] as const).map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={cx(
                    'px-3.5 min-h-[36px] rounded-[var(--radius-sm)] text-[0.8125rem] font-medium transition-colors',
                    view === v ? 'bg-[var(--bg-surface)] shadow-[var(--shadow-card)]' : 'text-[var(--text-secondary)]',
                  )}
                >
                  {v === 'month' ? t.calendar.month : t.calendar.agenda}
                </button>
              ))}
            </div>

            {view === 'month' ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
                  aria-label={t.calendar.prev}
                  className="w-9 h-9 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:bg-[var(--bg-inset)]"
                >
                  <Icon.chevronEnd size={16} className="rotate-180 flip-rtl" />
                </button>
                <span className="text-sm font-medium min-w-[9rem] text-center">{monthLabel}</span>
                <button
                  type="button"
                  onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
                  aria-label={t.calendar.nextPeriod}
                  className="w-9 h-9 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:bg-[var(--bg-inset)]"
                >
                  <Icon.chevronEnd size={16} className="flip-rtl" />
                </button>
              </div>
            ) : null}
          </div>

          {view === 'month' ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2" padded={false}>
                <div className="p-2 sm:p-3">
                  <div className="grid grid-cols-7 mb-1">
                    {WEEK_ORDER.map((d) => (
                      <div key={d} className="text-center text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] py-1.5">
                        <span className="hidden sm:inline">{t.weekdaysShort[d]}</span>
                        <span className="sm:hidden">{t.weekdaysShort[d].slice(0, 1)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                    {grid.map((cell) => {
                      const iso = isoOf(cell.date);
                      const entries = byDate.get(iso) ?? [];
                      const weekday = WEEK_ORDER[cell.date.getDay()];
                      const classCount = classes.filter((c) => c.days.includes(weekday)).length;
                      const isToday = iso === todayIso;
                      const isSelected = iso === selected;

                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => setSelected(iso)}
                          aria-current={isToday ? 'date' : undefined}
                          aria-label={`${formatDate(iso)}${entries.length ? `, ${entries.length}` : ''}`}
                          className={cx(
                            'aspect-square sm:aspect-auto sm:min-h-[62px] p-1 sm:p-1.5 rounded-[var(--radius-sm)]',
                            'flex flex-col items-center sm:items-start gap-0.5 transition-colors text-start',
                            !cell.inMonth && 'opacity-35',
                            isSelected
                              ? 'bg-[var(--bg-accent-soft)] ring-1 ring-[var(--accent)]'
                              : 'hover:bg-[var(--bg-inset)]',
                          )}
                        >
                          <span
                            className={cx(
                              'text-xs tabular-nums w-5 h-5 grid place-items-center rounded-full shrink-0',
                              isToday && 'bg-[var(--accent)] text-white font-semibold',
                            )}
                          >
                            {cell.date.getDate()}
                          </span>
                          <span className="flex flex-wrap gap-0.5 justify-center sm:justify-start">
                            {classCount > 0 && cell.inMonth ? (
                              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
                            ) : null}
                            {entries.slice(0, 3).map((e) => (
                              <span
                                key={e.id}
                                aria-hidden="true"
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: kindColour(e.kind) }}
                              />
                            ))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>

              <Card>
                <h2 className="font-display text-lg font-semibold mb-3">{formatDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>

                {selectedClasses.length === 0 && selectedEntries.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">{t.calendar.nothingOn}</p>
                ) : (
                  <div className="space-y-4">
                    {selectedClasses.length ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                          {t.calendar.classLabel}
                        </p>
                        <ul className="space-y-2">
                          {selectedClasses.map((c) => (
                            <li key={c.id} className="flex items-baseline gap-2.5 text-sm">
                              <span className="tabular-nums font-medium text-[var(--accent)] w-11 shrink-0">
                                {c.start ? formatTime(c.start) : '—'}
                              </span>
                              <span className="min-w-0">
                                <span className="block font-medium truncate">{c.code}</span>
                                <span className="block text-xs text-[var(--text-muted)]">{c.room ?? ''}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {selectedEntries.length ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                          {t.dashboard.upcoming}
                        </p>
                        <ul className="space-y-2.5">
                          {selectedEntries.map((e) => (
                            <li key={e.id} className="flex items-start gap-2.5">
                              <span
                                aria-hidden="true"
                                className="mt-[5px] w-2 h-2 rounded-full shrink-0"
                                style={{ background: kindColour(e.kind) }}
                              />
                              <span className="min-w-0">
                                <span className="block text-sm leading-snug">{e.title}</span>
                                <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                                  {kindLabel(t, e.kind)}
                                  {e.courseCode ? ` · ${e.courseCode}` : ''}
                                  {e.detail ? ` · ${e.detail}` : ''}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <Card>
              {agenda.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">{t.dashboard.nothingUpcoming}</p>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {agenda.map((e) => (
                    <li key={e.id} className="py-3 flex items-start justify-between gap-3">
                      <span className="flex items-start gap-2.5 min-w-0">
                        <span
                          aria-hidden="true"
                          className="mt-[6px] w-2 h-2 rounded-full shrink-0"
                          style={{ background: kindColour(e.kind) }}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{e.title}</span>
                          <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                            {kindLabel(t, e.kind)}{e.courseCode ? ` · ${e.courseCode}` : ''}
                          </span>
                        </span>
                      </span>
                      <span className="text-xs tabular-nums text-[var(--text-secondary)] shrink-0">
                        {formatDate(e.date)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {/* Legend — the dot colours are explained, not left to be guessed. */}
          <ul className="flex flex-wrap gap-3 mt-4">
            {(['assessment', 'task', 'reminder'] as EntryKind[]).map((k) => (
              <li key={k} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ background: kindColour(k) }} />
                {kindLabel(t, k)}
              </li>
            ))}
            <li className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
              {t.calendar.classLabel}
            </li>
          </ul>
        </>
      )}
    </>
  );
}

function kindColour(kind: EntryKind): string {
  return kind === 'assessment' ? 'var(--danger)'
    : kind === 'task' ? 'var(--accent)'
    : 'var(--warning)';
}

function kindLabel(t: { calendar: { assessmentLabel: string; taskLabel: string; reminderLabel: string } }, kind: EntryKind): string {
  return kind === 'assessment' ? t.calendar.assessmentLabel
    : kind === 'task' ? t.calendar.taskLabel
    : t.calendar.reminderLabel;
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Six weeks starting on the Sunday on or before the first of the month. */
function buildMonthGrid(monthStart: Date): Array<{ date: Date; inMonth: boolean }> {
  const first = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return { date, inMonth: date.getMonth() === monthStart.getMonth() };
  });
}
