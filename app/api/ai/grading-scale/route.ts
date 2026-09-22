import { NextResponse } from 'next/server';
import { withUser, apiError } from '@/lib/api/helpers';
import { checkRunRate } from '@/lib/ai/rate-limit';
import { runAgent } from '@/lib/ai/run';
import { gradingScaleReader } from '@/lib/ai/agents';
import { MAX_UPLOAD_BYTES } from '@/lib/validation/schemas';

/**
 * Reading an image with adaptive thinking outlasts the default function
 * limit, and being killed mid-call looks to the browser like the feature
 * being broken rather than slow.
 */
export const maxDuration = 300;

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] as const;
type AllowedType = (typeof ALLOWED)[number];

/**
 * Read a photographed grading scale.
 *
 * Writes nothing but the ai_runs row: every GPA in UniMate is computed against
 * this scale, so the rows go back for the student to check and only saving
 * them from the editor replaces what is stored.
 */
export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  // A ceiling on how fast one student can spend a model quota. See
  // lib/ai/rate-limit.ts for why twenty in ten minutes.
  const rate = await checkRunRate(auth.ctx);
  if (rate.exceeded) return apiError('rate_limited', 429, String(rate.retryInMinutes));

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError('invalid_request', 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) return apiError('invalid_request', 400);
  if (file.size > MAX_UPLOAD_BYTES) return apiError('file_too_large', 413);
  if (!ALLOWED.includes(file.type as AllowedType)) return apiError('file_type', 415);

  const data = Buffer.from(await file.arrayBuffer()).toString('base64');

  const outcome = await runAgent(
    gradingScaleReader,
    { data, mediaType: file.type as AllowedType },
    auth.ctx,
  );
  if (!outcome.ok) return apiError('scan_failed', 200);

  return NextResponse.json({
    ok: true,
    rows: outcome.data.rows,
    notes: outcome.data.notes,
  });
}
