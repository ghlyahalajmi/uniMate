/**
 * Leitner scheduling for flashcards.
 *
 * Pure: no I/O, no clock of its own. The caller passes today's date, which is
 * what makes every rule here testable and what keeps a student's local day
 * from being decided by a server in another timezone.
 *
 * Why Leitner and not SM-2: a student can answer "when will I see this card
 * again?" by looking at the box. An ease factor that drifts by fractions of a
 * percent per review cannot be explained on the screen, and a system you
 * cannot explain is one you stop trusting.
 */

export const MAX_BOX = 5;

/**
 * Days to wait after a card is recalled, indexed by the box it lands in.
 * Box 1 is tomorrow; box 5 is three weeks.
 */
export const BOX_INTERVALS: Record<number, number> = {
  1: 1, 2: 2, 3: 4, 4: 9, 5: 21,
};

export interface CardState {
  box: number;
  reviews: number;
  lapses: number;
}

export interface ScheduleResult {
  box: number;
  dueOn: string;
  reviews: number;
  lapses: number;
  /** True when the card fell out of a higher box — the UI calls this out. */
  lapsed: boolean;
}

/** Adds whole days to a YYYY-MM-DD date without touching local time. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Where a card goes after the student says whether they recalled it.
 *
 * A missed card drops to box 1 and is due the same day, not tomorrow: if you
 * have just failed it, seeing it again before you close the app is the whole
 * point. The session queue shows it once more rather than looping.
 */
export function review(card: CardState, recalled: boolean, todayIso: string): ScheduleResult {
  const box = clampBox(card.box);

  if (!recalled) {
    return {
      box: 1,
      dueOn: todayIso,
      reviews: card.reviews + 1,
      lapses: card.lapses + 1,
      lapsed: box > 1,
    };
  }

  const nextBox = Math.min(box + 1, MAX_BOX);
  return {
    box: nextBox,
    dueOn: addDays(todayIso, BOX_INTERVALS[nextBox]),
    reviews: card.reviews + 1,
    lapses: card.lapses,
    lapsed: false,
  };
}

/** A card is due when its date has arrived, so a missed day does not skip it. */
export function isDue(dueOn: string, todayIso: string): boolean {
  return dueOn <= todayIso;
}

/**
 * How well known the deck is, 0–1: box 1 counts for nothing and box 5 for
 * everything, so the number moves as cards climb rather than only when they
 * are added.
 */
export function deckMastery(boxes: number[]): number {
  if (boxes.length === 0) return 0;
  const total = boxes.reduce((sum, b) => sum + (clampBox(b) - 1), 0);
  return total / (boxes.length * (MAX_BOX - 1));
}

function clampBox(box: number): number {
  if (!Number.isFinite(box)) return 1;
  return Math.min(Math.max(Math.trunc(box), 1), MAX_BOX);
}
