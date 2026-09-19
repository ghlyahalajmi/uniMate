import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runAgent, type AgentRunContext } from '@/lib/ai/run';
import {
  setupScanner, syllabusAnalyst, gradeCoach, studyReminderAgent,
  studyQuestionGenerator, taskPlanner, coursePlanner, academicAnalyst,
  type ScannedCourse, type StudyInput, type PlannerInput, type TaskPlannerInput,
} from '@/lib/ai/agents';
import { loadStudentContext } from '@/lib/ai/context';
import type { Weekday } from '@/types/database';

/**
 * Workflows compose agents with the database writes that follow them.
 *
 * Every one of them leaves an ai_runs row via runAgent, and any workflow that
 * normalises data also leaves cleaning_log rows. Nothing runs unlogged.
 *
 * These are also the seam for an external automation platform: each function
 * is a single call with a JSON-shaped input and output, so an n8n or webhook
 * trigger can drive the same code path the UI uses. See app/api/workflows.
 */

export interface WorkflowResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  runId: string | null;
}

// --- Workflow A — schedule scan ---------------------------------------------
// image → OCR/vision → extraction → normalisation → preview → (student confirms)
// → insertion → ai_runs + cleaning_log

export async function workflowScanTimetable(
  ctx: AgentRunContext,
  input: { data: string; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf' },
): Promise<WorkflowResult<{ courses: ScannedCourse[]; notes: string[]; cleaningPreview: number }>> {
  const outcome = await runAgent(setupScanner, input, ctx);
  if (!outcome.ok) return { ok: false, error: outcome.error, runId: outcome.runId };

  // The scan stops here on purpose. Rows are only written once the student
  // confirms them through confirmScannedCourses below.
  return {
    ok: true,
    runId: outcome.runId,
    data: {
      courses: outcome.data.courses,
      notes: outcome.data.notes,
      cleaningPreview: outcome.data.cleaning.length,
    },
  };
}

/** The student-confirmed half of Workflow A. This is what actually writes. */
export async function confirmScannedCourses(
  ctx: AgentRunContext,
  courses: Array<{
    course_code: string; course_name: string; instructor: string | null;
    credits: number | null; days: Weekday[]; start_time: string | null;
    end_time: string | null; room: string | null; semester: string | null;
  }>,
  cleaning: Array<{ field: string; original: string; cleaned: string; reason: string; courseCode: string }> = [],
): Promise<WorkflowResult<{ inserted: number }>> {
  if (!courses.length) return { ok: true, data: { inserted: 0 }, runId: null };

  const { data, error } = await ctx.supabase
    .from('courses')
    .insert(courses.map((c) => ({
      user_id: ctx.userId,
      course_code: c.course_code,
      course_name: c.course_name,
      instructor: c.instructor,
      credits: c.credits ?? 3,
      days: c.days,
      start_time: c.start_time,
      end_time: c.end_time,
      room: c.room,
      semester: c.semester,
      status: 'active' as const,
      source: 'ai' as const,
    })))
    .select('id, course_code');

  if (error) return { ok: false, error: error.message, runId: null };

  // Attach the cleaning decisions to the rows they produced.
  if (cleaning.length && data?.length) {
    const idByCode = new Map(data.map((r) => [r.course_code, r.id]));
    await ctx.supabase.from('cleaning_log').insert(
      cleaning.map((d) => ({
        user_id: ctx.userId,
        table_name: 'courses',
        record_id: idByCode.get(d.courseCode) ?? null,
        field_name: d.field,
        original_value: d.original,
        cleaned_value: d.cleaned,
        reason: d.reason,
      })),
    );
  }

  return { ok: true, data: { inserted: data?.length ?? 0 }, runId: null };
}

// --- Workflow B — syllabus processing ----------------------------------------
// upload → extract → analyse → identify dates and weights → store → reminders
// → ai_runs

export async function workflowProcessSyllabus(
  ctx: AgentRunContext,
  input: {
    syllabusId: string;
    courseId: string | null;
    courseHint?: string;
    document:
      | { kind: 'pdf'; data: string }
      | { kind: 'image'; mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; data: string }
      | { kind: 'text'; text: string };
  },
): Promise<WorkflowResult<{ events: number; topics: number }>> {
  await ctx.supabase
    .from('syllabi')
    .update({ processing_status: 'processing' })
    .eq('id', input.syllabusId)
    .eq('user_id', ctx.userId);

  const outcome = await runAgent(
    syllabusAnalyst,
    { document: input.document, courseHint: input.courseHint, today: todayIso() },
    ctx,
  );

  if (!outcome.ok) {
    await ctx.supabase
      .from('syllabi')
      .update({
        processing_status: 'failed',
        error_message: 'We could not read this document. Try re-uploading it as a PDF or a clear photo.',
      })
      .eq('id', input.syllabusId)
      .eq('user_id', ctx.userId);
    return { ok: false, error: outcome.error, runId: outcome.runId };
  }

  const r = outcome.data;

  await ctx.supabase
    .from('syllabi')
    .update({
      processing_status: 'completed',
      error_message: null,
      extracted_text: r.extracted_text?.slice(0, 200_000) ?? null,
      summary: r.summary,
      instructor: r.instructor,
      office_hours: r.office_hours,
      policies: r.policies,
      required_material: r.required_material,
      topics: r.topics ?? [],
    })
    .eq('id', input.syllabusId)
    .eq('user_id', ctx.userId);

  const events = (r.events ?? []).filter((e) => e.title);
  if (events.length) {
    await ctx.supabase.from('syllabus_events').insert(
      events.map((e) => ({
        user_id: ctx.userId,
        syllabus_id: input.syllabusId,
        course_id: input.courseId,
        title: e.title,
        event_type: e.event_type,
        event_date: e.event_date,
        weight: e.weight,
        description: e.description,
      })),
    );
  }

  // Dated assessments become reminders straight away (Workflow D).
  await workflowBuildReminders(ctx, 120).catch(() => undefined);

  return { ok: true, data: { events: events.length, topics: r.topics?.length ?? 0 }, runId: outcome.runId };
}

// --- Workflow C — grade analysis ---------------------------------------------
// grade entered → recompute → target requirement → insight → ai_runs

export async function workflowAnalyseGrade(
  ctx: AgentRunContext,
  input: { courseId: string },
) {
  const context = await loadStudentContext(ctx.supabase, ctx.userId);
  const outcome = await runAgent(gradeCoach, { context, courseId: input.courseId }, ctx);
  return outcome.ok
    ? { ok: true as const, data: outcome.data, runId: outcome.runId }
    : { ok: false as const, error: outcome.error, runId: outcome.runId };
}

// --- Workflow D — upcoming exam ----------------------------------------------
// exam approaching → days remaining → course status → study ramp → reminders

export async function workflowBuildReminders(
  ctx: AgentRunContext,
  horizonDays = 60,
): Promise<WorkflowResult<{ created: number }>> {
  const context = await loadStudentContext(ctx.supabase, ctx.userId);

  if (context.profile && context.profile.reminders_enabled === false) {
    return { ok: true, data: { created: 0 }, runId: null };
  }

  const outcome = await runAgent(studyReminderAgent, { context, horizonDays }, ctx);
  if (!outcome.ok) return { ok: false, error: outcome.error, runId: outcome.runId };

  const rows = outcome.data.reminders;
  if (!rows.length) return { ok: true, data: { created: 0 }, runId: outcome.runId };

  const { error } = await ctx.supabase.from('reminders').insert(
    rows.map((r) => ({
      user_id: ctx.userId,
      course_id: r.course_id,
      event_id: r.event_id,
      title: r.title,
      body: r.body,
      remind_on: r.remind_on,
      source: 'ai' as const,
    })),
  );
  if (error) return { ok: false, error: error.message, runId: outcome.runId };

  return { ok: true, data: { created: rows.length }, runId: outcome.runId };
}

// --- Workflow E — study questions --------------------------------------------
// request → course context → syllabus topics → weak areas → generate → save

export async function workflowGenerateQuestions(
  ctx: AgentRunContext,
  input: Omit<StudyInput, 'context'>,
): Promise<WorkflowResult<{ sessionId: string; questionIds: string[] }>> {
  const context = await loadStudentContext(ctx.supabase, ctx.userId);
  const outcome = await runAgent(studyQuestionGenerator, { ...input, context }, ctx);
  if (!outcome.ok) return { ok: false, error: outcome.error, runId: outcome.runId };

  const { data: session, error: sessionError } = await ctx.supabase
    .from('study_sessions')
    .insert({
      user_id: ctx.userId,
      course_id: input.courseId,
      topic: input.topic ?? outcome.data.questions[0]?.topic ?? null,
      mode: input.mode,
      total_questions: outcome.data.questions.length,
    })
    .select('id')
    .single();

  if (sessionError || !session) {
    return { ok: false, error: sessionError?.message ?? 'Could not start the session.', runId: outcome.runId };
  }

  const { data: saved, error: qError } = await ctx.supabase
    .from('questions')
    .insert(outcome.data.questions.map((q) => ({
      user_id: ctx.userId,
      course_id: input.courseId,
      session_id: session.id,
      topic: q.topic,
      difficulty: q.difficulty,
      question_type: q.question_type,
      question_text: q.question_text,
      options: q.options,
      answer: q.answer,
      explanation: `${q.explanation}${q.next_action ? `\n\nNext: ${q.next_action}` : ''}`,
    })))
    .select('id');

  if (qError) return { ok: false, error: qError.message, runId: outcome.runId };

  return {
    ok: true,
    runId: outcome.runId,
    data: { sessionId: session.id, questionIds: (saved ?? []).map((r) => r.id) },
  };
}

// --- Task planning -----------------------------------------------------------

export async function workflowPlanTasks(
  ctx: AgentRunContext,
  horizonDays = 14,
): Promise<WorkflowResult<{ created: number }>> {
  const context = await loadStudentContext(ctx.supabase, ctx.userId);
  const input: TaskPlannerInput = { context, horizonDays };
  const outcome = await runAgent(taskPlanner, input, ctx);
  if (!outcome.ok) return { ok: false, error: outcome.error, runId: outcome.runId };

  const byCode = new Map(context.courses.map((c) => [c.course_code.toUpperCase(), c.id]));
  const rows = outcome.data.tasks.map((t) => ({
    user_id: ctx.userId,
    course_id: t.course_code ? byCode.get(t.course_code.toUpperCase()) ?? null : null,
    title: t.title,
    description: t.description,
    priority: t.priority,
    due_date: t.due_date,
    estimated_minutes: t.estimated_minutes,
    status: 'todo' as const,
    source: 'ai' as const,
  }));

  if (!rows.length) return { ok: true, data: { created: 0 }, runId: outcome.runId };

  const { error } = await ctx.supabase.from('tasks').insert(rows);
  if (error) return { ok: false, error: error.message, runId: outcome.runId };

  return { ok: true, data: { created: rows.length }, runId: outcome.runId };
}

// --- Semester planning -------------------------------------------------------

export async function workflowPlanSemester(
  ctx: AgentRunContext,
  input: Omit<PlannerInput, 'context'>,
): Promise<WorkflowResult<{ scheduleIds: string[] }>> {
  const context = await loadStudentContext(ctx.supabase, ctx.userId);
  const outcome = await runAgent(coursePlanner, { ...input, context }, ctx);
  if (!outcome.ok) return { ok: false, error: outcome.error, runId: outcome.runId };

  const ids: string[] = [];
  for (const plan of outcome.data.plans) {
    const { data: schedule, error } = await ctx.supabase
      .from('schedules')
      .insert({
        user_id: ctx.userId,
        semester: input.semester ?? null,
        name: plan.name,
        total_credits: plan.total_credits,
        workload_level: plan.workload_level,
        rationale: plan.rationale,
        assumptions: [...plan.assumptions, ...plan.conflicts.map((c) => `Timetable conflict: ${c}`)],
      })
      .select('id')
      .single();

    if (error || !schedule) continue;
    ids.push(schedule.id);

    if (plan.course_ids.length) {
      await ctx.supabase.from('schedule_courses').insert(
        plan.course_ids.map((courseId) => ({
          user_id: ctx.userId,
          schedule_id: schedule.id,
          course_id: courseId,
        })),
      );
    }
  }

  return { ok: true, data: { scheduleIds: ids }, runId: outcome.runId };
}

// --- Academic analysis -------------------------------------------------------

export async function workflowAnalyseRecord(ctx: AgentRunContext) {
  const context = await loadStudentContext(ctx.supabase, ctx.userId);
  const outcome = await runAgent(academicAnalyst, { context }, ctx);
  return outcome.ok
    ? { ok: true as const, data: outcome.data, runId: outcome.runId }
    : { ok: false as const, error: outcome.error, runId: outcome.runId };
}

export function agentContext(supabase: SupabaseClient, userId: string): AgentRunContext {
  return { supabase, userId };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
