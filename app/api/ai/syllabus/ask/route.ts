import { NextResponse } from 'next/server';
import { withUser, apiError, readJson } from '@/lib/api/helpers';
import { askSyllabus } from '@/lib/ai/agents';
import { syllabusAskSchema } from '@/lib/validation/schemas';
import { isAiConfigured } from '@/lib/ai/client';
import { runAgent, type AgentDefinition } from '@/lib/ai/run';

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
  if (!isAiConfigured()) return apiError('ai_not_configured', 200);

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
