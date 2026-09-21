import { NextResponse } from 'next/server';
import { withUser, apiError } from '@/lib/api/helpers';
import { runAgent } from '@/lib/ai/run';
import { dailyCoach } from '@/lib/ai/agents';
import { getCoachSnapshot } from '@/lib/coach/queries';
import { logMotivation } from '@/lib/coach/service';
import { isAiConfigured } from '@/lib/ai/client';

/** The coach calls a model, so it gets the same ceiling as the other agents. */
export const maxDuration = 300;

/**
 * The AI coach line for the dashboard and the journey screen.
 *
 * This is a POST rather than part of the page render so the screen paints
 * immediately with the deterministic coaching and upgrades to the written
 * version when it arrives. A slow or missing model delays nothing.
 */
export async function POST() {
  const auth = await withUser();
  if (!auth.ok) return auth.response;

  const snapshot = await getCoachSnapshot();

  const outcome = await runAgent(
    dailyCoach,
    {
      signals: snapshot.signals,
      recommendationInput: snapshot.recommendationInput,
      studentName: snapshot.studentName,
    },
    auth.ctx,
  );

  if (!outcome.ok) {
    return apiError(isAiConfigured() ? 'coach_failed' : 'ai_not_configured', 200);
  }

  // Record what the student was told, with the figures behind it.
  await logMotivation({
    message: outcome.data.message,
    trigger: 'daily_coach',
    tone: outcome.data.tone,
    context: {
      key: outcome.data.fallbackKey,
      values: outcome.data.fallbackValues,
      tasksLast7: snapshot.signals.tasksCompletedLast7,
      minutesLast7: snapshot.signals.studyMinutesLast7,
      streak: snapshot.signals.currentStreak,
      quizAverage: snapshot.signals.quizAverage,
    },
    fromAi: outcome.data.fromAi,
  });

  return NextResponse.json({ ok: true, ...outcome.data, source: outcome.source });
}
