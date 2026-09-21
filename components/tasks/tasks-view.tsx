'use client';

import { useActionState, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, cx } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { TextInput, TextArea, Select } from '@/components/ui/form';
import { Modal, useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import { saveTask, setTaskStatus, deleteTask, type ActionState } from '@/lib/data/actions';
import { actionMessage } from '@/lib/i18n/action-messages';
import { XP_RULES } from '@/lib/momentum/engine';
import type { Task, TaskStatus } from '@/types/database';

const EMPTY: ActionState = {};
type Filter = 'open' | 'completed' | 'all';

export function TasksView({
  tasks, courseOptions, courseCodes,
}: {
  tasks: Task[];
  courseOptions: Array<{ value: string; label: string }>;
  courseCodes: Record<string, string>;
}) {
  const { t, tf, formatDate } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [filter, setFilter] = useState<Filter>('open');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [, startTransition] = useTransition();

  /**
   * What the student has just ticked, before the server has caught up.
   *
   * The box used to wait for a round trip and a page refresh before it changed
   * at all, and it never checked whether the write succeeded — so a slow
   * connection looked exactly like a dead button, and a genuine failure looked
   * the same again. It now flips at once and is corrected only if the server
   * disagrees.
   *
   * Each override remembers the status it was based on, which is what lets it
   * expire by itself: the moment the server stops showing that old value the
   * override is spent and the row falls back to the truth. No effect, no
   * cleanup pass, and no way for a stale override to freeze a row against a
   * change made somewhere else.
   */
  const [optimistic, setOptimistic] = useState<Record<string, { from: TaskStatus; to: TaskStatus }>>({});

  const statusOf = (tk: Task): TaskStatus => {
    const pending = optimistic[tk.id];
    return pending && tk.status === pending.from ? pending.to : tk.status;
  };

  const visible = tasks.filter((tk) => {
    const status = statusOf(tk);
    return filter === 'all' ? true : filter === 'open' ? status !== 'completed' : status === 'completed';
  });

  // The day boundaries are fixed for this page load rather than re-read on
  // every render, which keeps the grouping stable and the render pure.
  const [todayIso, weekIso] = useState(() => {
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 86_400_000);
    return [now.toISOString().slice(0, 10), week.toISOString().slice(0, 10)] as const;
  })[0];

  // Grouped by urgency rather than by raw date — that is how a student reads it.
  const groups = useMemo(() => {

    const buckets: Array<{ key: string; label: string; items: Task[] }> = [
      { key: 'overdue', label: t.tasks.groupOverdue, items: [] },
      { key: 'today', label: t.tasks.groupToday, items: [] },
      { key: 'week', label: t.tasks.groupWeek, items: [] },
      { key: 'later', label: t.tasks.groupLater, items: [] },
      { key: 'none', label: t.tasks.groupNoDate, items: [] },
    ];

    for (const tk of visible) {
      if (!tk.due_date) buckets[4].items.push(tk);
      else if (tk.due_date < todayIso && tk.status !== 'completed') buckets[0].items.push(tk);
      else if (tk.due_date === todayIso) buckets[1].items.push(tk);
      else if (tk.due_date <= weekIso) buckets[2].items.push(tk);
      else buckets[3].items.push(tk);
    }
    return buckets.filter((b) => b.items.length > 0);
  }, [visible, t, todayIso, weekIso]);

  /**
   * The box in front of a task means done or not done.
   *
   * It used to cycle todo → in progress → completed, so the first tap on a
   * fresh task marked it *started* rather than finished — which reads as a
   * broken checkbox, because the one thing a tick is supposed to do is the one
   * thing it did not do. In progress is still reachable from the task's own
   * status field; it is just no longer in the way of ticking something off.
   */
  function cycleStatus(tk: Task) {
    const was = statusOf(tk);
    const next: TaskStatus = was === 'completed' ? 'todo' : 'completed';

    // Flip now. The student pressed it; the box should say so before the
    // network has an opinion.
    setOptimistic((prev) => ({ ...prev, [tk.id]: { from: tk.status, to: next } }));

    startTransition(async () => {
      const result = await setTaskStatus(tk.id, next, new Date().getTimezoneOffset());

      // Put it back if the write did not land, and say why. Silence here is
      // what made a failure indistinguishable from a button that does nothing.
      if (!result.ok) {
        setOptimistic((prev) => {
          const next = { ...prev };
          delete next[tk.id];
          return next;
        });
        toast.error(t.errors.generic);
        return;
      }

      // Ticking something off should feel like it landed.
      const m = result.momentum;
      if (m) {
        if (m.xpAwarded > 0) toast.success(tf(t.momentum.toastXp, { n: m.xpAwarded }));
        else if (m.xpToday >= XP_RULES.dailyCap) toast.info(t.momentum.capReached);

        if (m.streakExtended) {
          toast.success(tf(t.momentum.toastStreak, { n: m.streakAfter }));
        }
        for (const code of m.newAchievements) {
          const name = (t.momentum as unknown as Record<string, string>)[`a_${code}`] ?? code;
          toast.success(tf(t.momentum.toastAchievement, { name }));
        }
      }
      router.refresh();
    });
  }

  const filters: Array<{ key: Filter; label: string }> = [
    { key: 'open', label: t.tasks.todo },
    { key: 'completed', label: t.tasks.completedLabel },
    { key: 'all', label: t.common.all },
  ];

  return (
    <>
      <PageHeader
        title={t.tasks.title}
        subtitle={t.tasks.subtitle}
        action={
          <>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Icon.plus size={17} />
              <span className="hidden sm:inline">{t.tasks.addTask}</span>
            </Button>
          </>
        }
      />

      <div role="tablist" aria-label={t.common.filter} className="inline-flex gap-1 p-1 rounded-[var(--radius-md)] bg-[var(--bg-inset)] mb-5">
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

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            title={t.tasks.title}
            body={filter === 'open' ? t.tasks.empty : t.tasks.emptyFiltered}
            action={
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Icon.plus size={17} />{t.tasks.addTask}
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
                {group.label}
                <span className="ms-2 tabular-nums">{group.items.length}</span>
              </h2>
              <ul className="space-y-2">
                {group.items.map((tk) => {
                  // Read through the override so a tick shows instantly.
                  const status = statusOf(tk);
                  return (
                  <Card as="li" key={tk.id} padded={false} className="p-3.5">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={status === 'completed'}
                        onClick={() => cycleStatus(tk)}
                        aria-label={status === 'completed' ? t.tasks.markTodo : t.tasks.markComplete}
                        // The visible box stays 20px; the tappable area around
                        // it does not, because a 20px target on a phone is a
                        // checkbox that misses more often than it lands.
                        style={{ padding: '6px', margin: '-6px' }}
                        className={cx(
                          'mt-0.5 w-5 h-5 box-content shrink-0 rounded-[6px] border-2 grid place-items-center transition-colors',
                          status === 'completed'
                            ? 'bg-[var(--positive)] border-[var(--positive)] text-white'
                            : status === 'in_progress'
                              ? 'border-[var(--accent)] text-[var(--accent)]'
                              : 'border-[var(--border-strong)] hover:border-[var(--accent)]',
                        )}
                      >
                        {status === 'completed' ? <Icon.check size={13} /> : null}
                        {status === 'in_progress' ? (
                          <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                        ) : null}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className={cx('text-sm font-medium leading-snug', status === 'completed' && 'line-through text-[var(--text-muted)]')}>
                          {tk.title}
                        </p>
                        {tk.description ? (
                          <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{tk.description}</p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <Badge tone={tk.priority === 'high' ? 'danger' : tk.priority === 'medium' ? 'warning' : 'neutral'}>
                            {t.tasks[tk.priority]}
                          </Badge>
                          {tk.course_id && courseCodes[tk.course_id] ? (
                            <Badge>{courseCodes[tk.course_id]}</Badge>
                          ) : null}
                          {tk.due_date ? (
                            <span className="text-xs text-[var(--text-muted)] tabular-nums">{formatDate(tk.due_date)}</span>
                          ) : null}
                          {tk.estimated_minutes ? (
                            <span className="text-xs text-[var(--text-muted)]">
                              {tk.estimated_minutes} {t.common.minutes}
                            </span>
                          ) : null}
                          {tk.source === 'ai' ? (
                            <span className="text-xs text-[var(--accent-soft-text)]">{t.common.ai}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex gap-0.5 shrink-0 -me-1.5 -mt-1">
                        <button
                          type="button"
                          onClick={() => { setEditing(tk); setFormOpen(true); }}
                          aria-label={`${t.common.edit} ${tk.title}`}
                          className="w-9 h-9 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
                        >
                          <Icon.edit size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(tk)}
                          aria-label={`${t.common.delete} ${tk.title}`}
                          className="w-9 h-9 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                        >
                          <Icon.trash size={15} />
                        </button>
                      </div>
                    </div>
                  </Card>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <TaskFormModal
        open={formOpen}
        task={editing}
        courseOptions={courseOptions}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t.tasks.deleteConfirm}
        body={deleting?.title ?? t.tasks.deleteBody}
        onConfirm={async () => {
          if (!deleting) return;
          const result = await deleteTask(deleting.id);
          if (result.ok) toast.success(actionMessage(t, result.messageKey));
          else toast.error(actionMessage(t, result.messageKey));
          setDeleting(null);
          router.refresh();
        }}
      />
    </>
  );
}

function TaskFormModal({
  open, onClose, task, courseOptions, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  courseOptions: Array<{ value: string; label: string }>;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();

  const [state, action, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveTask(prev, formData);
      if (result.ok) {
        toast.success(actionMessage(t, result.messageKey));
        onSaved();
        onClose();
      } else if (result.messageKey) {
        toast.error(actionMessage(t, result.messageKey));
      }
      return result;
    },
    EMPTY,
  );

  return (
    <Modal open={open} onClose={onClose} title={task ? t.tasks.editTask : t.tasks.newTask}>
      <form action={action} className="space-y-4">
        {task ? <input type="hidden" name="id" value={task.id} /> : null}

        <TextInput
          label={t.tasks.taskTitle} name="title" required
          defaultValue={task?.title} error={state.errors?.title}
        />
        <TextArea
          label={t.tasks.description} name="description"
          defaultValue={task?.description ?? ''} rows={2}
        />
        <Select
          label={t.common.course} name="course_id"
          options={courseOptions} placeholder={t.common.noCourse}
          defaultValue={task?.course_id ?? ''}
        />

        <div className="grid sm:grid-cols-3 gap-4">
          <Select
            label={t.common.priority} name="priority"
            options={[
              { value: 'low', label: t.tasks.low },
              { value: 'medium', label: t.tasks.medium },
              { value: 'high', label: t.tasks.high },
            ]}
            defaultValue={task?.priority ?? 'medium'}
          />
          <TextInput
            label={t.common.dueDate} name="due_date" type="date"
            defaultValue={task?.due_date ?? ''}
          />
          <TextInput
            label={t.tasks.estimated} name="estimated_minutes" type="number"
            min="1" max="1440" defaultValue={task?.estimated_minutes ?? ''}
          />
        </div>

        <Select
          label={t.common.status} name="status"
          options={[
            { value: 'todo', label: t.tasks.todo },
            { value: 'in_progress', label: t.tasks.inProgress },
            { value: 'completed', label: t.tasks.completedLabel },
          ]}
          defaultValue={task?.status ?? 'todo'}
        />

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button type="submit" loading={pending} loadingLabel={t.common.saving}>{t.common.save}</Button>
        </div>
      </form>
    </Modal>
  );
}
