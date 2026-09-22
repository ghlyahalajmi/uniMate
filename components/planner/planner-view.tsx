'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader, cx } from '@/components/ui/primitives';
import { AiThinking, EmptyState } from '@/components/ui/states';
import { Checkbox, TextInput } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import { deleteRecord, addPlannerCandidate } from '@/lib/data/actions';
import type { Weekday } from '@/types/database';

interface Candidate {
  id: string; code: string; name: string; credits: number;
  difficulty: number | null; status: string;
  days: Weekday[]; start: string | null; end: string | null;
}

interface Plan {
  id: string; name: string; workload: string; totalCredits: number;
  rationale: string | null; assumptions: string[]; isSelected: boolean; createdAt: string;
  courses: Array<{ id: string; code: string; name: string; credits: number }>;
}

export function PlannerView({ candidates, plans }: { candidates: Candidate[]; plans: Plan[] }) {
  const { t, tf, formatNumber, formatDate } = useI18n();
  const router = useRouter();
  const toast = useToast();

  /**
   * Which candidates are *excluded*, rather than which are chosen.
   *
   * Selecting was seeded once from the list at mount, so a course added
   * afterwards arrived unticked and silently sat out of the plan — the student
   * adds a course, watches it appear, and the planner ignores it. Tracking the
   * exclusions instead means the list can grow underneath and everything new
   * is in by default, which is what adding a candidate means.
   */
  const [excluded, setExcluded] = useState<string[]>([]);
  const selected = candidates.map((c) => c.id).filter((id) => !excluded.includes(id));
  const [semester, setSemester] = useState('');
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState<Plan | null>(null);

  // Adding a candidate, and how many of them the student actually wants.
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCredits, setNewCredits] = useState('3');
  const [targetCount, setTargetCount] = useState<number | null>(null);
  const [removing, setRemoving] = useState<Candidate | null>(null);

  async function addCandidate() {
    const code = newCode.trim();
    const name = newName.trim();
    if (!code || !name) return;
    setAdding(true);
    try {
      const result = await addPlannerCandidate({
        code, name,
        credits: Number(newCredits) || 0,
        semester: semester.trim() || null,
      });
      if (result.ok) {
        toast.success(tf(t.planner.candidateAdded, { code: code.toUpperCase() }));
        setNewCode('');
        setNewName('');
        router.refresh();
      } else {
        toast.error(
          result.messageKey === 'duplicateCourse'
            ? t.syllabusImport.duplicate
            : t.errors.generic,
        );
      }
    } finally {
      setAdding(false);
    }
  }

  async function generate() {
    if (selected.length === 0) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/planner', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          candidate_course_ids: selected,
          semester: semester.trim() || undefined,
          target_course_count: targetCount,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(t.planner.saved);
        router.refresh();
      } else {
        toast.error(t.errors.generic);
      }
    } catch {
      toast.error(t.errors.network);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <PageHeader title={t.planner.title} subtitle={t.planner.subtitle} />

      {/* Adding a candidate ------------------------------------------------
          Outside the `candidates.length === 0` branch on purpose: the list
          looked fixed precisely because the only way to change it was to
          already have nothing in it. */}
      <Card className="mb-5">
        <CardHeader title={t.planner.newCourse} subtitle={t.planner.newCourseSub} />
        <div className="grid gap-3 sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)_minmax(0,6rem)_auto] sm:items-end">
          <TextInput
            label={t.planner.codeLabel}
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="CE401"
          />
          <TextInput
            label={t.planner.nameLabel}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Control Systems"
          />
          <TextInput
            label={t.common.credits}
            type="number"
            value={newCredits}
            onChange={(e) => setNewCredits(e.target.value)}
          />
          <Button
            onClick={addCandidate}
            loading={adding}
            loadingLabel={t.common.saving}
            disabled={!newCode.trim() || !newName.trim()}
          >
            <Icon.plus size={17} />
            {t.planner.addIt}
          </Button>
        </div>
      </Card>

      <Card className="mb-5">
        <CardHeader title={t.planner.candidates} subtitle={t.planner.addCandidate} />
        {candidates.length === 0 ? (
          <EmptyState compact title={t.planner.candidates} body={t.planner.noCandidates} />
        ) : (
          <>
            <ul className="space-y-2.5">
              {candidates.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                  <Checkbox
                    label={`${c.code} — ${c.name}`}
                    description={[
                      `${formatNumber(c.credits)} ${t.common.credits}`,
                      c.difficulty ? `${t.courses.difficulty} ${c.difficulty}/5` : null,
                      c.days.length ? c.days.map((d) => t.weekdaysShort[d]).join(', ') : null,
                    ].filter(Boolean).join(' · ')}
                    checked={!excluded.includes(c.id)}
                    onChange={(on) =>
                      setExcluded((prev) => (on ? prev.filter((x) => x !== c.id) : [...prev, c.id]))
                    }
                  />
                  </div>
                  {/* Unticking keeps a course out of this run; removing takes
                      it off the list for good, which is the other half of
                      "add or remove courses". */}
                  <button
                    type="button"
                    onClick={() => setRemoving(c)}
                    aria-label={`${t.planner.removeCandidate}: ${c.code}`}
                    className="w-9 h-9 shrink-0 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  >
                    <Icon.trash size={15} />
                  </button>
                </li>
              ))}
            </ul>

            <fieldset className="mt-5">
              <legend className="text-[0.8125rem] font-medium">{t.planner.howMany}</legend>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 mb-2">{t.planner.howManySub}</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-pressed={targetCount === null}
                  onClick={() => setTargetCount(null)}
                  className={cx(
                    'px-3 min-h-[36px] rounded-[var(--radius-sm)] text-[0.8125rem] font-medium border transition-colors',
                    targetCount === null
                      ? 'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
                  )}
                >
                  {t.planner.letItChoose}
                </button>
                {[3, 4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={targetCount === n}
                    onClick={() => setTargetCount(n)}
                    className={cx(
                      'px-3 min-h-[36px] rounded-[var(--radius-sm)] text-[0.8125rem] font-medium border transition-colors tabular-nums',
                      targetCount === n
                        ? 'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
                    )}
                  >
                    {formatNumber(n)}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-5 grid sm:grid-cols-2 gap-4 items-end">
              <TextInput
                label={t.courses.semester}
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder="Spring 2027"
                hint={t.common.optional}
              />
              <Button
                onClick={generate}
                loading={generating}
                loadingLabel={t.planner.generating}
                disabled={selected.length === 0}
              >
                <Icon.sparkle size={17} />
                {t.planner.generate}
              </Button>
            </div>
          </>
        )}
      </Card>

      {generating ? (
        <Card><AiThinking stages={[t.ai.readingHistory, t.ai.weighingOptions, t.planner.generating]} /></Card>
      ) : null}

      {plans.length === 0 && !generating ? (
        <Card><EmptyState title={t.planner.compare} body={t.planner.empty} /></Card>
      ) : null}

      {/* The caveat belongs next to the plans, not at the top of a page that
          has none yet: read before there is anything to compare, it is a
          warning about nothing. */}
      {plans.length > 0 ? (
        <p className="text-[0.8125rem] text-[var(--text-secondary)] leading-relaxed mb-4">
          {t.planner.notBest}
        </p>
      ) : null}

      {plans.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((p) => {
            const conflicts = p.assumptions.filter((a) => a.startsWith('Timetable conflict:'));
            const assumptions = p.assumptions.filter((a) => !a.startsWith('Timetable conflict:'));
            return (
              <Card as="article" key={p.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-semibold">{p.name}</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{formatDate(p.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleting(p)}
                    aria-label={`${t.common.delete} ${p.name}`}
                    className="w-9 h-9 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] shrink-0 -me-1.5 -mt-1"
                  >
                    <Icon.trash size={15} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  <Badge tone={p.workload === 'intensive' ? 'warning' : p.workload === 'light' ? 'positive' : 'accent'}>
                    {p.workload === 'light' ? t.planner.light : p.workload === 'intensive' ? t.planner.intensive : t.planner.balanced}
                  </Badge>
                  <Badge>{formatNumber(p.totalCredits)} {t.common.credits}</Badge>
                  <Badge tone={conflicts.length ? 'danger' : 'positive'}>
                    {conflicts.length ? `${conflicts.length} ${t.planner.conflicts}` : t.planner.noConflicts}
                  </Badge>
                </div>

                <ul className="mt-4 space-y-1.5">
                  {p.courses.map((c) => (
                    <li key={c.id} className="text-sm flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{c.code}</span>
                        <span className="text-[var(--text-secondary)]"> — {c.name}</span>
                      </span>
                      <span className="text-xs tabular-nums text-[var(--text-muted)] shrink-0">
                        {formatNumber(c.credits)}
                      </span>
                    </li>
                  ))}
                </ul>

                {p.rationale ? (
                  <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                      {t.planner.rationale}
                    </p>
                    <p className="text-[0.8125rem] text-[var(--text-secondary)] leading-relaxed">{p.rationale}</p>
                  </div>
                ) : null}

                {conflicts.length ? (
                  <ul className="mt-3 space-y-1">
                    {conflicts.map((c) => (
                      <li key={c} className="text-xs text-[var(--danger)] flex items-start gap-1.5">
                        <span aria-hidden="true">⚠</span>
                        <span>{c.replace('Timetable conflict: ', '')}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {assumptions.length ? (
                  <details className="mt-3 group">
                    <summary className="text-xs font-medium cursor-pointer text-[var(--text-secondary)] list-none flex items-center gap-1.5">
                      <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
                      {t.planner.assumptions}
                    </summary>
                    <ul className="mt-2 ps-4 space-y-1">
                      {assumptions.map((a) => (
                        <li key={a} className="text-xs text-[var(--text-secondary)] list-disc">{a}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={t.planner.removeCandidate}
        body={removing ? `${removing.code} — ${removing.name}` : ''}
        onConfirm={async () => {
          if (!removing) return;
          await deleteRecord('courses', removing.id);
          setExcluded((prev) => prev.filter((x) => x !== removing.id));
          toast.success(t.planner.candidateRemoved);
          setRemoving(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t.common.delete}
        body={deleting?.name ?? ''}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteRecord('schedules', deleting.id);
          toast.success(t.planner.deleted);
          setDeleting(null);
          router.refresh();
        }}
      />
    </>
  );
}
