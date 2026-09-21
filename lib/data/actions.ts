'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from './queries';
import {
  courseSchema, gradeSchema, taskSchema, profileSchema, gradeScaleSchema,
  noteItemSchema, fieldErrors,
} from '@/lib/validation/schemas';
import { cleanCourseCode } from '@/lib/validation/cleaning';
import { parseDesign } from '@/lib/notes/design';
import { workflowBuildReminders, agentContext } from '@/lib/workflows';
import { recordActivity } from '@/lib/momentum/record';
import type { RecordResult } from '@/lib/momentum/record';
import type { Note, NoteItem } from '@/types/database';

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

/**
 * Add a course to the planner's candidate list.
 *
 * The list was whatever the student already had recorded, so a course they
 * were *considering* — the whole point of a planner — had nowhere to go, and
 * the list looked fixed. This writes a `planned` course, which is the same
 * record the rest of the app already understands rather than a second kind of
 * thing that only the planner knows about.
 */
export async function addPlannerCandidate(input: {
  code: string;
  name: string;
  credits: number;
  difficulty?: number | null;
  semester?: string | null;
}): Promise<ActionState & { id?: string }> {
  try {
    const code = input.code.trim().slice(0, 20).toUpperCase();
    const name = input.name.trim().slice(0, 200);
    if (!code || !name) return { ok: false, messageKey: 'generic' };

    const credits = Number(input.credits);
    if (!Number.isFinite(credits) || credits < 0 || credits > 30) {
      return { ok: false, messageKey: 'generic' };
    }

    const supabase = await createClient();
    const userId = await requireUserId();

    const { data, error } = await supabase
      .from('courses')
      .insert({
        user_id: userId,
        course_code: code,
        course_name: name,
        credits,
        difficulty: input.difficulty ?? null,
        semester: input.semester?.trim().slice(0, 100) || null,
        status: 'planned',
        source: 'manual',
      })
      .select('id')
      .single();

    if (error) {
      // There is a unique index on (user_id, course code, semester). Saying
      // "something went wrong" for that reads as "this screen cannot add
      // courses", which is exactly the wrong conclusion: the course is
      // already there, and naming the collision is what lets them fix it.
      return error.code === '23505'
        ? { ok: false, messageKey: 'duplicateCourse' }
        : GENERIC;
    }
    if (!data) return GENERIC;
    revalidatePath('/planner');
    revalidatePath('/courses');
    return { ok: true, id: (data as { id: string }).id };
  } catch {
    return GENERIC;
  }
}

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

    // Entering a mark is the act that keeps the record useful, so it counts.
    if (parsed.data.score !== null && parsed.data.score !== undefined) {
      await recordActivity(supabase, userId, { kind: 'grade' });
    }

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
  timezoneOffsetMinutes?: number,
): Promise<ActionState & { momentum?: RecordResult | null }> {
  try {
    const supabase = await createClient();

    // Read first: the XP a task is worth depends on its priority and whether
    // it is being finished on time.
    const { data: before } = await supabase
      .from('tasks')
      .select('status, priority, due_date')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase
      .from('tasks')
      .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) return GENERIC;

    // Only the transition into completed earns anything, so toggling a task
    // back and forth cannot farm points.
    let momentum: RecordResult | null = null;
    if (status === 'completed' && before && before.status !== 'completed') {
      const userId = await requireUserId();
      const today = new Date().toISOString().slice(0, 10);
      momentum = await recordActivity(
        supabase,
        userId,
        {
          kind: 'task',
          highPriority: before.priority === 'high',
          onTime: !before.due_date || before.due_date >= today,
        },
        { timezoneOffsetMinutes },
      );
    }

    revalidatePath('/tasks');
    revalidatePath('/dashboard');
    revalidatePath('/momentum');
    return { ok: true, momentum };
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

/**
 * A reminder the student wrote themselves: a day, a label, and a time.
 *
 * The calendar's button used to run the AI reminder builder, which reads
 * upcoming assessments and invents a revision ramp. That is a different
 * feature with the same word on it, and with no model configured it simply
 * failed — so "remind me about this on Thursday at 6" had nowhere to go.
 */
export async function addReminder(input: {
  title: string;
  remindOn: string;
  remindAt?: string | null;
  courseId?: string | null;
  body?: string | null;
}): Promise<ActionState> {
  try {
    const title = input.title.trim().slice(0, 200);
    if (!title) return { ok: false, messageKey: 'generic' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.remindOn)) return { ok: false, messageKey: 'generic' };

    const at = input.remindAt?.trim();
    if (at && !/^([01]\d|2[0-3]):[0-5]\d$/.test(at)) return { ok: false, messageKey: 'generic' };

    const supabase = await createClient();
    const userId = await requireUserId();

    const { error } = await supabase.from('reminders').insert({
      user_id: userId,
      course_id: input.courseId || null,
      title,
      body: input.body?.trim().slice(0, 1000) || null,
      remind_on: input.remindOn,
      remind_at: at || null,
      status: 'scheduled',
      source: 'manual',
    });

    if (error) return GENERIC;
    revalidatePath('/calendar');
    return { ok: true };
  } catch {
    return GENERIC;
  }
}

