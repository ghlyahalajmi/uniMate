'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { useBrowserNow } from '@/lib/time/clock';
import { Badge, Button, Card, cx } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import {
  addNoteItem, createNote, deleteNote, deleteNoteItem,
  renameNote, setNoteItemDone, updateNoteItem,
} from '@/lib/data/actions';
import type { NoteItem, NoteWithItems } from '@/types/database';

/** How long to sit on a keystroke before writing it. Long enough that normal
 *  typing is one write, short enough that a tab-away never loses a word. */
const SAVE_DELAY_MS = 700;

/** Half a minute is fine for "overdue" and keeps re-renders rare. */
const CLOCK_MS = 30_000;

type ReminderState = 'none' | 'soon' | 'overdue';

function reminderState(item: NoteItem, now: number): ReminderState {
  // now === 0 is the server: it has no business deciding a local deadline.
  if (now === 0 || !item.remind_at || item.is_done) return 'none';
  const at = new Date(item.remind_at).getTime();
  if (Number.isNaN(at)) return 'none';
  if (at <= now) return 'overdue';
  if (at - now <= 24 * 3_600_000) return 'soon';
  return 'none';
}

/** `datetime-local` speaks local wall-clock time; the column stores UTC. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function NotesView({ notes: initial }: { notes: NoteWithItems[] }) {
  const { t, formatDate } = useI18n();
  const toast = useToast();

  const [notes, setNotes] = useState<NoteWithItems[]>(initial);
  const [deleting, setDeleting] = useState<NoteWithItems | null>(null);
  const [creating, startCreate] = useTransition();

  // Which line to focus once it has been rendered. Set when a line is added so
  // that pressing Enter lands the cursor on the new line, as it would in a
  // notes app.
  const [focusId, setFocusId] = useState<string | null>(null);

  // Re-read the clock every half minute so "Overdue" appears on its own rather
  // than waiting for the next interaction.
  //
  // Through an external store, not state: reading Date.now() during render
  // meant the server decided whether a reminder was overdue, and the browser
  // then hydrated a different answer — React error #418. The server snapshot
  // is 0, meaning "no clock yet", and the reminder line stays quiet until the
  // browser supplies one.
  const now = useBrowserNow(CLOCK_MS);

  // Pending debounced writes, keyed by line. The callback is kept alongside the
  // timer so that unmounting runs the write rather than dropping it — closing
  // the tab mid-sentence should not lose the sentence.
  const timers = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => Promise<void> }>());
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const { timer, run } of map.values()) { clearTimeout(timer); void run(); }
      map.clear();
    };
  }, []);

  const failed = useCallback(() => toast.error(t.notes.saveError), [toast, t]);

  const patchItem = useCallback((noteId: string, itemId: string, patch: Partial<NoteItem>) => {
    setNotes((prev) => prev.map((n) => (n.id !== noteId ? n : {
      ...n,
      items: n.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
    })));
  }, []);

  // --- Notes ---------------------------------------------------------------

  function onCreateNote() {
    startCreate(async () => {
      const res = await createNote();
      if (!res.ok || !res.note) return failed();
      setNotes((prev) => [{ ...res.note!, items: [] }, ...prev]);
    });
  }

  function onRenameNote(noteId: string, title: string) {
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, title } : n)));
    scheduleSave(`note:${noteId}`, async () => {
      const res = await renameNote(noteId, title);
      if (!res.ok) failed();
    });
  }

  async function onDeleteNote(note: NoteWithItems) {
    const previous = notes;
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    setDeleting(null);
    const res = await deleteNote(note.id);
    if (!res.ok) { setNotes(previous); return failed(); }
    toast.success(t.notes.deleted);
  }

  // --- Lines ---------------------------------------------------------------

  async function onAddLine(noteId: string, afterPosition?: number) {
    const res = await addNoteItem(noteId, afterPosition);
    if (!res.ok || !res.item) return failed();
    const item = res.item;

    setNotes((prev) => prev.map((n) => {
      if (n.id !== noteId) return n;
      // Mirror the shift the action made on the server so positions agree
      // without a refetch.
      const shifted = afterPosition === undefined
        ? n.items
        : n.items.map((i) => (i.position >= item.position ? { ...i, position: i.position + 1 } : i));
      return { ...n, items: [...shifted, item].sort((a, b) => a.position - b.position) };
    }));
    setFocusId(item.id);
  }

  function onEditLine(noteId: string, item: NoteItem, content: string) {
    patchItem(noteId, item.id, { content });
    scheduleSave(`item:${item.id}`, async () => {
      const res = await updateNoteItem(item.id, { content });
      if (!res.ok) failed();
    });
  }

  async function onToggleLine(noteId: string, item: NoteItem) {
    const next = !item.is_done;
    patchItem(noteId, item.id, { is_done: next, completed_at: next ? new Date().toISOString() : null });
    const res = await setNoteItemDone(item.id, next);
    if (!res.ok) {
      patchItem(noteId, item.id, { is_done: item.is_done, completed_at: item.completed_at });
      failed();
    }
  }

  async function onSetReminder(noteId: string, item: NoteItem, value: string) {
    const iso = fromLocalInput(value);
    patchItem(noteId, item.id, { remind_at: iso });
    const res = await updateNoteItem(item.id, { remind_at: iso });
    if (!res.ok) {
      patchItem(noteId, item.id, { remind_at: item.remind_at });
      return failed();
    }
    toast.success(iso ? t.notes.reminderSet : t.notes.reminderCleared);
  }

  async function onDeleteLine(noteId: string, item: NoteItem) {
    const previous = notes;
    setNotes((prev) => prev.map((n) => (
      n.id !== noteId ? n : { ...n, items: n.items.filter((i) => i.id !== item.id) }
    )));
    const res = await deleteNoteItem(item.id);
    if (!res.ok) { setNotes(previous); failed(); }
  }

  function scheduleSave(key: string, run: () => Promise<void>) {
    const existing = timers.current.get(key);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      timers.current.delete(key);
      void run();
    }, SAVE_DELAY_MS);
    timers.current.set(key, { timer, run });
  }

  /**
   * Write a pending edit now rather than at the end of the debounce. Called on
   * blur, and a no-op when the debounce has already fired.
   */
  function flush(key: string, run: () => Promise<void>) {
    const existing = timers.current.get(key);
    if (!existing) return;
    clearTimeout(existing.timer);
    timers.current.delete(key);
    void run();
  }

  // --- Reminder summary ----------------------------------------------------

  const upcoming = useMemo(() => {
    const rows: Array<{ note: string; item: NoteItem; state: ReminderState }> = [];
    for (const note of notes) {
      for (const item of note.items) {
        const state = reminderState(item, now);
        if (state !== 'none') rows.push({ note: note.title || t.notes.untitled, item, state });
      }
    }
    return rows.sort((a, b) => (a.item.remind_at ?? '').localeCompare(b.item.remind_at ?? ''));
  }, [notes, now, t]);

  return (
    <>
      <PageHeader
        title={t.notes.title}
        subtitle={t.notes.subtitle}
        action={
          <Button onClick={onCreateNote} loading={creating} loadingLabel={t.common.saving}>
            <Icon.plus size={16} /> {t.notes.newNote}
          </Button>
        }
      />

      {upcoming.length > 0 ? (
        <Card className="mb-6 p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Icon.bell size={15} /> {t.notes.remindersTitle}
          </h2>
          <ul className="space-y-2">
            {upcoming.map(({ note, item, state }) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={state === 'overdue' ? 'danger' : 'warning'}>
                  {state === 'overdue' ? t.notes.overdue : t.notes.dueSoon}
                </Badge>
                <span className="text-[var(--text-primary)] min-w-0 break-words">
                  {item.content || t.notes.linePlaceholder}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {note}
                  {now === 0 ? null : (
                    <> · {formatDate(item.remind_at, {
                      weekday: 'short', hour: 'numeric', minute: '2-digit',
                    })}</>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--text-muted)] mt-3">{t.notes.remindersNote}</p>
        </Card>
      ) : null}

      {notes.length === 0 ? (
        <EmptyState
          icon={<Icon.notes size={24} />}
          title={t.notes.title}
          body={t.notes.empty}
          action={<Button onClick={onCreateNote} loading={creating}>{t.notes.newNote}</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 items-start [&>*]:min-w-0">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              now={now}
              focusId={focusId}
              onFocused={() => setFocusId(null)}
              onRename={(title) => onRenameNote(note.id, title)}
              onRenameBlur={(title) => flush(`note:${note.id}`, async () => { await renameNote(note.id, title); })}
              onAddLine={(after) => onAddLine(note.id, after)}
              onEditLine={(item, content) => onEditLine(note.id, item, content)}
              onEditBlur={(item, content) => flush(`item:${item.id}`, async () => { await updateNoteItem(item.id, { content }); })}
              onToggleLine={(item) => onToggleLine(note.id, item)}
              onSetReminder={(item, value) => onSetReminder(note.id, item, value)}
              onDeleteLine={(item) => onDeleteLine(note.id, item)}
              onDelete={() => setDeleting(note)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={t.notes.deleteConfirm}
        body={t.notes.deleteBody}
        confirmLabel={t.common.delete}
        onConfirm={async () => { if (deleting) await onDeleteNote(deleting); }}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

function NoteCard({
  note, now, focusId, onFocused,
  onRename, onRenameBlur, onAddLine, onEditLine, onEditBlur,
  onToggleLine, onSetReminder, onDeleteLine, onDelete,
}: {
  note: NoteWithItems;
  now: number;
  focusId: string | null;
  onFocused: () => void;
  onRename: (title: string) => void;
  onRenameBlur: (title: string) => void;
  onAddLine: (afterPosition?: number) => void;
  onEditLine: (item: NoteItem, content: string) => void;
  onEditBlur: (item: NoteItem, content: string) => void;
  onToggleLine: (item: NoteItem) => void;
  onSetReminder: (item: NoteItem, value: string) => void;
  onDeleteLine: (item: NoteItem) => void;
  onDelete: () => void;
}) {
  const { t, tf } = useI18n();
  const done = note.items.filter((i) => i.is_done).length;

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <input
          value={note.title}
          onChange={(e) => onRename(e.target.value)}
          onBlur={(e) => onRenameBlur(e.target.value)}
          placeholder={t.notes.untitled}
          aria-label={t.notes.noteTitle}
          maxLength={200}
          className={
            'flex-1 min-w-0 bg-transparent font-display font-semibold text-[1.0625rem] ' +
            'text-[var(--text-primary)] placeholder:text-[var(--text-muted)] ' +
            'border-0 border-b border-transparent focus:border-[var(--border-strong)] ' +
            'focus:outline-none py-1'
          }
        />
        <button
          type="button"
          onClick={onDelete}
          aria-label={t.notes.deleteNote}
          title={t.notes.deleteNote}
          className={
            'shrink-0 grid place-items-center w-9 h-9 rounded-md text-[var(--text-muted)] ' +
            'hover:text-[var(--danger)] hover:bg-[var(--bg-inset)] focus-visible:outline-2'
          }
        >
          <Icon.trash size={16} />
        </button>
      </div>

      {note.items.length > 0 ? (
        <p className="text-xs text-[var(--text-muted)] -mt-1">
          {done === note.items.length
            ? t.notes.allDone
            : tf(t.notes.doneCount, { done, total: note.items.length })}
        </p>
      ) : null}

      <ul className="flex flex-col gap-1">
        {note.items.map((item) => (
          <NoteLine
            key={item.id}
            item={item}
            now={now}
            autoFocus={focusId === item.id}
            onFocused={onFocused}
            onToggle={() => onToggleLine(item)}
            onChange={(content) => onEditLine(item, content)}
            onBlur={(content) => onEditBlur(item, content)}
            onEnter={() => onAddLine(item.position)}
            onSetReminder={(value) => onSetReminder(item, value)}
            onDelete={() => onDeleteLine(item)}
          />
        ))}
      </ul>

      {note.items.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">{t.notes.emptyLines}</p>
      ) : null}

      <Button variant="ghost" size="sm" onClick={() => onAddLine()} className="self-start">
        <Icon.plus size={15} /> {t.notes.addLine}
      </Button>
    </Card>
  );
}

function NoteLine({
  item, now, autoFocus, onFocused,
  onToggle, onChange, onBlur, onEnter, onSetReminder, onDelete,
}: {
  item: NoteItem;
  now: number;
  autoFocus: boolean;
  onFocused: () => void;
  onToggle: () => void;
  onChange: (content: string) => void;
  onBlur: (content: string) => void;
  onEnter: () => void;
  onSetReminder: (value: string) => void;
  onDelete: () => void;
}) {
  const { t, formatDate } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const [showReminder, setShowReminder] = useState(false);
  const state = reminderState(item, now);

  useEffect(() => {
    if (autoFocus) { ref.current?.focus(); onFocused(); }
  }, [autoFocus, onFocused]);

  return (
    <li className="group">
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="checkbox"
          aria-checked={item.is_done}
          aria-label={item.is_done ? t.notes.markNotDone : t.notes.markDone}
          onClick={onToggle}
          // 32px of button around a 22px box: the tick stays the size it was
          // drawn, but a thumb has something to land on. The negative margin
          // keeps the box sitting where the row's layout expects it.
          className="shrink-0 grid place-items-center w-8 h-8 -m-[5px] rounded-[var(--radius-sm)]"
        >
          <span
            aria-hidden="true"
            className={cx(
              'grid place-items-center w-[22px] h-[22px] rounded-[6px] border-2 transition-colors',
              item.is_done
                ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--text-on-accent)]'
                : 'border-[var(--border-strong)] text-transparent hover:border-[var(--accent)]',
            )}
          >
            <Icon.check size={13} />
          </span>
        </button>

        <input
          ref={ref}
          value={item.content}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onEnter(); }
            // Backspace on an already-empty line removes it, the way a list
            // behaves in any editor.
            if (e.key === 'Backspace' && item.content === '') { e.preventDefault(); onDelete(); }
          }}
          placeholder={t.notes.linePlaceholder}
          aria-label={t.notes.linePlaceholder}
          maxLength={2000}
          className={cx(
            'flex-1 min-w-0 bg-transparent text-sm py-1.5 border-0 focus:outline-none',
            'placeholder:text-[var(--text-muted)]',
            item.is_done
              ? 'line-through text-[var(--text-muted)]'
              : 'text-[var(--text-primary)]',
          )}
        />

        <button
          type="button"
          onClick={() => setShowReminder((v) => !v)}
          aria-label={t.notes.setReminder}
          aria-expanded={showReminder}
          title={t.notes.setReminder}
          className={cx(
            'shrink-0 grid place-items-center w-9 h-9 rounded-md transition-opacity',
            'hover:bg-[var(--bg-inset)] focus-visible:outline-2',
            // Always visible once a reminder exists; otherwise it appears on
            // hover and whenever the row is keyboard-focused.
            item.remind_at
              ? 'text-[var(--accent)]'
              : 'text-[var(--text-muted)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
          )}
        >
          <Icon.bell size={15} />
        </button>

        <button
          type="button"
          onClick={onDelete}
          aria-label={t.notes.deleteLine}
          title={t.notes.deleteLine}
          className={
            'shrink-0 grid place-items-center w-9 h-9 rounded-md text-[var(--text-muted)] ' +
            'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 ' +
            'hover:text-[var(--danger)] hover:bg-[var(--bg-inset)] focus-visible:outline-2'
          }
        >
          <Icon.trash size={15} />
        </button>
      </div>

      {item.remind_at && !showReminder ? (
        <p className="ms-[30px] mb-1 flex items-center gap-1.5 text-xs">
          <Icon.clock size={12} />
          <span className={cx(
            state === 'overdue' ? 'text-[var(--danger)] font-medium'
              : state === 'soon' ? 'text-[var(--warning)]'
              : 'text-[var(--text-muted)]',
            item.is_done && 'text-[var(--text-muted)] line-through',
          )}>
            {now === 0
              ? <span className="inline-block w-28 h-3 rounded skeleton" aria-hidden="true" />
              : formatDate(item.remind_at, {
                  weekday: 'short', day: 'numeric', month: 'short',
                  hour: 'numeric', minute: '2-digit',
                })}
          </span>
        </p>
      ) : null}

      {showReminder ? (
        <div className="ms-[30px] mb-2 flex flex-wrap items-center gap-2">
          <label className="text-xs text-[var(--text-muted)]" htmlFor={`remind-${item.id}`}>
            {t.notes.reminderLabel}
          </label>
          <input
            id={`remind-${item.id}`}
            type="datetime-local"
            value={toLocalInput(item.remind_at)}
            onChange={(e) => onSetReminder(e.target.value)}
            className={
              'rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] ' +
              'px-2 py-1.5 text-xs text-[var(--text-primary)] min-h-[36px]'
            }
          />
          {item.remind_at ? (
            <Button variant="ghost" size="sm" onClick={() => { onSetReminder(''); setShowReminder(false); }}>
              {t.notes.clearReminder}
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
