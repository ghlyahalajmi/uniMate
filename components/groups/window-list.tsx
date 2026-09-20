'use client';

import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, cx } from '@/components/ui/primitives';
import { toTime, type FreeWindow } from '@/lib/groups/availability';

/**
 * The engine's output, drawn as it is read: a day, a stretch of time, and how
 * many of you are free in it.
 *
 * The bar is the window's share of the 08:00–20:00 day, so a three-hour gap
 * looks like one next to a one-hour gap — the shape carries the information
 * before the numbers are read.
 */
export function WindowList({
  windows, onBook, bookLabel,
}: {
  windows: FreeWindow[];
  onBook?: (w: FreeWindow) => void;
  bookLabel?: string;
}) {
  const { t, tf, formatNumber } = useI18n();
  const dayStart = 8 * 60;
  const dayEnd = 20 * 60;
  const span = dayEnd - dayStart;

  return (
    <ul className="space-y-2">
      {windows.map((w) => {
        const all = w.free === w.total;
        const left = ((w.start - dayStart) / span) * 100;
        const width = ((w.end - w.start) / span) * 100;

        return (
          <li
            key={`${w.day}-${w.start}-${w.end}`}
            className="p-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)]"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-sm font-medium min-w-0">
                {t.weekdaysShort[w.day]}
              </span>
              <span className="text-sm tabular-nums text-[var(--text-secondary)]">
                {toTime(w.start)} – {toTime(w.end)}
              </span>
              <Badge tone={all ? 'positive' : 'neutral'}>
                {all
                  ? tf(t.groups.allFree, { n: formatNumber(w.total) })
                  : tf(t.groups.someFree, { n: formatNumber(w.free), total: formatNumber(w.total) })}
              </Badge>
              {onBook ? (
                <Button size="sm" variant="secondary" className="ms-auto" onClick={() => onBook(w)}>
                  {bookLabel ?? t.groups.book}
                </Button>
              ) : null}
            </div>

            <div
              aria-hidden="true"
              className="relative h-1.5 mt-2.5 rounded-full bg-[var(--bg-inset)] overflow-hidden"
            >
              <span
                className={cx(
                  'absolute inset-y-0 rounded-full',
                  all ? 'bg-[var(--positive)]' : 'bg-[var(--accent)] opacity-60',
                )}
                style={{ insetInlineStart: `${left}%`, width: `${Math.max(width, 2)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