/** Move a reminder to another day or hour. */
export async function updateReminder(
  id: string,
  patch: { title?: string; remindOn?: string; remindAt?: string | null },
): Promise<ActionState> {
  try {
    const update: Record<string, unknown> = {};
    if (typeof patch.title === 'string') {
      const title = patch.title.trim().slice(0, 200);
      if (!title) return { ok: false, messageKey: 'generic' };
      update.title = title;
    }
    if (typeof patch.remindOn === 'string') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(patch.remindOn)) return { ok: false, messageKey: 'generic' };
      update.remind_on = patch.remindOn;
    }
    if (patch.remindAt !== undefined) {
      const at = patch.remindAt?.trim() ?? '';
      if (at && !/^([01]\d|2[0-3]):[0-5]\d$/.test(at)) return { ok: false, messageKey: 'generic' };
      update.remind_at = at || null;
    }
    if (Object.keys(update).length === 0) return { ok: true };

    const supabase = await createClient();
    const { error } = await supabase.from('reminders').update(update).eq('id', id);
    if (error) return GENERIC;
    revalidatePath('/calendar');
    return { ok: true };
  } catch {
    return GENERIC;
  }
}

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
  raw.momentum_enabled = formData.get('momentum_enabled') === 'on';
  raw.leaderboard_opt_in = formData.get('leaderboard_opt_in') === 'on';
  raw.leaderboard_show_name = formData.get('leaderboard_show_name') === 'on';

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

// --- Notes -------------------------------------------------------------------
//
// These are called as the student types rather than on a form submit, so each
// one does the smallest possible write and returns the row the screen needs to
// keep its local copy honest. `revalidatePath` is deliberately limited to the
// operations that change the shape of the page — re-rendering mid-keystroke
// would take the cursor with it.

export async function createNote(title = ''): Promise<ActionState & { note?: Note }> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId();

    // New notes go to the top, which is where a student looks for the one they
    // just made.
    const { data: first } = await supabase
      .from('notes')
      .select('position')
      .eq('user_id', userId)
      .order('position')
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabase
      .from('notes')
      .insert({ user_id: userId, title: title.slice(0, 200), position: (first?.position ?? 0) - 1 })
      .select('*')
      .single();

    if (error) return { ok: false, messageKey: 'noteSaveError' };

    revalidatePath('/notes');
    return { ok: true, note: data as Note };
  } catch {
    return GENERIC;
  }
}

export async function renameNote(id: string, title: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('notes')
      .update({ title: title.slice(0, 200) })
      .eq('id', id);
    if (error) return { ok: false, messageKey: 'noteSaveError' };
    return { ok: true };
  } catch {
    return GENERIC;
  }
}

/**
 * The look of a note: its paper, its tint, and where the stickers sit.
 *
 * Everything is validated against the fixed lists before it is written, so the
 * columns can only ever hold keys the stylesheet knows. The database has the
 * same rule as a check constraint — this is the friendly half of it, not the
 * only half.
 */
