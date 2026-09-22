'use client';

import { useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { AiThinking } from '@/components/ui/states';
import { Icon } from '@/components/shell/icons';

export interface ReadRow {
  letter: string;
  min_percent: number;
  points: number;
  uncertainFields: string[];
}

type Phase = 'idle' | 'reading' | 'review' | 'error';

/**
 * "Add grading scale picture" — photograph the scale, check it, save it.
 *
 * Nothing is written by the read. Every GPA in UniMate is computed against
 * this scale, so a misread row would quietly change every figure the student
 * is ever shown: the rows come back on screen, anything the reader was unsure
 * of is flagged, and only pressing save replaces the stored scale.
 */
export function ScalePicture({
  onApply,
}: {
  /** Hands the confirmed rows to the scale editor, which owns saving them. */
  onApply: (rows: Array<{ letter: string; min_percent: number; points: number }>) => void;
}) {
  const { t, tf, formatNumber } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [rows, setRows] = useState<ReadRow[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function read(file: File) {
    setPhase('reading');
    setMessage(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/ai/grading-scale', { method: 'POST', body });
      const data = await res.json();

      if (!data.ok) {
        setMessage(t.grades.scaleError);
        setPhase('error');
        return;
      }
      if (!data.rows?.length) {
        setMessage(t.grades.scaleNothing);
        setPhase('error');
        return;
      }
      setRows(data.rows as ReadRow[]);
      setNotes(data.notes ?? []);
      setPhase('review');
    } catch {
      setMessage(t.errors.network);
      setPhase('error');
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="shrink-0 w-10 h-10 rounded-[var(--radius-md)] grid place-items-center
                     bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)]"
        >
          <Icon.camera size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold text-balance-title">{t.grades.scalePicture}</h2>
          <p className="text-[0.8125rem] text-[var(--text-secondary)] mt-1 leading-relaxed">
            {t.grades.scalePictureSub}
          </p>
        </div>
      </div>

      {phase === 'reading' ? (
        <AiThinking stages={[t.grades.scaleReading, t.ai.retrievingContext]} />
      ) : null}

      {phase !== 'reading' && phase !== 'review' ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="sr-only"
            aria-label={t.grades.scalePicture}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void read(f);
            }}
          />
          <Button
            variant="secondary"
            className="mt-3.5"
            onClick={() => fileRef.current?.click()}
          >
            <Icon.upload size={16} />
            {t.grades.scalePicture}
          </Button>
          {message ? (
            <p role="alert" className="text-[0.8125rem] text-[var(--danger)] mt-2.5">{message}</p>
          ) : null}
        </>
      ) : null}

      {phase === 'review' ? (
        <div className="mt-4 animate-fade-up">
          <p className="text-[0.8125rem] font-medium">
            {tf(t.grades.scaleFound, { n: formatNumber(rows.length) })}
          </p>

          {notes.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {notes.map((n) => (
                <li key={n} className="text-xs text-[var(--text-muted)]">{n}</li>
              ))}
            </ul>
          ) : null}

          <ul className="mt-3 divide-y divide-[var(--border-subtle)]">
            {rows.map((r, i) => (
              <li key={`${r.letter}-${i}`} className="py-2 flex items-center gap-3">
                <span className="w-12 shrink-0 font-medium text-sm">{r.letter}</span>
                <span className="flex-1 min-w-0 text-xs text-[var(--text-muted)] tabular-nums">
                  {formatNumber(r.min_percent)}% · {formatNumber(r.points, { maximumFractionDigits: 2 })}
                </span>
                {r.uncertainFields.length > 0 ? (
                  <Badge tone="warning">{t.grades.scaleCheck}</Badge>
                ) : null}
              </li>
            ))}
          </ul>

          <p className="text-xs text-[var(--text-muted)] mt-3 leading-relaxed">{t.grades.scaleReplaces}</p>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-3">
            <Button variant="secondary" onClick={() => { setPhase('idle'); setRows([]); setNotes([]); }}>
              {t.grades.scaleDiscard}
            </Button>
            <Button
              onClick={() => {
                onApply(rows.map((r) => ({ letter: r.letter, min_percent: r.min_percent, points: r.points })));
                setPhase('idle');
                setRows([]);
                setNotes([]);
              }}
            >
              <Icon.check size={16} />
              {t.grades.scaleApply}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
