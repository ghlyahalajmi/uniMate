import { NextResponse } from 'next/server';
import { aiProvider } from '@/lib/ai/client';
import { envCredential } from '@/lib/ai/credentials';
import { isGatewayAvailable, isGatewayUsable } from '@/lib/ai/vercel-gateway';

export const dynamic = 'force-dynamic';

/**
 * Why the AI is on, or why it is not.
 *
 * Booleans and a provider name, nothing else: no key, no fragment of a key,
 * nothing about any student. It exists because "AI features are not switched
 * on" has four different causes and they are indistinguishable from outside —
 * the deployment has no key, the gateway has a token but no entitlement, the
 * student has not added one of their own, or a probe is simply failing.
 */
export async function GET() {
  const env = envCredential();

  return NextResponse.json({
    ok: true,
    provider: await aiProvider(),
    deploymentKey: env?.provider ?? null,
    gatewayTokenPresent: isGatewayAvailable(),
    gatewayAnswers: await isGatewayUsable(),
  });
}
