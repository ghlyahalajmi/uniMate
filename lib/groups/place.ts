/**
 * Where to meet.
 *
 * There is no map of the campus in UniMate and inventing one would be a lie,
 * so the suggestion is built from the one honest signal it has: the buildings
 * the group already has classes in. A study spot in a building they are all
 * walking to anyway beats a room picked from a list nobody can find.
 */

export type SpotKey = 'spotLibrary' | 'spotStudyHall' | 'spotCafeteria' | 'spotEmpty';

export const SPOTS: SpotKey[] = ['spotLibrary', 'spotStudyHall', 'spotCafeteria', 'spotEmpty'];

/** The building most of the group's classes are in, or null when unknown. */
export function commonBuilding(buildings: string[]): string | null {
  const counts = new Map<string, number>();
  for (const raw of buildings) {
    const b = raw.trim().toUpperCase();
    // A room number on its own ("210") says nothing about which building.
    if (!b || /^\d+$/.test(b) || b.length > 6) continue;
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [b, n] of counts) {
    if (n > bestCount) { best = b; bestCount = n; }
  }
  return best;
}
