'use client';

import { useActionState, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Button, Card, CardHeader, cx } from '@/components/ui/primitives';
import { TextInput, Select } from '@/components/ui/form';
import { Modal, useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm';
import { EmptyState } from '@/components/ui/states';
import { Icon } from '@/components/shell/icons';
import { saveGrade, deleteGrade, type ActionState } from '@/lib/data/actions';
import { actionMessage } from '@/lib/i18n/action-messages';
import type { AssessmentType, Grade } from '@/types/database';

const EMPTY: ActionState = {};
const TYPES: AssessmentType[] = [
  'quiz','assignment','midterm','final','project','lab','participation','presentation','other',
];

/**
 * A real table on desktop; the same rows become cards on a phone, because a
 * seven-column table does not survive a 320px viewport.
 */
export function AssessmentTable({
  courseId, grades, weightTotal, onChanged,
}: {
  courseId: string;
  grades: Grade[];
  weightTotal: number;
  onChanged: () => void;
}) {
  const { t, tf, formatNumber, formatDate } = useI18n();
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Grade | null>(null);
  const [deleting, setDeleting] = useState<Grade | null>(null);

  return (
    <>
      <Card>
        <CardHeader
          title={t.courseDetail.assessments}
          subtitle={tf(t.courseDetail.weightTotal, { n: formatNumber(weightTotal) })}
          action={
            <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Icon.plus size={16} />
              <span className="hidden sm:inline">{t.courseDetail.addAssessment}</span>
            </Button>
          }
        />

        {grades.length === 0 ? (
          <EmptyState
            compact
            title={t.courseDetail.assessments}
            body={t.courseDetail.noAssessments}
            action={
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Icon.plus size={17} />
                {t.courseDetail.addAssessment}
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <caption className="sr-only">{t.courseDetail.assessments}</caption>
                <thead>
                  <tr className="text-start border-b border-[var(--border-subtle)]">
                    <Th>{t.grades.assessmentName}</Th>
                    <Th>{t.grades.assessmentType}</Th>
                    <Th numeric>{t.common.weight}</Th>
                    <Th numeric>{t.common.score}</Th>
                    <Th numeric>%</Th>
                    <Th>{t.common.dueDate}</Th>
                    <Th><span className="sr-only">{t.common.actions}</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g) => {
                    const pct = g.score === null ? null : (Number(g.score) / Number(g.max_score)) * 100;
                    return (
                      <tr key={g.id} className="border-b border-[var(--border-subtle)] last:border-0">
                        <td className="py-2.5 pe-3 font-medium">{g.assessment_name}</td>
                        <td className="py-2.5 pe-3 text-[var(--text-secondary)]">{t.assessmentTypes[g.assessment_type]}</td>
                        <td className="py-2.5 pe-3 text-end tabular-nums">{formatNumber(g.weight)}%</td>
                        <td className="py-2.5 pe-3 text-end tabular-nums">
                          {g.score === null
                            ? <span className="text-[var(--text-muted)]">{t.grades.notCompleted}</span>
                            : `${formatNumber(g.score)} / ${formatNumber(g.max_score)}`}
                        </td>
                        <td className="py-2.5 pe-3 text-end tabular-nums">
                          {pct === null ? '—' : `${formatNumber(Math.round(pct * 10) / 10)}%`}
                        </td>
                        <td className="py-2.5 pe-3 text-[var(--text-secondary)] whitespace-nowrap">
                          {g.due_date ? formatDate(g.due_date) : '—'}
                        </td>
                        <td className="py-2.5 text-end whitespace-nowrap">
                          <RowActions
                            onEdit={() => { setEditing(g); setFormOpen(true); }}
                            onDelete={() => setDeleting(g)}
                            label={g.assessment_name}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="sm:hidden space-y-2.5">
              {grades.map((g) => {
                const pct = g.score === null ? null : (Number(g.score) / Number(g.max_score)) * 100;
                return (
                  <li
                    key={g.id}
                    className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{g.assessment_name}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {t.assessmentTypes[g.assessment_type]} · {formatNumber(g.weight)}%
                          {g.due_date ? ` · ${formatDate(g.due_date)}` : ''}
                        </p>
                      </div>
                      <RowActions
                        onEdit={() => { setEditing(g); setFormOpen(true); }}
                        onDelete={() => setDeleting(g)}
                        label={g.assessment_name}
                      />
                    </div>
                    <p className="text-sm tabular-nums mt-2">
                      {g.score === null ? (
                        <span className="text-[var(--text-muted)]">{t.grades.notCompleted}</span>
                      ) : (
                        <>
                          {formatNumber(g.score)} / {formatNumber(g.max_score)}
                          <span className="text-[var(--text-secondary)] ms-2">
                            {formatNumber(Math.round((pct ?? 0) * 10) / 10)}%
                          </span>
                        </>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {Math.abs(weightTotal - 100) > 0.01 && grades.length > 0 ? (
          <p className="text-xs text-[var(--warning)] mt-4 flex items-start gap-1.5">
            <span aria-hidden="true">⚠</span>
            <span>{tf(t.courseDetail.weightWarning, { n: formatNumber(weightTotal) })}</span>
          </p>
        ) : null}
      </Card>

      <AssessmentFormModal
        open={formOpen}
        courseId={courseId}
        grade={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={onChanged}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t.common.delete}
        body={deleting?.assessment_name ?? ''}
        onConfirm={async () => {
          if (!deleting) return;
          const result = await deleteGrade(deleting.id);
          if (result.ok) toast.success(actionMessage(t, result.messageKey));
          else toast.error(actionMessage(t, result.messageKey));
          setDeleting(null);
          onChanged();
        }}
      />
    </>
  );
}

function Th({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cx(
        'py-2 pe-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]',
        numeric ? 'text-end' : 'text-start',
      )}
    >
      {children}
    </th>
  );
}

function RowActions({
  onEdit, onDelete, label,
}: { onEdit: () => void; onDelete: () => void; label: string }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex gap-0.5">
      <button
        type="button" onClick={onEdit} aria-label={`${t.common.edit} ${label}`}
        className="w-8 h-8 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
      >
        <Icon.edit size={15} />
      </button>
      <button
        type="button" onClick={onDelete} aria-label={`${t.common.delete} ${label}`}
        className="w-8 h-8 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
      >
        <Icon.trash size={15} />
      </button>
    </span>
  );
}

export function AssessmentFormModal({
  open, onClose, courseId, grade, onSaved, courseOptions,
}: {
  open: boolean;
  onClose: () => void;
  courseId?: string;
  grade?: Grade | null;
  onSaved: () => void;
  courseOptions?: Array<{ value: string; label: string }>;
}) {
  const { t } = useI18n();
  const toast = useToast();

  const [state, action, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveGrade(prev, formData);
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
    <Modal open={open} onClose={onClose} title={grade ? t.common.edit : t.courseDetail.addAssessment}>
      <form action={action} className="space-y-4">
        {grade ? <input type="hidden" name="id" value={grade.id} /> : null}
        {courseId ? <input type="hidden" name="course_id" value={courseId} /> : null}

        {!courseId && courseOptions ? (
          <Select
            label={t.common.course} name="course_id" required
            options={courseOptions} placeholder={t.common.selectCourse}
            defaultValue={grade?.course_id}
            error={state.errors?.course_id}
          />
        ) : null}

        <TextInput
          label={t.grades.assessmentName} name="assessment_name" required
          defaultValue={grade?.assessment_name}
          error={state.errors?.assessment_name}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <Select
            label={t.grades.assessmentType} name="assessment_type"
            options={TYPES.map((v) => ({ value: v, label: t.assessmentTypes[v] }))}
            defaultValue={grade?.assessment_type ?? 'other'}
          />
          <TextInput
            label={`${t.common.weight} (%)`} name="weight" type="number"
            step="0.5" min="0" max="100" required
            defaultValue={grade?.weight}
            error={state.errors?.weight}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <TextInput
            label={t.common.score} name="score" type="number" step="0.01" min="0"
            defaultValue={grade?.score ?? ''}
            hint={t.grades.notCompleted}
            error={state.errors?.score}
          />
          <TextInput
            label={t.grades.maxScore} name="max_score" type="number" step="0.01" min="0.01" required
            defaultValue={grade?.max_score ?? 100}
            error={state.errors?.max_score}
          />
        </div>

        <TextInput
          label={t.common.dueDate} name="due_date" type="date"
          defaultValue={grade?.due_date ?? ''}
        />

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button type="submit" loading={pending} loadingLabel={t.common.saving}>{t.common.save}</Button>
        </div>
      </form>
    </Modal>
  );
}
