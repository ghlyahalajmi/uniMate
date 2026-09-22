import { NextResponse } from 'next/server';
import { withUser, apiError, readJson } from '@/lib/api/helpers';
import { checkRunRate } from '@/lib/ai/rate-limit';
import { workflowBuildReminders, workflowAnalyseGrade } from '@/lib/workflows';

/**
 * Starting a workflow from the product, as the student.
 *
 * The webhook surface next door exists so a schedule *outside* UniMate can
 * drive the same code; it runs with the service role and needs a shared
 * secret. This one is the opposite in every respect: it is pressed by a person
 * who is signed in, it runs with their own session, and it can only ever touch
 * their own rows, because that is all their session can reach.
 *
 * Two workflows are startable this way, because they are the two that need no
 * further input: the exam-reminder builder, and the grade analysis, which
 * picks the student's own first active course rather than accepting a course
 * id from the browser.
 */

export const maxDuration = 300;

const RUNNABLE = ['reminders', 'grade-analysis'] as const;
type Runnable = (typeof RUNNABLE)[number];

function isRunnable(value: unknown): value is Runnable {
  return typeof value === 'string' && (RUNNABLE as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  const rate = await checkRunRate(auth.ctx);
  if (rate.exceeded) return apiError('rate_limited', 429, String(rate.retryInMinutes));

  const body = await readJson<{ workflow?: unknown }>(request, 4 * 1024);
  if (!isRunnable(body?.workflow)) return apiError('invalid_request', 400);

  if (body.workflow === 'reminders') {
    const result = await workflowBuildReminders(auth.ctx);
    if (!result.ok || !result.data) return apiError('run_failed', 200, result.error);
    return NextResponse.json({
      ok: true, workflow: 'reminders', created: result.data.created,
    });
  }

  // Grade analysis needs a course. It is read from the student's own rows —
  // never accepted from the request — so this cannot be pointed at anybody
  // else's course by editing what the browser sends.
  const { data: course } = await auth.ctx.supabase
    .from('courses')
    .select('id, course_code')
    .eq('user_id', auth.ctx.userId)
    .eq('status', 'active')
    .order('course_code', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!course) return apiError('no_active_course', 200);

  const result = await workflowAnalyseGrade(auth.ctx, { courseId: course.id });
  if (!result.ok || !result.data) return apiError('run_failed', 200, result.error);

  return NextResponse.json({
    ok: true,
    workflow: 'grade-analysis',
    course: course.course_code,
    // The computed verdict, not the model's prose: this is the line the page
    // shows as the outcome, and it has to be arithmetic.
    verdict: result.data.facts.verdict,
    currentPercent: result.data.facts.currentPercent,
  });
}
