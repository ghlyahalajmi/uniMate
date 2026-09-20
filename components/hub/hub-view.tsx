'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { Badge, Button, Card, CardHeader, cx } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { TextInput, TextArea, Select, Checkbox } from '@/components/ui/form';
import { Modal, useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/shell/page-header';
import { saveHubLink, deleteHubLink, toggleHubPin } from '@/lib/hub/actions';
import { hostOf, initialsOf } from '@/lib/hub/format';
import { actionMessage } from '@/lib/i18n/action-messages';
import type { ActionState } from '@/lib/data/actions';
import type { HubLinkKind } from '@/types/database';

const EMPTY: ActionState = {};
const KINDS: HubLinkKind[] = ['project', 'university', 'resource'];

export interface LinkRow {
  id: string;
  title: string;
  url: string;
  description: string | null;
  kind: HubLinkKind;
  isPinned: boolean;
}

export function HubView({ links }: { links: LinkRow[] }) {
  const { t, tf, formatNumber } = useI18n();
  const router = useRouter();
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LinkRow | null>(null);
  const [deleting, setDeleting] = useState<LinkRow | null>(null);
  const [, startTransition] = useTransition();

  const kindLabel = (k: HubLinkKind) =>
    k === 'project' ? t.hub.kindProject : k === 'university' ? t.hub.kindUniversity : t.hub.kindResource;

  function remove() {
    if (!deleting) return;
    const link = deleting;
    setDeleting(null);
    startTransition(async () => {
      const res = await deleteHubLink(link.id);
      if (res.ok) { toast.success(actionMessage(t, res.messageKey)); router.refresh(); }
      else toast.error(actionMessage(t, res.messageKey));
    });
  }

  function togglePin(link: LinkRow) {
    startTransition(async () => {
      const res = await toggleHubPin(link.id, !link.isPinned);
      if (res.ok) router.refresh();
      else toast.error(actionMessage(t, res.messageKey));
    });
  }

  const addButton = (
    <Button size="sm" variant="secondary" onClick={() => { setEditing(null); setFormOpen(true); }}>
      <Icon.plus size={16} />
      {t.hub.addLink}
    </Button>
  );

  return (
    <>
      <PageHeader title={t.hub.title} subtitle={t.hub.subtitle} action={addButton} />

      {links.length === 0 ? (
        <Card>
          <EmptyState
            title={t.hub.emptyTitle}
            body={t.hub.emptyBody}
            icon={<Icon.hub size={24} />}
            action={addButton}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {KINDS.map((kind) => {
            const group = links.filter((l) => l.kind === kind);
            if (group.length === 0) return null;

            return (
              <Card key={kind}>
                <CardHeader
                  title={kindLabel(kind)}
                  subtitle={
                    group.length === 1
                      ? t.hub.linkCountOne
                      : tf(t.hub.linkCount, { n: formatNumber(group.length) })
                  }
                />
                <ul className="grid gap-2 sm:grid-cols-2">
                  {group.map((l) => (
                    <li key={l.id}>
                      <LinkTile
                        link={l}
                        onEdit={() => { setEditing(l); setFormOpen(true); }}
                        onDelete={() => setDeleting(l)}
                        onTogglePin={() => togglePin(l)}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      {/* Keyed so switching which link is being edited remounts the form:
          otherwise the pin checkbox and any stale field errors carry over
          from the previous row. */}
      <LinkForm
        key={editing?.id ?? 'new'}
        open={formOpen}
        link={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title={t.hub.deleteConfirm}
        body={deleting?.title ?? ''}
      />
    </>
  );
}

function LinkTile({
  link, onEdit, onDelete, onTogglePin,
}: {
  link: LinkRow;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const { t } = useI18n();
  const host = hostOf(link.url);

  return (
    <div
      className={cx(
        'group relative h-full rounded-[var(--radius-md)] border p-3 transition-colors',
        link.isPinned
          ? 'border-[var(--accent)] bg-[var(--bg-accent-soft)]'
          : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="shrink-0 w-9 h-9 rounded-[var(--radius-sm)] grid place-items-center
                     text-xs font-semibold bg-[var(--bg-inset)] text-[var(--text-secondary)]"
        >
          {initialsOf(link.title)}
        </span>

        <div className="min-w-0 flex-1">
          {/*
            rel="noopener noreferrer" because these are addresses the student
            typed: without it the opened page gets a handle on this one through
            window.opener, and the referrer leaks the page they came from.
          */}
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 min-h-[32px] text-sm font-medium hover:underline"
          >
            <span className="min-w-0 break-words">{link.title}</span>
            <Icon.external size={13} className="shrink-0 text-[var(--text-muted)]" />
            <span className="sr-only">{t.hub.opensNewTab}</span>
          </a>

          {host ? (
            <p className="text-xs text-[var(--text-muted)] break-all">{host}</p>
          ) : null}

          {link.description ? (
            <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">{link.description}</p>
          ) : null}

          {link.isPinned ? (
            <Badge tone="accent" className="mt-2" icon={<Icon.pin size={11} />}>{t.hub.pinned}</Badge>
          ) : null}
        </div>
      </div>

      {/*
        Always in the DOM rather than revealed on hover: a control that only
        appears on hover is unreachable on a phone, which is most of the time.
      */}
      <div className="flex justify-end gap-1 mt-2">
        <Button size="sm" variant="ghost" onClick={onTogglePin} aria-label={link.isPinned ? t.hub.unpin : t.hub.pin}>
          <Icon.pin size={14} className={link.isPinned ? 'text-[var(--accent)]' : undefined} />
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit} aria-label={t.hub.editLink}>
          <Icon.edit size={14} />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} aria-label={t.common.delete}>
          <Icon.trash size={14} />
        </Button>
      </div>
    </div>
  );
}

function LinkForm({
  open, link, onClose,
}: {
  open: boolean;
  link: LinkRow | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [pinned, setPinned] = useState(link?.isPinned ?? false);

  const [state, action, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await saveHubLink(prev, formData);
      if (result.ok) {
        toast.success(actionMessage(t, result.messageKey));
        router.refresh();
        onClose();
      } else if (result.messageKey) {
        toast.error(actionMessage(t, result.messageKey));
      }
      return result;
    },
    EMPTY,
  );

  return (
    <Modal open={open} onClose={onClose} title={link ? t.hub.editLink : t.hub.newLink}>
      <form action={action} className="space-y-4">
        {link ? <input type="hidden" name="id" value={link.id} /> : null}

        <TextInput
          label={t.hub.name} name="title" required
          defaultValue={link?.title ?? ''}
          error={state.errors?.title}
        />
        <TextInput
          label={t.hub.url} name="url" type="url" required
          defaultValue={link?.url ?? ''}
          placeholder="https://"
          hint={t.hub.urlHint}
          error={state.errors?.url}
        />
        <TextArea
          label={t.hub.description} name="description" rows={2}
          defaultValue={link?.description ?? ''}
          hint={t.common.optional}
          error={state.errors?.description}
        />
        <Select
          label={t.hub.kind} name="kind"
          defaultValue={link?.kind ?? 'resource'}
          options={[
            { value: 'project', label: t.hub.kindProject },
            { value: 'university', label: t.hub.kindUniversity },
            { value: 'resource', label: t.hub.kindResource },
          ]}
        />
        <Checkbox label={t.hub.pin} name="is_pinned" checked={pinned} onChange={setPinned} />

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button type="submit" loading={pending}>{t.common.save}</Button>
        </div>
      </form>
    </Modal>
  );
}
