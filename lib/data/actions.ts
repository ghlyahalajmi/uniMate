'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from './queries';
import {
  courseSchema, gradeSchema, taskSchema, profileSchema, gradeScaleSchema, fieldErrors,
} from '@/lib/validation/schemas';
import { cleanCourseCode } from '@/lib/validation/cleaning';
import { workflowBuildReminders, agentContext } from '@/lib/workflows';

export interface ActionState {
  ok?: boolean;
  /** Dictionary key, resolved to copy on the client. */
  messageKey?: string;
  errors?: Record<string, string>;
}

const GENERIC: ActionState = { ok: false, messageKey: 'generic' };

function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key === 'days') continue;
    out[key] = value === '' ? undefined : value;
  }
  const days = formData.getAll('days').map(String).filter(Boolean);
  if (days.length) out.days = days;
  else if (formData.has('days_present')) out.days = [];
  return out;
}

// --- Courses -----------------------------------------------------------------

export async function saveCourse(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formToObject(formData);
  const id = formData.get('id') ? String(formData.get('id')) : null;

  // Normalise the code before validating, and record why if it changed.
  const codeInput = String(raw.course_code ?? '');
  const cleaned = cleanCourseCode(codeInput);
  raw.course_code = cleaned.value;

  const parsed = courseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  try {
    const supabase = await createClient();
    const userId = await requireUserId();
    const payload = { ...parsed.data, user_id: userId };

    const { data, error } = id
      ? await supabase.from('courses').update(payload).eq('id', id).select('id').single()
      : await supabase.from('courses').insert(payload).select('id').single();

    if (error) {
      // 23505 = unique violation on (user, code, semester)
      if (error.code === '23505') {
        return { ok: false, errors: { course_code: 'duplicate' } };
      }
      return { ok: false, messageKey: 'courseSaveError' };
    }

    if (cleaned.decisions.length && data) {
      await supabase.from('cleaning_log').insert(
        cleaned.decisions.map((d) => ({
          user_id: userId,
          table_name: 'courses',
          record_id: data.id,
          field_name: d.field,
          original_value: d.original,
          cleaned_value: d.cleaned,
          reason: d.reason,
        })),
      );
    }

    revalidatePath('/courses');
    revalidatePath('/dashboard');
    return { ok: true, messageKey: 'courseSaved' };
  } catch {
    return GENERIC;
  }
}

export async function deleteCourse(id: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) return GENERIC;
    revalidatePath('/courses');
    revalidatePath('/dashboard');
    return { ok: true, messageKey: 'courseDeleted' };
  } catch {
    return GENERIC;
  }
}

// --- Assessments -------------------------------------------------------------

export async function saveGrade(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formToObject(formData);
  const id = formData.get('id') ? String(formData.get('id')) : null;

  const parsed = gradeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  try {
    const supabase = await createClient();
    const userId = await requireUserId();
    const payload = { ...parsed.data, user_id: userId };

    const { error } = id
      ? await supabase.from('grades').update(payload).eq('id', id)
      : await supabase.from('grades').insert(payload);

    if (error) return { ok: false, messageKey: 'gradeSaveError' };

    revalidatePath('/grades');
    revalidatePath('/dashboard');
    revalidatePath(`/courses/${parsed.data.course_id}`);
    return { ok: true, messageKey: 'gradeSaved' };
  } catch {
    return GENERIC;
  }
}

export async function deleteGrade(id: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('grades').delete().eq('id', id);
    if (error) return GENERIC;
    revalidatePath('/grades');
    revalidatePath('/dashboard');
    return { ok: true, messageKey: 'gradeDeleted' };
  } catch {
    return GENERIC;
  }
}

export async function setCourseTarget(courseId: string, target: string | null): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('courses').update({ target_grade: target }).eq('id', courseId);
    if (error) return GENERIC;
    revalidatePath('/grades');
    revalidatePath(`/courses/${courseId}`);
    return { ok: true };
  } catch {
    return GENERIC;
  }
}

// --- Tasks -------------------------------------------------------------------

export async function saveTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formToObject(formData);
  const id = formData.get('id') ? String(formData.get('id')) : null;

  const parsed = taskSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  try {
    const supabase = await createClient();
    const userId = await requireUserId();
    const payload = {
      ...parsed.data,
      user_id: userId,
      completed_at: parsed.data.status === 'completed' ? new Date().toISOString() : null,
    };

    const { error } = id
      ? await supabase.from('tasks').update(payload).eq('id', id)
      : await supabase.from('tasks').insert(payload);

    if (error) return { ok: false, messageKey: 'taskSaveError' };

    revalidatePath('/tasks');
    revalidatePath('/dashboard');
    return { ok: true, messageKey: 'taskSaved' };
  } catch {
    return GENERIC;
  }
}

