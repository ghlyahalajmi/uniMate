import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { requireUserId } from '@/lib/data/queries';
import { planApply, type ApplyPlan, type SyllabusEventLike, type ExistingAssessment } from './apply';

/**
 * Reading a syllabus into the rest of the app.
 *
 * `previewApply` and `applySyllabus` both go through `planApply`, so the list a
 * student confirms is produced by the same code that performs the write. They
 * cannot show one thing and do another.
 */

export interface SyllabusApplyPreview extends ApplyPlan {
  syllabusId: string;
  courseId: string | null;
  courseCode: string | null;
  /** True when there is no course to write to yet and one must be chosen. */
  needsCourse: boolean;
}

async function load(syllabusId: string, courseIdOverride?: string | null) {
  const supabase = await createClient();
  const userId = await requireUserId();

  const { data: syllabus } = await supabase
    .from('syllabi')
    .select('id, course_id, instructor, summary')
    .eq('id', syllabusId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!syllabus) return null;

  const courseId = courseIdOverride ?? syllabus.course_id;

  const [{ data: events }, { data: course }, { data: existing }] = await Promise.all([
    supabase
      .from('syllabus_events')
      .select('id, title, event_type, event_date, weight')
      .eq('syllabus_id', syllabusId)
      .eq('user_id', userId)
      .order('event_date', { nullsFirst: false }),
    courseId
      ? supabase.from('courses')
          .select('id, course_code, course_name, instructor')
          .eq('id', courseId).eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null }),
    courseId
      ? supabase.from('grades')
          .select('id, assessment_name, due_date, weight')
          .eq('course_id', courseId).eq('user_id', userId)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    supabase, userId, syllabus, courseId,
    events: (events as SyllabusEventLike[]) ?? [],
    course: course as { id: string; course_code: string; course_name: string; instructor: string | null } | null,
    existing: (existing as ExistingAssessment[]) ?? [],
  };
}

/** What applying this syllabus would change, without changing anything. */
export async function previewApply(
  syllabusId: string,
  courseIdOverride?: string | null,
): Promise<SyllabusApplyPreview | null> {
  const ctx = await load(syllabusId, courseIdOverride);
  if (!ctx) return null;

  const plan = planApply({
    events: ctx.events,
    existing: ctx.existing,
    extracted: { instructor: ctx.syllabus.instructor, courseName: null },
    course: {
      instructor: ctx.course?.instructor ?? null,
      course_name: ctx.course?.course_name ?? '',
    },
  });

  return {
    ...plan,
    syllabusId,
    courseId: ctx.courseId,
    courseCode: ctx.course?.course_code ?? null,
    needsCourse: !ctx.courseId,
  };
}

export interface ApplyResult {
  ok: boolean;
  created: number;
  updatedFields: number;
  reason?: 'not_found' | 'no_course' | 'save_failed';
}

/**
 * Writes the plan.
 *
 * The plan is recomputed here rather than taken from the client, so a stale or
 * tampered preview cannot cause a write the rules would not allow — the
 * duplicate check in particular runs against the course as it is right now.
 */
export async function applySyllabus(
  syllabusId: string,
  courseIdOverride?: string | null,
): Promise<ApplyResult> {
  const ctx = await load(syllabusId, courseIdOverride);
  if (!ctx) return { ok: false, created: 0, updatedFields: 0, reason: 'not_found' };
  if (!ctx.courseId || !ctx.course) {
    return { ok: false, created: 0, updatedFields: 0, reason: 'no_course' };
  }

  const plan = planApply({
    events: ctx.events,
    existing: ctx.existing,
    extracted: { instructor: ctx.syllabus.instructor, courseName: null },
    course: { instructor: ctx.course.instructor, course_name: ctx.course.course_name },
  });

  const { supabase, userId, courseId } = ctx;

  if (plan.create.length) {
    const { error } = await supabase.from('grades').insert(
      plan.create.map((a) => ({
        user_id: userId,
        course_id: courseId,
        assessment_name: a.assessment_name,
        assessment_type: a.assessment_type,
        weight: a.weight,
        due_date: a.due_date,
        // Marked as read from a document rather than typed, so the Records
        // screen can show where each row came from.
        source: 'ai' as const,
      })),
    );
    if (error) return { ok: false, created: 0, updatedFields: 0, reason: 'save_failed' };
  }

  if (plan.courseUpdates.length) {
    const patch: Record<string, string> = {};
    for (const u of plan.courseUpdates) patch[u.field] = u.to;
    await supabase.from('courses').update(patch).eq('id', courseId).eq('user_id', userId);
  }

  // Link the syllabus to the course it was applied to, so the connection is
  // visible afterwards rather than implied.
  if (ctx.syllabus.course_id !== courseId) {
    await supabase.from('syllabi').update({ course_id: courseId }).eq('id', syllabusId).eq('user_id', userId);
  }

  // Every change traceable to the document that caused it.
  const decisions = [
    ...plan.create.map((a) => ({
      user_id: userId,
      table_name: 'grades',
      record_id: null,
      field_name: 'assessment_name',
      original_value: null,
      cleaned_value: a.assessment_name,
      reason: `Read from the uploaded syllabus: ${a.assessment_type}, ${a.weight}% weight.`,
    })),
    ...plan.courseUpdates.map((u) => ({
      user_id: userId,
      table_name: 'courses',
      record_id: courseId,
      field_name: u.field,
      original_value: u.from,
      cleaned_value: u.to,
      reason: 'Filled from the uploaded syllabus because the field was empty.',
    })),
  ];
  if (decisions.length) {
    await supabase.from('cleaning_log').insert(decisions);
  }

  return { ok: true, created: plan.create.length, updatedFields: plan.courseUpdates.length };
}
