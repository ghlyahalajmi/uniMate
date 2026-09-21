'use client';

import { useActionState, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Button } from '@/components/ui/primitives';
import { TextInput, Select, Field } from '@/components/ui/form';
import { Modal, useToast } from '@/components/ui/toast';
import { saveCourse, type ActionState } from '@/lib/data/actions';
import { actionMessage } from '@/lib/i18n/action-messages';
import type { Course, Weekday } from '@/types/database';

const WEEKDAYS: Weekday[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

const EMPTY: ActionState = {};

export function CourseFormModal({
  open, onClose, course, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  course?: Course | null;
  onSaved?: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [days, setDays] = useState<Weekday[]>(course?.days ?? []);

  const [state, action, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveCourse(prev, formData);
      if (result.ok) {
        toast.success(actionMessage(t, result.messageKey));
        onSaved?.();
        onClose();
      } else if (result.messageKey) {
        toast.error(actionMessage(t, result.messageKey));
      }
      return result;
    },
    EMPTY,
  );

  const statusOptions = [
    { value: 'active', label: t.courses.active },
    { value: 'completed', label: t.courses.completed },
    { value: 'planned', label: t.courses.planned },
    { value: 'withdrawn', label: t.courses.withdrawn },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={course ? t.courses.editCourse : t.courses.newCourse}
      size="lg"
    >
      <form action={action} className="space-y-4">
        {course ? <input type="hidden" name="id" value={course.id} /> : null}
        <input type="hidden" name="days_present" value="1" />

        <div className="grid sm:grid-cols-2 gap-4">
          <TextInput
            label={t.courses.code} name="course_code" required
            defaultValue={course?.course_code} placeholder="CE301"
            error={state.errors?.course_code}
          />
          <TextInput
            label={t.courses.creditsLabel} name="credits" type="number"
            step="0.5" min="0" max="24" required
            defaultValue={course?.credits ?? 3}
            error={state.errors?.credits}
          />
        </div>

        <TextInput
          label={t.courses.name} name="course_name" required
          defaultValue={course?.course_name}
          error={state.errors?.course_name}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <TextInput
            label={t.courses.instructor} name="instructor"
            defaultValue={course?.instructor ?? ''}
            error={state.errors?.instructor}
          />
          <TextInput
            label={t.courses.semester} name="semester"
            defaultValue={course?.semester ?? ''} placeholder="Fall 2026"
          />
        </div>

        {/* Who teaches it, and how to reach them. Filled in automatically when
            the course came from a syllabus; editable here either way. */}
        <fieldset className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-4 space-y-4">
          <legend className="px-1.5 text-[0.8125rem] font-medium">{t.contacts.instructor}</legend>
          <div className="grid sm:grid-cols-3 gap-4">
            <TextInput
              label={t.contacts.email} name="instructor_email" type="email"
              defaultValue={course?.instructor_email ?? ''} placeholder="name@university.edu"
              error={state.errors?.instructor_email}
            />
            <TextInput
              label={t.contacts.office} name="instructor_office"
              defaultValue={course?.instructor_office ?? ''} placeholder="Block 2, Room 114"
            />
            <TextInput
              label={t.contacts.officeHours} name="instructor_office_hours"
              defaultValue={course?.instructor_office_hours ?? ''} placeholder="Sun & Tue 10:00–11:30"
            />
          </div>
        </fieldset>

        <fieldset className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-4 space-y-4">
          <legend className="px-1.5 text-[0.8125rem] font-medium">{t.contacts.ta}</legend>
          <TextInput
            label={t.contacts.name} name="ta_name"
            defaultValue={course?.ta_name ?? ''} hint={t.common.optional}
          />
          <div className="grid sm:grid-cols-3 gap-4">
            <TextInput
              label={t.contacts.email} name="ta_email" type="email"
              defaultValue={course?.ta_email ?? ''} placeholder="name@university.edu"
              error={state.errors?.ta_email}
            />
            <TextInput
              label={t.contacts.office} name="ta_office"
              defaultValue={course?.ta_office ?? ''}
            />
            <TextInput
              label={t.contacts.officeHours} name="ta_office_hours"
              defaultValue={course?.ta_office_hours ?? ''}
            />
          </div>
        </fieldset>

        <Field label={t.courses.daysLabel}>
          {() => (
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => {
                const on = days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDays((prev) => (on ? prev.filter((x) => x !== d) : [...prev, d]))}
                    className={
                      'px-3 min-h-[38px] rounded-[var(--radius-sm)] text-[0.8125rem] font-medium border transition-colors ' +
                      (on
                        ? 'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]')
                    }
                  >
                    {t.weekdaysShort[d]}
                  </button>
                );
              })}
              {days.map((d) => (<input key={d} type="hidden" name="days" value={d} />))}
            </div>
          )}
        </Field>

        <div className="grid sm:grid-cols-3 gap-4">
          <TextInput
            label={t.courses.startTime} name="start_time" type="time"
            defaultValue={course?.start_time?.slice(0, 5) ?? ''}
            error={state.errors?.start_time}
          />
          <TextInput
            label={t.courses.endTime} name="end_time" type="time"
            defaultValue={course?.end_time?.slice(0, 5) ?? ''}
            error={state.errors?.end_time}
          />
          <TextInput
            label={t.courses.room} name="room"
            defaultValue={course?.room ?? ''} placeholder="Room 204"
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <Select
            label={t.courses.statusLabel} name="status"
            options={statusOptions} defaultValue={course?.status ?? 'active'}
          />
          <TextInput
            label={t.courses.difficulty} name="difficulty" type="number"
            min="1" max="5" hint={t.courses.difficultyHint}
            defaultValue={course?.difficulty ?? ''}
          />
          <TextInput
            label={t.courses.targetGrade} name="target_grade"
            defaultValue={course?.target_grade ?? ''} placeholder="A-"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <TextInput
            label={t.courses.finalGrade} name="final_grade"
            defaultValue={course?.final_grade ?? ''} placeholder="B+"
            hint={t.courses.completed}
          />
          <TextInput
            label={t.grades.points} name="final_points" type="number"
            step="0.01" min="0" max="5"
            defaultValue={course?.final_points ?? ''}
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button type="submit" loading={pending} loadingLabel={t.common.saving}>{t.common.save}</Button>
        </div>
      </form>
    </Modal>
  );
}
