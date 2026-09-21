'use client';

import { useRef } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { cx } from '@/components/ui/primitives';
import { clampSticker, type Sticker as StickerData } from '@/lib/notes/design';
import { Sticker } from './stickers';

/**
 * The stickers on a note, and how they are moved.
 *
 * While the design bar is closed they are decoration: `aria-hidden`, no tab
 * stop, no pointer target, so they never get between the student and the line
 * they are trying to type on. While it is open each one becomes a button that
 * can be dragged with a finger or nudged with the arrow keys — dragging alone
 * would put them out of reach of anyone not using a pointer.
 *
 * Positions are percentages, so a sticker stays where it was put when the note
 * grows a line or the window changes width.
 */
/**
 * How close to the edge a sticker may be placed.
 *
 * Not zero: a sticker centred on the very corner puts its remove button half
 * outside the note, and on a narrow screen that pushed the whole page sideways.
 */
const EDGE = 6;

function inside(n: number): number {
  return Math.min(Math.max(n, EDGE), 100 - EDGE);
}

export function StickerLayer({
  stickers, editing, onMove, onRemove,
}: {
  stickers: StickerData[];
  editing: boolean;
  onMove: (index: number, x: number, y: number) => void;
  onRemove: (index: number) => void;
}) {
  const { t, tf } = useI18n();
  const surface = useRef<HTMLDivElement>(null);

  /** Pointer position → percentage across the note, respecting direction. */
  function positionFrom(event: { clientX: number; clientY: number }): { x: number; y: number } | null {
    const el = surface.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    // In RTL the start edge is the right one, and `insetInlineStart` measures
    // from there — so the distance has to be measured from there too.
    const rtl = getComputedStyle(el).direction === 'rtl';
    const dx = rtl ? rect.right - event.clientX : event.clientX - rect.left;
    return {
      x: inside((dx / rect.width) * 100),
      y: inside(((event.clientY - rect.top) / rect.height) * 100),
    };
  }

  return (
    <div
      ref={surface}
      // Clipped to the note: nothing a sticker carries may reach past its own
      // paper and widen the page.
      //
      // The layer never takes pointer events itself — it covers the entire
      // note, and taking them meant that opening the design bar put an
      // invisible sheet over the bar, the lines and the buttons. Only the
      // stickers on it are clickable, and only while designing.
      className={cx(
        'absolute inset-0 overflow-hidden rounded-[var(--radius-lg)] pointer-events-none',
        editing && 'z-10',
      )}
      aria-hidden={editing ? undefined : true}
    >
      {stickers.map((s, i) => {
        const style = {
          insetInlineStart: `${s.x}%`,
          top: `${s.y}%`,
          transform: `translate(-50%, -50%) rotate(${s.r}deg)`,
        } as React.CSSProperties;

        if (!editing) {
          return (
            <span key={`${s.k}-${i}`} className="absolute select-none" style={style}>
              <Sticker k={s.k} size={30} />
            </span>
          );
        }

        return (
          // Sized, not a bare point: the remove button is positioned against
          // this box's corner, and while the box had no size that corner *was*
          // the sticker's centre — so letting go of a drag landed on the remove
          // button and deleted the sticker you had just placed.
          <span
            key={`${s.k}-${i}`}
            className="absolute pointer-events-auto inline-grid place-items-center w-11 h-11"
            style={style}
          >
            <button
              type="button"
              aria-label={tf(t.notes.moveSticker, { name: t.notes[s.k] })}
              className="grid place-items-center w-11 h-11 rounded-full touch-none cursor-grab
                         bg-[var(--bg-surface)]/60 border border-dashed border-[var(--border-strong)]"
              onPointerDown={(e) => {
                e.preventDefault();
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              }}
              onPointerMove={(e) => {
                // No buttons held means this is a hover, not a drag.
                if (e.buttons === 0) return;
                const next = positionFrom(e);
                if (next) onMove(i, next.x, next.y);
              }}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 10 : 2;
                const moves: Record<string, [number, number]> = {
                  ArrowLeft: [-step, 0], ArrowRight: [step, 0],
                  ArrowUp: [0, -step], ArrowDown: [0, step],
                };
                const move = moves[e.key];
                if (move) {
                  e.preventDefault();
                  const moved = clampSticker({ ...s, x: s.x + move[0], y: s.y + move[1] });
                  onMove(i, inside(moved.x), inside(moved.y));
                  return;
                }
                if (e.key === 'Delete' || e.key === 'Backspace') {
                  e.preventDefault();
                  onRemove(i);
                }
              }}
            >
              <Sticker k={s.k} size={30} />
            </button>

            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={tf(t.notes.removeSticker, { name: t.notes[s.k] })}
              // 32px of hit area around a small mark: comfortable for a thumb
              // without a red dot the size of the sticker it removes.
              className="absolute -top-2 -end-2 grid place-items-center w-8 h-8 rounded-full"
            >
              <span
                aria-hidden="true"
                className="grid place-items-center w-5 h-5 rounded-full bg-[var(--danger)]
                           text-white text-[12px] leading-none shadow-[var(--shadow-card)]"
              >
                ×
              </span>
            </button>
          </span>
        );
      })}
    </div>
  );
}
