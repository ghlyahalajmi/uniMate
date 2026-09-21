import { NextResponse } from 'next/server';
import { withUser, apiError, readJson } from '@/lib/api/helpers';
import { runAgent } from '@/lib/ai/run';
import { studyPlanner, type PlannedCourse, type PlannedSession } from '@/lib/ai/agents';
import { loadStudentContext, weakTopics } from '@/lib/ai/context';
import { isAiConfigured } from '@/lib/ai/client';

export const maxDuration = 300;

/** Sessions one plan may hold. Matches the agent's schema ceiling. */
const MAX_SESSIONS = 40;
const MAX_COURSES = 8;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Propose a plan. Writes nothing but the ai_runs row.
 *
 * The student sees the sessions and approves them before any of it reaches
 * their week — which is why proposing and saving are separate verbs here
 * rather than one call that schedules on their behalf.
 */
export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;
  if (!isAiConfigured()) return apiError('ai_not_configured', 200);

  const body = await readJson<{
    courseIds?: string[]; horizonDays?: number; todayIso?: string;
  }>(request, 32 * 1024);

  const { supabase, userId } = auth.ctx;

  // No courses named means "the ones I am taking now".
  let query = supabase
    .from('courses')
    .select('id, course_code, course_name, status')
    .eq('user_id', userId);

  const chosen = Array.isArray(body?.courseIds) ? body.courseIds.filter((x) => typeof x === 'string') : [];
  query = chosen.length > 0 ? query.in('id', chosen.slice(0, MAX_COURSES)) : query.eq('status', 'active');

  const { data: courseRows } = await query;
  const courses = (courseRows ?? []) as Array<{
    id: string; course_code: string; course_name: string; status: string;
  }>;
  if (courses.length === 0) return apiError('no_courses', 200);

  const ids = courses.map((c) => c.id);

  const [{ data: materialRows }, { data: gradeRows }] = await Promise.all([
    supabase.from('course_materials')
      .select('id, course_id, title, position')
      .eq('user_id', userId).in('course_id', ids).order('position'),
    supabase.from('grades')
      .select('course_id, assessment_name, due_date, weight, score')
      .eq('user_id', userId).in('course_id', ids),
  ]);

  const materials = (materialRows ?? []) as Array<{ id: string; course_id: string; title: string }>;
  const grades = (gradeRows ?? []) as Array<{
    course_id: string; assessment_name: string; due_date: string | null;
    weight: number | null; score: number | null;
  }>;

  const todayIso = body?.todayIso && ISO_DATE.test(body.todayIso)
    ? body.todayIso
    : new Date().toISOString().slice(0, 10);

  const { data: profile } = await supabase
    .from('profiles')
    .select('preferred_study_minutes, study_availability')
    .eq('user_id', userId)
    .maybeSingle();

  const planned: PlannedCourse[] = courses.map((c) => ({
    id: c.id,
    code: c.course_code,
    name: c.course_name,
    chapters: materials.filter((m) => m.course_id === c.id).map((m) => ({ id: m.id, title: m.title })),
    upcoming: grades
      .filter((g) => g.course_id === c.id && g.score === null && (!g.due_date || g.due_date >= todayIso))
      .map((g) => ({ title: g.assessment_name, date: g.due_date, weight: g.weight })),
    currentPercent: null,
  }));

  let weak: string[] = [];
  try {
    const context = await loadStudentContext(supabase, userId);
    weak = weakTopics(context).filter((w) => w.rate < 0.7).slice(0, 6).map((w) => w.topic);
  } catch {
    weak = [];
  }

  const horizon = Math.min(60, Math.max(7, Math.trunc(body?.horizonDays ?? 21)));

  const outcome = await runAgent(
    studyPlanner,
    {
      courses: planned,
      todayIso,
      defaultMinutes: (profile as { preferred_study_minutes?: number } | null)?.preferred_study_minutes ?? 45,
      availableDays: [],
      horizonDays: horizon,
      weakTopics: weak,
    },
    auth.ctx,
  );

  if (!outcome.ok) return apiError('plan_failed', 200);

  // The model was told to name only ids it was given; this is what makes that
  // true. A session pointing at another student's course would be refused by
  // row level security on save, but silently dropping it here means the plan
  // the student approves is the plan they get.
  const validCourse = new Set(ids);
  const validMaterial = new Set(materials.map((m) => m.id));

  const sessions = outcome.data.sessions
    .filter((s) => validCourse.has(s.courseId))
    .filter((s) => ISO_DATE.test(s.scheduledOn) && s.scheduledOn >= todayIso)
    .filter((s) => HHMM.test(s.startTime))
    .map((s) => ({
      ...s,
      materialId: s.materialId && validMaterial.has(s.materialId) ? s.materialId : null,
      minutes: Math.min(180, Math.max(15, Math.trunc(s.minutes))),
    }))
    .sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn) || a.startTime.localeCompare(b.startTime))
    .slice(0, MAX_SESSIONS);

  if (sessions.length === 0) return apiError('plan_empty', 200);

  return NextResponse.json({
    ok: true,
    plan: {
      title: outcome.data.title,
      goal: outcome.data.goal,
      notes: outcome.data.notes,
      sessions,
      courses: courses.map((c) => ({ id: c.id, code: c.course_code, name: c.course_name })),
    },
  });
}

