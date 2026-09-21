'use client';

import { useI18n } from '@/lib/i18n/provider';
import { cx } from '@/components/ui/primitives';
import { Icon } from '@/components/shell/icons';
import {
  MAX_STICKERS, PATTERNS, STICKER_KEYS, TINTS,
  type NoteDesign, type Pattern, type StickerKey, type Tint,
} from '@/lib/notes/design';
import { Sticker } from './stickers';

/**
 * The design bar: paper, tint, stickers.
 *
 * It opens inside the note rather than in a dialog, because every choice here
 * is judged against the note it changes — picking a tint in a modal that
 * covers the note is picking blind.
 */
export function NoteDesignBar({
  design, onPattern, onTint, onAddSticker,
}: {
  design: NoteDesign;
  onPattern: (p: Pattern) => void;
  onTint: (t: Tint) => void;
  onAddSticker: (k: StickerKey) => void;
}) {
  const { t, tf, formatNumber } = useI18n();
  const full = design.stickers.length >= MAX_STICKERS;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-3">
      <Row label={t.notes.paper}>
        <div role="radiogroup" aria-label={t.notes.paper} className="flex flex-wrap gap-1.5">
          {PATTERNS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={design.pattern === p}
              onClick={() => onPattern(p)}
              className={cx(
                'inline-flex items-center px-3 min-h-[34px] rounded-full border text-xs transition-colors',
                design.pattern === p
                  ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] font-medium'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
              )}
            >
              {t.notes[p]}
            </button>
          ))}
        </div>
      </Row>

      <Row label={t.notes.tint}>
        <div role="radiogroup" aria-label={t.notes.tint} className="flex flex-wrap gap-1.5">
          {TINTS.map((tint) => (
            <button
              key={tint}
              type="button"
              role="radio"
              aria-checked={design.tint === tint}
              aria-label={t.notes[tint]}
              title={t.notes[tint]}
              onClick={() => onTint(tint)}
              data-tint={tint}
              className={cx(
                // The swatch is the paper itself, so what is chosen is what is seen.
                'paper w-8 h-8 rounded-full border-2 transition-transform',
                design.tint === tint
                  ? 'border-[var(--accent)] scale-110'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]',
              )}
            >
              {design.tint === tint ? (
                <span className="grid place-items-center">
                  <Icon.check size={14} />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </Row>

      <Row label={t.notes.stickers}>
        <div className="flex flex-wrap gap-1">
          {STICKER_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onAddSticker(k)}
              disabled={full}
              aria-label={tf(t.notes.addSticker, { name: t.notes[k] })}
              title={t.notes[k]}
              className={cx(
                'grid place-items-center w-9 h-9 rounded-[var(--radius-sm)] transition-colors',
                'hover:bg-[var(--bg-inset)] disabled:opacity-40 disabled:pointer-events-none',
              )}
            >
              <Sticker k={k} size={24} />
            </button>
          ))}
        </div>
      </Row>

      <p className="text-xs text-[var(--text-muted)]">
        {full
          ? tf(t.notes.stickerLimit, { n: formatNumber(MAX_STICKERS) })
          : t.notes.stickerHint}
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="text-xs font-medium text-[var(--text-muted)] w-14 shrink-0">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