export async function setTaskStatus(
  id: string,
  status: 'todo' | 'in_progress' | 'completed',
): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('tasks')
      .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) return GENERIC;
    revalidatePath('/tasks');
    revalidatePath('/dashboard');
    return { ok: true };
  } catch {
    return GENERIC;
  }
}

export async function deleteTask(id: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) return GENERIC;
    revalidatePath('/tasks');
    revalidatePath('/dashboard');
    return { ok: true, messageKey: 'taskDeleted' };
  } catch {
    return GENERIC;
  }
}

// --- Reminders ---------------------------------------------------------------

export async function setReminderStatus(
  id: string,
  status: 'scheduled' | 'done' | 'dismissed',
): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('reminders').update({ status }).eq('id', id);
    if (error) return GENERIC;
    revalidatePath('/calendar');
    return { ok: true };
  } catch {
    return GENERIC;
  }
}

export async function deleteReminder(id: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('reminders').delete().eq('id', id);
    if (error) return GENERIC;
    revalidatePath('/calendar');
    return { ok: true };
  } catch {
    return GENERIC;
  }
}

export async function rebuildReminders(): Promise<ActionState & { created?: number }> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId();
    const result = await workflowBuildReminders(agentContext(supabase, userId), 90);
    revalidatePath('/calendar');
    return result.ok
      ? { ok: true, created: result.data?.created ?? 0 }
      : { ok: false, messageKey: 'generic' };
  } catch {
    return GENERIC;
  }
}

// --- Profile and settings ----------------------------------------------------

export async function saveProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formToObject(formData);
  raw.reminders_enabled = formData.get('reminders_enabled') === 'on';

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  try {
    const supabase = await createClient();
    const userId = await requireUserId();
    const { error } = await supabase
      .from('profiles').update(parsed.data).eq('user_id', userId);
    if (error) return { ok: false, messageKey: 'settingsSaveError' };

    revalidatePath('/settings');
    revalidatePath('/dashboard');
    return { ok: true, messageKey: 'settingsSaved' };
  } catch {
    return GENERIC;
  }
}

export async function completeOnboarding(payload: {
  full_name: string;
  university: string | null;
  major: string | null;
  academic_year: string | null;
  target_gpa: number | null;
  preferred_study_minutes: number;
  study_availability: string | null;
  preferred_language: 'en' | 'ar';
}): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId();
    const { error } = await supabase
      .from('profiles')
      .update({ ...payload, onboarding_completed: true })
      .eq('user_id', userId);
    if (error) return GENERIC;
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch {
    return GENERIC;
  }
}

export async function saveGradeScale(
  entries: Array<{ letter: string; min_percent: number; points: number }>,
): Promise<ActionState> {
  const parsed = gradeScaleSchema.safeParse({ entries });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  try {
    const supabase = await createClient();
    const userId = await requireUserId();

    // Replace wholesale: the scale is one object, not a set of independent rows.
    await supabase.from('grade_scale_entries').delete().eq('user_id', userId);
    const { error } = await supabase.from('grade_scale_entries').insert(
      parsed.data.entries
        .sort((a, b) => b.min_percent - a.min_percent)
        .map((e, i) => ({ ...e, user_id: userId, sort_order: i + 1 })),
    );
    if (error) return GENERIC;

    revalidatePath('/grades');
    revalidatePath('/dashboard');
    return { ok: true, messageKey: 'scaleSaved' };
  } catch {
    return GENERIC;
  }
}

// --- Generic row delete for the Records screen -------------------------------

const DELETABLE = [
  'courses', 'grades', 'tasks', 'syllabi', 'syllabus_events', 'reminders',
  'study_sessions', 'questions', 'schedules', 'ai_runs', 'cleaning_log',
] as const;

export type DeletableTable = (typeof DELETABLE)[number];

export async function deleteRecord(table: DeletableTable, id: string): Promise<ActionState> {
  if (!DELETABLE.includes(table)) return GENERIC;
  try {
    const supabase = await createClient();
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return GENERIC;
    revalidatePath('/records');
    return { ok: true };
  } catch {
    return GENERIC;
  }
}
