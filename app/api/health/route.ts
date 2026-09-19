import { NextResponse } from 'next/server';

/** Liveness probe. Reports which integrations are configured, never their values. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'unimate',
    time: new Date().toISOString(),
    configured: {
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      ai: Boolean(process.env.ANTHROPIC_API_KEY),
      workflowWebhooks: Boolean(process.env.WORKFLOW_WEBHOOK_SECRET),
    },
  });
}
