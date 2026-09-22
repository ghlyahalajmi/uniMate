import { NextResponse } from 'next/server';
import { withUser, apiError, readJson } from '@/lib/api/helpers';
import { checkRunRate } from '@/lib/ai/rate-limit';
import { askSyllabus } from '@/lib/ai/agents';
import { syllabusAskSchema } from '@/lib/validation/schemas';
import { runAgent, type AgentDefinition } from '@/lib/ai/run';

/**
 * These agents call Claude with adaptive thinking, and the slowest of them —
 * reading a photographed timetable, or drafting a full practice set — take
 * well over the default function limit. Vercel kills the function at that
 * limit and the browser sees a bare 504 with no logged ai_run, so the ceiling
 * is raised here rather than discovered in production.
 */
export const maxDuration = 300;

interface AskInput { syllabusId: string; question: string; structured: string; extractedText: string }
interface AskOutput { answer: string; found: boolean }

/** Wrapped as an agent so the question is logged like every other AI call. */
const syllabusQuestionAgent: AgentDefinition<AskInput, AskOutput> = {
  name: 'Syllabus Analyst',
  trigger: 'syllabus_question',
  workflow: 'workflow_b_syllabus_processing',
  describe: 'Answers a question strictly from one stored syllabus.',
  run: (input) => askSyllabus({
    extractedText: input.extractedText,
    structured: input.structured,
    question: input.question,
  }),
  fallback: () => null,
  summariseInput: (i) => i.question.slice(0, 120),
  summariseOutput: (o) => (o.found ? 'Answered from the stored syllabus' : 'Not found in the syllabus'),
};

export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  // A ceiling on how fast one student can spend a model quota. See
  // lib/ai/rate-limit.ts for why twenty in ten minutes.
  const rate = await checkRunRate(auth.ctx);
  if (rate.exceeded) return apiError('rate_limited', 429, String(rate.retryInMinutes));

  const body = await readJson<unknown>(request, 32 * 1024);
  const parsed = syllabusAskSchema.safeParse(body);
  if (!parsed.success) return apiError('invalid_request', 400);

  const { data: syllabus } = await auth.ctx.supabase
    .from('syllabi')
    .select('*')
    .eq('id', parsed.data.syllabus_id)
    .maybeSingle();

  if (!syllabus) return apiError('not_found', 404);

  const { data: events } = await auth.ctx.supabase
    .from('syllabus_events')
    .select('title, event_type, event_date, weight, description')
    .eq('syllabus_id', syllabus.id);

  const structured = JSON.stringify(
    {
      instructor: syllabus.instructor,
      office_hours: syllabus.office_hours,
      required_material: syllabus.required_material,
      policies: syllabus.policies,
      topics: syllabus.topics,
      summary: syllabus.summary,
      events: events ?? [],
    },
    null,
    2,
  );

  const outcome = await runAgent(
    syllabusQuestionAgent,
    {
      syllabusId: syllabus.id,
      question: parsed.data.question,
      structured,
      extractedText: syllabus.extracted_text ?? '',
    },
    auth.ctx,
  );

  if (!outcome.ok) return apiError('ask_failed', 200);

  return NextResponse.json({
    ok: true,
    found: outcome.data.found,
    answer: outcome.data.answer,
  });
}
