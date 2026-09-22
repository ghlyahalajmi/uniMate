'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader, cx } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Icon } from '@/components/shell/icons';
import type { CourseMaterial } from '@/types/database';
import {
  MAX_MATERIALS, MATERIAL_ACCEPT, isReadableMaterial,
} from '@/lib/materials/limits';

/**
 * The files a course is taught from.
 *
 * Chapters rather than attachments: each one carries a name the student chose,
 * because "Week 7 — Z-transform" is what they will look for when Study with AI asks
 * which chapter to revise, and "lecture07_final_v2.pdf" is not.
 */
export function CourseMaterials({
  courseId, materials,
}: {
  courseId: string;
  materials: CourseMaterial[];
}) {
  const { t, tf, formatNumber } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const used = materials.length;
  const remaining = Math.max(0, MAX_MATERIALS - used);
  const full = remaining === 0;

  async function upload(files: FileList | File[]) {
    const chosen = Array.from(files);
    if (chosen.length === 0) return;

    if (chosen.length > remaining) {
      toast.error(tf(t.materials.limitHit, { max: MAX_MATERIALS, n: formatNumber(remaining) }));
      return;
    }

    setBusy(true);
    try {
      const body = new FormData();
      body.append('courseId', courseId);
      for (const f of chosen) body.append('files', f);

      const res = await fetch('/api/materials', { method: 'POST', body });
      const data = await res.json();

      if (!data.ok) {
        toast.error(
          data.error === 'material_limit'
            ? tf(t.materials.limitHit, { max: MAX_MATERIALS, n: formatNumber(data.remaining ?? 0) })
            : data.error === 'file_too_large' ? t.errors.fileTooLarge
            : data.error === 'file_type' ? t.errors.fileType
            : t.errors.generic,
        );
        return;
      }

      const savedCount = data.saved?.length ?? 0;
      if (savedCount > 0) toast.success(tf(t.materials.saved, { n: formatNumber(savedCount) }));
      if (data.failed?.length) {
        toast.error(tf(t.materials.someFailed, { n: formatNumber(data.failed.length) }));
      }
      router.refresh();
    } catch {
      toast.error(t.errors.network);
    } finally {
      setBusy(false);
    }
  }

  async function rename(id: string) {
    const title = draft.trim();
    setEditing(null);
    if (!title) return;
    try {
      const res = await fetch('/api/materials', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, title }),
      });
      if (!(await res.json()).ok) { toast.error(t.errors.generic); return; }
      router.refresh();
    } catch {
      toast.error(t.errors.network);
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch('/api/materials', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!(await res.json()).ok) { toast.error(t.errors.generic); return; }
      toast.success(t.materials.removed);
      router.refresh();
    } catch {
      toast.error(t.errors.network);
    }
  }

  return (
    <div className="space-y-4">
      <Card padded={false}>
        <div
          onDragOver={(e) => { if (!full) { e.preventDefault(); setDragging(true); } }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!full && e.dataTransfer.files?.length) void upload(e.dataTransfer.files);
          }}
          className={cx(
            'flex flex-col items-center justify-center text-center px-6 py-10 rounded-[var(--radius-lg)]',
            'border-2 border-dashed transition-colors',
            full ? 'border-[var(--border-subtle)] opacity-70'
              : dragging ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)]'
              : 'border-[var(--border-strong)]',
          )}
        >
          <Icon.syllabi size={28} className="text-[var(--text-muted)] mb-2.5" />
          <p className="text-sm font-medium">{t.materials.dropzone}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{t.materials.dropzoneHint}</p>

          <Button
            variant="secondary"
            className="mt-4"
            disabled={full}
            loading={busy}
            loadingLabel={t.materials.uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Icon.upload size={17} />
            {t.materials.add}
          </Button>

          <p className="text-xs text-[var(--text-muted)] mt-3 tabular-nums">
            {tf(t.materials.counted, { n: formatNumber(used), max: formatNumber(MAX_MATERIALS) })}
            {' · '}
            {full
              ? tf(t.materials.full, { max: formatNumber(MAX_MATERIALS) })
              : tf(t.materials.remaining, { n: formatNumber(remaining) })}
          </p>

          <input
            ref={fileRef} type="file" accept={MATERIAL_ACCEPT} multiple className="sr-only"
            aria-label={t.materials.add}
            onChange={(e) => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ''; }}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title={t.materials.title} subtitle={t.materials.subtitle} />

        {materials.length === 0 ? (
          <EmptyState compact title={t.materials.title} body={t.materials.empty} icon={<Icon.syllabi size={22} />} />
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {materials.map((m, i) => {
              const readable = isReadableMaterial(m.file_type);
              return (
                <li key={m.id} className="py-3 flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="w-7 h-7 shrink-0 grid place-items-center rounded-[0.55rem] bg-[var(--bg-inset)] text-xs tabular-nums text-[var(--text-secondary)]"
                  >
                    {formatNumber(i + 1)}
                  </span>

                  <div className="min-w-0 flex-1">
                    {editing === m.id ? (
                      <input
                        autoFocus
                        value={draft}
                        aria-label={t.materials.renameLabel}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => void rename(m.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void rename(m.id);
                          if (e.key === 'Escape') setEditing(null);
                        }}
                        className="w-full text-sm font-medium bg-[var(--bg-inset)] rounded-[var(--radius-sm)] px-2 py-1 border border-[var(--accent)]"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setEditing(m.id); setDraft(m.title); }}
                        title={t.materials.rename}
                        className="block w-full text-start text-sm font-medium truncate hover:underline"
                      >
                        {m.title}
                      </button>
                    )}
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{m.file_name}</p>
                    {!readable ? (
                      <p className="text-xs text-[var(--warning)] mt-1">{t.materials.notReadable}</p>
                    ) : null}
                  </div>

                  {readable ? null : <Badge tone="warning" className="shrink-0">{t.common.notSet}</Badge>}

                  <button
                    type="button"
                    onClick={() => void remove(m.id)}
                    aria-label={`${t.materials.removeOne}: ${m.title}`}
                    className="w-9 h-9 shrink-0 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  >
                    <Icon.trash size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
