'use client';

import { useState, useTransition } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Button, Card, CardHeader } from '@/components/ui/primitives';
import { TextInput } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { Icon } from '@/components/shell/icons';
import { saveGradeScale } from '@/lib/data/actions';
import { actionMessage } from '@/lib/i18n/action-messages';
import { DEFAULT_GRADE_SCALE } from '@/lib/calculations/grades';

interface Row { letter: string; min_percent: number; points: number }

/**
 * The grading scale is per student and editable. No single university's
 * mapping is treated as universally correct.
 */
export function GradeScaleEditor({
  scale, onSaved,
}: {
  scale: Row[];
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>(() =>
    [...scale].sort((a, b) => b.min_percent - a.min_percent),
  );
  const [pending, startTransition] = useTransition();

  function update(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function save() {
    startTransition(async () => {
      const result = await saveGradeScale(rows.filter((r) => r.letter.trim()));
      if (result.ok) {
        toast.success(actionMessage(t, result.messageKey));
        onSaved();
      } else {
        toast.error(actionMessage(t, result.messageKey));
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title={t.grades.gradeScale}
        subtitle={t.grades.scaleSub}
        action={
          <Button
            size="sm" variant="ghost"
            onClick={() => setRows(DEFAULT_GRADE_SCALE.map(({ letter, min_percent, points }) => ({ letter, min_percent, points })))}
          >
            {t.grades.resetScale}
          </Button>
        }
      />

      <ul className="space-y-2.5">
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-3">
              <TextInput
                label={t.grades.letter}
                value={r.letter}
                onChange={(e) => update(i, { letter: e.target.value })}
              />
            </div>
            <div className="col-span-4">
              <TextInput
                label={t.grades.minPercent}
                type="number" step="0.5" min="0" max="100"
                value={r.min_percent}
                onChange={(e) => update(i, { min_percent: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-4">
              <TextInput
                label={t.grades.points}
                type="number" step="0.01" min="0" max="10"
                value={r.points}
                onChange={(e) => update(i, { points: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-1 flex justify-end">
              <button
                type="button"
                onClick={() => setRows((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : p))}
                aria-label={`${t.common.delete} ${r.letter}`}
                className="w-9 h-[42px] grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
              >
                <Icon.trash size={15} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2 mt-5">
        <Button
          variant="secondary" size="sm"
          onClick={() => setRows((p) => [...p, { letter: '', min_percent: 0, points: 0 }])}
        >
          <Icon.plus size={16} />
          {t.grades.addRow}
        </Button>
        <Button onClick={save} loading={pending} loadingLabel={t.common.saving} size="sm">
          {t.common.save}
        </Button>
      </div>
    </Card>
  );
}
