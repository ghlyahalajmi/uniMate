import { cx } from '@/components/ui/primitives';

/**
 * The soft angled square that stands for a course.
 *
 * Courses have no natural image, so the mark is built from the course code:
 * a rounded square in a colour the code always hashes to, carrying the code's
 * own letters. The same course therefore looks the same on every screen and
 * between sessions, without anyone having to choose a colour.
 *
 * The colour is decoration. Every tile also shows its letters, and the tile is
 * hidden from assistive technology because the code it abbreviates is always
 * rendered as real text beside it.
 *
 * Theming goes through four custom properties rather than `light-dark()`, so a
 * tile follows the manual theme toggle and not only the OS setting. The rules
 * that read them live in globals.css under `[data-course-tile]`.
 */

/**
 * Six stops, each a soft face with ink stepped to stay legible on it. Chosen to
 * sit apart from the accent violet, which the UI already uses for state rather
 * than identity.
 */
const PALETTE = [
  { light: '#e8effc', darkFace: '#1e2f4d', ink: '#2f5fa8', darkInk: '#9dc0f5' }, // blue
  { light: '#e6f5ee', darkFace: '#17342a', ink: '#2c7d5c', darkInk: '#7fd4ad' }, // green
  { light: '#fdeee6', darkFace: '#3d2619', ink: '#b35f2c', darkInk: '#f0a878' }, // amber
  { light: '#fceaf0', darkFace: '#3b1c28', ink: '#ad3d63', darkInk: '#f095b4' }, // rose
  { light: '#efeafb', darkFace: '#2a2147', ink: '#6a4bb8', darkInk: '#b8a4f2' }, // purple
  { light: '#e4f3f5', darkFace: '#153136', ink: '#27757f', darkInk: '#7fcdd8' }, // teal
] as const;

/** Stable across sessions and machines — the same string always lands on the same stop. */
function paletteFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/**
 * Up to three characters, preferring the letters of a code like "CE 301" over
 * its digits so that "CE 301" and "CE 302" do not both read as a bare number.
 */
function initialsFor(code: string, fallback: string): string {
  const letters = code.replace(/[^a-z]/gi, '');
  if (letters.length >= 2) return letters.slice(0, 3).toUpperCase();
  const alnum = code.replace(/[^a-z0-9]/gi, '');
  if (alnum.length >= 2) return alnum.slice(0, 3).toUpperCase();
  return (fallback.trim().slice(0, 2) || '?').toUpperCase();
}

const SIZES = {
  sm: 'w-11 h-11 text-[0.6875rem] rounded-[0.85rem]',
  md: 'w-14 h-14 text-sm rounded-[1.05rem]',
  lg: 'w-20 h-20 text-lg rounded-[1.5rem]',
} as const;

export function CourseTile({
  code,
  name,
  color,
  size = 'md',
  className,
}: {
  code: string;
  name: string;
  /** An explicit course colour overrides the hashed one, in both themes. */
  color?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const palette = paletteFor(code || name);
  const initials = initialsFor(code, name);

  const vars = color
    ? {
        '--tile-face': color,
        '--tile-face-dark': color,
        '--tile-ink': '#ffffff',
        '--tile-ink-dark': '#ffffff',
      }
    : {
        '--tile-face': palette.light,
        '--tile-face-dark': palette.darkFace,
        '--tile-ink': palette.ink,
        '--tile-ink-dark': palette.darkInk,
      };

  return (
    <span
      aria-hidden="true"
      data-course-tile=""
      style={vars as React.CSSProperties}
      className={cx(
        'shrink-0 grid place-items-center select-none font-display font-semibold tracking-tight',
        'border border-black/[0.06]',
        SIZES[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}
