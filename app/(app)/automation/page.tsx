import { getAiRuns } from '@/lib/data/queries';
import { AutomationView } from '@/components/automation/automation-view';

export const metadata = { title: 'Automation' };
export const dynamic = 'force-dynamic';

export default async function AutomationPage() {
  const runs = await getAiRuns(120);

  return (
    <AutomationView
      // Both are required before the webhook route will answer at all, so the
      // page reports the pair rather than implying one is enough. Only whether
      // they are set crosses to the client — never the values.
      webhooksEnabled={Boolean(process.env.WORKFLOW_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY)}
      runs={runs.map((r) => ({
        id: r.id,
        workflow: r.workflow,
        agent: r.agent_name,
        status: r.status,
        trigger: r.trigger_type,
        outputSummary: r.output_summary,
        errorMessage: r.error_message,
        durationMs: r.duration_ms,
        startedAt: r.started_at,
      }))}
    />
  );
}
