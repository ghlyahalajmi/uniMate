'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { Button, Card, CardHeader, cx } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { Icon } from '@/components/shell/icons';
import {
  BACKDROPS, EXTRAS, FACES, HAIRS, HAIR_COLOURS, SKINS,
  type AvatarDesign, type AvatarKind,
} from '@/lib/avatar/design';
import { AvatarArt } from './avatar-art';

type Dict = ReturnType<typeof useI18n>['t'];

/** Labels live in the dictionary under `avatar`, keyed by feature and value. */
function label(t: Dict, feature: string, value: string): string {
  return (t.avatar as unknown as Record<string, string>)[`${feature}_${value}`] ?? value;
}

/**
 * Choose a picture for the account: initials, a photo, or a character.
 *
 * The character is built from keys rather than drawn, which is what makes it
 * cheap enough to be worth having — no cropping, no upload, nothing to store
 * but six words, and it renders identically at 28px in the bar and 112px here.
 *
 * Every change previews immediately and saves only when asked, because a
 * picture is the one setting people fiddle with and half-formed faces should
 * not be appearing in the bar while they do.
 */
export function AvatarPicker({
  initialKind, initialDesign, photoUrl, initials,
}: {
  initialKind: AvatarKind;
  initialDesign: AvatarDesign;
  /** A signed link to the uploaded photo, when there is one. */
  photoUrl: string | null;
  initials: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<AvatarKind>(initialKind);
  const [design, setDesign] = useState<AvatarDesign>(initialDesign);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof AvatarDesign>(key: K, value: AvatarDesign[K]) {
    setDesign((prev) => ({ ...prev, [key]: value }));
  }

  function randomise() {
    const any = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
    setDesign({
      skin: any(SKINS), hair: any(HAIRS), hairColour: any(HAIR_COLOURS),
      face: any(FACES), extra: any(EXTRAS), backdrop: any(BACKDROPS),
    });
  }

  async function save(nextKind: AvatarKind) {
    setBusy(true);
    try {
      const res = await fetch('/api/avatar', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: nextKind, design }),
      });
      if (!(await res.json()).ok) { toast.error(t.errors.generic); return; }
      toast.success(t.avatar.saved);
      router.refresh();
    } catch {
      toast.error(t.errors.network);
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/avatar', { method: 'POST', body });
      const data = await res.json();
      if (!data.ok) {
        toast.error(
          data.error === 'file_too_large' ? t.errors.fileTooLarge
          : data.error === 'file_type' ? t.errors.fileType
          : t.errors.generic,
        );
        return;
      }
      setKind('photo');
      toast.success(t.avatar.saved);
      router.refresh();
    } catch {
      toast.error(t.errors.network);
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    setBusy(true);
    try {
      const res = await fetch('/api/avatar', { method: 'DELETE' });
      if (!(await res.json()).ok) { toast.error(t.errors.generic); return; }
      setKind('initials');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const kinds: Array<{ key: AvatarKind; label: string }> = [
    { key: 'initials', label: t.avatar.kindInitials },
    { key: 'photo', label: t.avatar.kindPhoto },
    { key: 'character', label: t.avatar.kindCharacter },
  ];

  return (
    <Card>
      <CardHeader title={t.avatar.title} subtitle={t.avatar.subtitle} />

      {/* What it will look like, at the size it will actually be used. */}
      <div className="flex items-center gap-4 mb-4">
        <Preview kind={kind} design={design} photoUrl={photoUrl} initials={initials} />
        <div className="flex flex-wrap gap-1.5">
          {kinds.map((k) => (
            <button
              key={k.key}
              type="button"
              aria-pressed={kind === k.key}
              onClick={() => {
                setKind(k.key);
                // Initials need no further choices, so the switch is the save.
                if (k.key === 'initials') void save('initials');
              }}
              className={cx(
                'px-3 min-h-[36px] rounded-[var(--radius-sm)] text-[0.8125rem] font-medium border transition-colors',
                kind === k.key
                  ? 'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {kind === 'photo' ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={busy}
              loadingLabel={t.avatar.uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Icon.upload size={17} />
              {t.avatar.upload}
            </Button>
            {photoUrl ? (
              <Button variant="ghost" onClick={() => void removePhoto()}>
                <Icon.trash size={16} />
                {t.avatar.removePhoto}
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-[var(--text-muted)]">{t.avatar.photoHint}</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label={t.avatar.upload}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = '';
            }}
          />
        </div>
      ) : null}

      {kind === 'character' ? (
        <div className="space-y-4">
          <Row label={t.avatar.skin} feature="skin" options={SKINS}
            value={design.skin} onPick={(v) => set('skin', v)} />
          <Row label={t.avatar.hair} feature="hair" options={HAIRS}
            value={design.hair} onPick={(v) => set('hair', v)} />
          {design.hair === 'none' ? null : (
            <Row label={t.avatar.hairColour} feature="hairColour" options={HAIR_COLOURS}
              value={design.hairColour} onPick={(v) => set('hairColour', v)} />
          )}
          <Row label={t.avatar.face} feature="face" options={FACES}
            value={design.face} onPick={(v) => set('face', v)} />
          <Row label={t.avatar.extra} feature="extra" options={EXTRAS}
            value={design.extra} onPick={(v) => set('extra', v)} />
          <Row label={t.avatar.backdrop} feature="backdrop" options={BACKDROPS}
            value={design.backdrop} onPick={(v) => set('backdrop', v)} />

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={randomise}>
              <Icon.sparkle size={17} />
              {t.avatar.randomise}
            </Button>
            <Button onClick={() => void save('character')} loading={busy} loadingLabel={t.common.saving}>
              <Icon.check size={17} />
              {t.avatar.save}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function Preview({
  kind, design, photoUrl, initials,
}: {
  kind: AvatarKind;
  design: AvatarDesign;
  photoUrl: string | null;
  initials: string;
}) {
  if (kind === 'character') {
    return <AvatarArt design={design} size={96} className="shrink-0" />;
  }
  if (kind === 'photo' && photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        width={96}
        height={96}
        className="shrink-0 w-24 h-24 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="shrink-0 grid place-items-center w-24 h-24 rounded-full text-2xl font-semibold bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)]"
    >
      {initials}
    </span>
  );
}

function Row<T extends string>({
  label: title, feature, options, value, onPick,
}: {
  label: string;
  feature: string;
  options: readonly T[];
  value: T;
  onPick: (value: T) => void;
}) {
  const { t } = useI18n();
  return (
    <fieldset>
      <legend className="text-[0.8125rem] font-medium mb-1.5">{title}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onPick(option)}
            className={cx(
              'px-3 min-h-[34px] rounded-[var(--radius-sm)] text-[0.8125rem] border transition-colors',
              value === option
                ? 'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)] font-medium'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
            )}
          >
            {label(t, feature, option)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
