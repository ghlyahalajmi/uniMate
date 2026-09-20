/**
 * What a note can be dressed in: a paper pattern, a tint, and stickers.
 *
 * Every one of these is a *key*, never a style. The database stores
 * `"yellow"`, the stylesheet decides what yellow is in light and in dark, and
 * nothing a student types ever reaches a style attribute. That is also why the
 * parser here is strict: a sticker read back from jsonb is trusted no further
 * than an unknown key and a number out of range.
 */

export const PATTERNS = ['plain', 'lined', 'grid', 'dots'] as const;
export type Pattern = (typeof PATTERNS)[number];

export const TINTS = ['default', 'yellow', 'mint', 'sky', 'rose', 'lilac', 'kraft'] as const;
export type Tint = (typeof TINTS)[number];

export const STICKER_KEYS = [
  'star', 'heart', 'flame', 'bulb', 'coffee', 'check',
  'bookmark', 'sparkle', 'clock', 'leaf', 'exam', 'smile',
] as const;
export type StickerKey = (typeof STICKER_KEYS)[number];

/** Twelve is the database's limit too; past that a note is a collage. */
export const MAX_STICKERS = 12;

export interface Sticker {
  k: StickerKey;
  /** Percent across the note, from the reading-direction start edge. */
  x: number;
  /** Percent down the note. */
  y: number;
  /** Degrees of tilt. A sticker placed dead straight looks like a bug. */
  r: number;
}

export interface NoteDesign {
  pattern: Pattern;
  tint: Tint;
  stickers: Sticker[];
}

export const DEFAULT_DESIGN: NoteDesign = { pattern: 'plain', tint: 'default', stickers: [] };

export function isPattern(value: unknown): value is Pattern {
  return typeof value === 'string' && (PATTERNS as readonly string[]).includes(value);
}

export function isTint(value: unknown): value is Tint {
  return typeof value === 'string' && (TINTS as readonly string[]).includes(value);
}

export function isStickerKey(value: unknown): value is StickerKey {
  return typeof value === 'string' && (STICKER_KEYS as readonly string[]).includes(value);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/** Rounded to one decimal: enough to place a sticker, short enough to store. */
function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** A sticker forced inside the note and inside the allowed tilt. */
export function clampSticker(sticker: Sticker): Sticker {
  return {
    k: sticker.k,
    x: round(clamp(Number(sticker.x) || 0, 0, 100)),
    y: round(clamp(Number(sticker.y) || 0, 0, 100)),
    r: Math.round(clamp(Number(sticker.r) || 0, -30, 30)),
  };
}

/**
 * Stickers as read from the database.
 *
 * jsonb is whatever was written into it, and this is the only place that
 * decides what counts: anything that is not a known key with usable numbers is
 * dropped rather than repaired, because a sticker in the wrong place is worse
 * than a sticker that never appears.
 */
export function parseStickers(value: unknown): Sticker[] {
  if (!Array.isArray(value)) return [];
  const out: Sticker[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    if (!isStickerKey(item.k)) continue;
    const x = Number(item.x);
    const y = Number(item.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push(clampSticker({ k: item.k, x, y, r: Number(item.r) || 0 }));
    if (out.length >= MAX_STICKERS) break;
  }
  return out;
}

/** The whole design of a note row, with anything unrecognised replaced. */
export function parseDesign(row: { theme?: unknown; color?: unknown; stickers?: unknown }): NoteDesign {
  return {
    pattern: isPattern(row.theme) ? row.theme : 'plain',
    tint: isTint(row.color) ? row.color : 'default',
    stickers: parseStickers(row.stickers),
  };
}

/**
 * A tilt that depends only on where the sticker is, so the same sticker
 * dropped twice does not jitter, and a note does not reshuffle itself on every
 * render the way `Math.random()` would.
 */
export function tiltFor(x: number, y: number): number {
  return Math.round(((x * 7 + y * 13) % 25) - 12);
}