export async function setNoteDesign(
  id: string,
  design: { pattern: string; tint: string; stickers: unknown },
): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const clean = parseDesign({
      theme: design.pattern, color: design.tint, stickers: design.stickers,
    });

    const { error } = await supabase
      .from('notes')
      .update({
        theme: clean.pattern,
        color: clean.tint,
        stickers: clean.stickers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) return { ok: false, messageKey: 'noteSaveError' };

    revalidatePath('/notes');
    return { ok: true };
  } catch {
    return GENERIC;
  }
}

/**
 * Pin a note to the home screen, or unpin it.
 *
 * Its own action rather than a field on the design one: this is the student
 * saying where a note belongs, and it should not travel with a debounced
 * write that exists to batch up typing.
 */
export async function setNoteOnHome(id: string, onHome: boolean): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('notes')
      .update({ show_on_home: onHome, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { ok: false, messageKey: 'noteSaveError' };

    revalidatePath('/notes');
    revalidatePath('/dashboard');
    return { ok: true };
  } catch {
    return GENERIC;
  }
}

export async function deleteNote(id: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    // The lines go with it through the foreign key, not by a second delete.
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) return GENERIC;
    revalidatePath('/notes');
    revalidatePath('/dashboard');
    return { ok: true, messageKey: 'noteDeleted' };
  } catch {
    return GENERIC;
  }
}

export async function addNoteItem(
  noteId: string,
  afterPosition?: number,
): Promise<ActionState & { item?: NoteItem }> {
  try {
    const supabase = await createClient();
    const userId = await requireUserId();

    // A new line lands directly under the one it was added from, so pressing
    // Enter halfway down a list does not send the line to the bottom.
    let position: number;
    if (afterPosition === undefined) {
      const { data: last } = await supabase
        .from('note_items')
        .select('position')
        .eq('note_id', noteId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();
      position = (last?.position ?? -1) + 1;
    } else {
      position = afterPosition + 1;
      // Make room rather than colliding: everything below shifts down one.
      const { data: below } = await supabase
        .from('note_items')
        .select('id, position')
        .eq('note_id', noteId)
        .gte('position', position)
        .order('position');
      for (const row of below ?? []) {
        await supabase.from('note_items').update({ position: row.position + 1 }).eq('id', row.id);
      }
    }

    const { data, error } = await supabase
      .from('note_items')
      .insert({ user_id: userId, note_id: noteId, position })
      .select('*')
      .single();

    if (error) return { ok: false, messageKey: 'noteSaveError' };
    return { ok: true, item: data as NoteItem };
  } catch {
    return GENERIC;
  }
}

export async function updateNoteItem(
  id: string,
  patch: { content?: string; remind_at?: string | null },
): Promise<ActionState> {
  const parsed = noteItemSchema.partial().safeParse(patch);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('note_items').update(parsed.data).eq('id', id);
    if (error) return { ok: false, messageKey: 'noteSaveError' };

    // A changed reminder is worth reflecting elsewhere; a changed word is not.
    if (patch.remind_at !== undefined) {
      revalidatePath('/notes');
      revalidatePath('/dashboard');
    }
    return { ok: true };
  } catch {
    return GENERIC;
  }
}

export async function setNoteItemDone(id: string, done: boolean): Promise<ActionState> {
  try {
    const supabase = await createClient();
    // completed_at moves with is_done, which the table also insists on.
    const { error } = await supabase
      .from('note_items')
      .update({ is_done: done, completed_at: done ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) return GENERIC;
    revalidatePath('/dashboard');
    return { ok: true };
  } catch {
    return GENERIC;
  }
}

export async function deleteNoteItem(id: string): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('note_items').delete().eq('id', id);
    if (error) return GENERIC;
    return { ok: true };
  } catch {
    return GENERIC;
  }
}

// --- Generic row delete for the Records screen -------------------------------

const DELETABLE = [
  'courses', 'grades', 'tasks', 'syllabi', 'syllabus_events', 'reminders',
  'study_sessions', 'questions', 'schedules', 'ai_runs', 'cleaning_log',
  'activity_days', 'achievements', 'notes', 'note_items',
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