interface ApproveBody {
  title?: string;
  goal?: string;
  sessions?: PlannedSession[];
}

/** Approve a proposed plan: this is the call that puts it in the student's week. */
export async function PUT(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;
  const { supabase, userId } = auth.ctx;

  const body = await readJson<ApproveBody>(request, 256 * 1024);
  const sessions = Array.isArray(body?.sessions) ? body.sessions : [];
  if (sessions.length === 0) return apiError('invalid_request', 400);
  if (sessions.length > MAX_SESSIONS) return apiError('too_many_sessions', 400);

  const dates = sessions.map((s) => s.scheduledOn).filter((d) => ISO_DATE.test(d)).sort();
  if (dates.length !== sessions.length) return apiError('invalid_request', 400);

  const { data: plan, error: planError } = await supabase
    .from('study_plans')
    .insert({
      user_id: userId,
      title: (body?.title ?? '').trim().slice(0, 200) || 'Study plan',
      goal: (body?.goal ?? '').trim().slice(0, 500) || null,
      status: 'active',
      starts_on: dates[0],
      ends_on: dates[dates.length - 1],
      total_minutes: sessions.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0),
      source: 'ai',
    })
    .select('id')
    .single();

  if (planError || !plan) return apiError('save_failed', 200);
  const planId = (plan as { id: string }).id;

  const { error: itemError } = await supabase.from('study_plan_items').insert(
    sessions.map((s, i) => ({
      user_id: userId,
      plan_id: planId,
      course_id: s.courseId,
      material_id: s.materialId,
      topic: String(s.topic).slice(0, 300),
      scheduled_on: s.scheduledOn,
      start_time: HHMM.test(s.startTime) ? s.startTime : null,
      minutes: Math.min(180, Math.max(15, Math.trunc(Number(s.minutes) || 45))),
      position: i,
    })),
  );

  if (itemError) {
    // A plan with no sessions is a row nobody can use, and it would show up on
    // the manage screen as an empty card the student cannot explain.
    await supabase.from('study_plans').delete().eq('id', planId).eq('user_id', userId);
    return apiError('save_failed', 200);
  }

  return NextResponse.json({ ok: true, planId });
}

/** Move one session, or mark it done. */
export async function PATCH(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  const body = await readJson<{
    itemId?: string; scheduledOn?: string; startTime?: string;
    minutes?: number; completed?: boolean;
  }>(request, 16 * 1024);
  if (!body?.itemId) return apiError('invalid_request', 400);

  const patch: Record<string, unknown> = {};
  if (typeof body.scheduledOn === 'string') {
    if (!ISO_DATE.test(body.scheduledOn)) return apiError('invalid_request', 400);
    patch.scheduled_on = body.scheduledOn;
  }
  if (typeof body.startTime === 'string') {
    if (!HHMM.test(body.startTime)) return apiError('invalid_request', 400);
    patch.start_time = body.startTime;
  }
  if (typeof body.minutes === 'number' && Number.isFinite(body.minutes)) {
    patch.minutes = Math.min(180, Math.max(15, Math.trunc(body.minutes)));
  }
  if (typeof body.completed === 'boolean') {
    patch.completed_at = body.completed ? new Date().toISOString() : null;
  }
  if (Object.keys(patch).length === 0) return apiError('invalid_request', 400);

  const { error } = await auth.ctx.supabase
    .from('study_plan_items')
    .update(patch)
    .eq('id', body.itemId)
    .eq('user_id', auth.ctx.userId);

  if (error) return apiError('save_failed', 200);
  return NextResponse.json({ ok: true });
}

/** Drop a plan and every session in it. */
export async function DELETE(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  const body = await readJson<{ planId?: string }>(request, 16 * 1024);
  if (!body?.planId) return apiError('invalid_request', 400);

  // The items carry `on delete cascade`, so removing the plan removes them.
  const { error } = await auth.ctx.supabase
    .from('study_plans')
    .delete()
    .eq('id', body.planId)
    .eq('user_id', auth.ctx.userId);

  if (error) return apiError('save_failed', 200);
  return NextResponse.json({ ok: true });
}
