import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  workflowBuildReminders, workflowPlanTasks, workflowAnalyseGrade,
  workflowAnalyseRecord, agentContext,
} from '@/lib/workflows';

/**
 * Webhook surface for an external automation platform (n8n, Make, a cron job).
 *
 * These endpoints exist so a schedule outside the app can drive the same code
 * paths the UI uses — "every Sunday, rebuild the study reminders", say.
 *
 * Security model:
 *  - Disabled entirely unless WORKFLOW_WEBHOOK_SECRET is set.
 *  - The secret is compared in constant time.
 *  - The caller must name the user_id to act for, and the request runs with
 *    the service role, so this is a trusted server-to-server channel only.
 *    Never expose the secret to a browser.
 */

const WORKFLOWS = {
  reminders: 'Rebuild study reminders from upcoming assessments',
  tasks: 'Generate a study plan as tasks',
  'grade-analysis': 'Recompute a course grade and its target requirement',
  analysis: 'Run the academic analyst over the completed record',
} as const;

type WorkflowName = keyof typeof WORKFLOWS;

function authorised(request: Request): boolean {
  const secret = process.env.WORKFLOW_WEBHOOK_SECRET;
  if (!secret) return false;

  const provided = request.headers.get('x-unimate-secret') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  // Length check first: timingSafeEqual throws on a mismatch.
  return a.length === b.length && timingSafeEqual(a, b);
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workflow: string }> },
) {
  if (!process.env.WORKFLOW_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: 'webhooks_disabled' }, { status: 404 });
  }
  if (!authorised(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 });
  }

  const { workflow } = await params;
  if (!(workflow in WORKFLOWS)) {
    return NextResponse.json(
      { ok: false, error: 'unknown_workflow', available: Object.keys(WORKFLOWS) },
      { status: 404 },
    );
  }

  let body: { user_id?: string; course_id?: string; horizon_days?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (!body.user_id) {
    return NextResponse.json({ ok: false, error: 'user_id_required' }, { status: 400 });
  }

  const supabase = serviceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'service_role_not_configured' }, { status: 500 });
  }

  const ctx = agentContext(supabase, body.user_id);

  // Every branch below runs through runAgent, so each leaves an ai_runs row.
  switch (workflow as WorkflowName) {
    case 'reminders': {
      const r = await workflowBuildReminders(ctx, body.horizon_days ?? 60);
      return NextResponse.json({ ok: r.ok, created: r.data?.created ?? 0, run_id: r.runId, error: r.error });
    }
    case 'tasks': {
      const r = await workflowPlanTasks(ctx, body.horizon_days ?? 14);
      return NextResponse.json({ ok: r.ok, created: r.data?.created ?? 0, run_id: r.runId, error: r.error });
    }
    case 'grade-analysis': {
      if (!body.course_id) {
        return NextResponse.json({ ok: false, error: 'course_id_required' }, { status: 400 });
      }
      const r = await workflowAnalyseGrade(ctx, { courseId: body.course_id });
      return NextResponse.json({ ok: r.ok, run_id: r.runId, data: r.ok ? r.data.facts : undefined });
    }
    case 'analysis': {
      const r = await workflowAnalyseRecord(ctx);
      return NextResponse.json({ ok: r.ok, run_id: r.runId, patterns: r.ok ? r.data.patterns.length : 0 });
    }
  }
}

/** Lets an automation platform discover the available workflows. */
export async function GET() {
  if (!process.env.WORKFLOW_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: 'webhooks_disabled' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, workflows: WORKFLOWS });
}
