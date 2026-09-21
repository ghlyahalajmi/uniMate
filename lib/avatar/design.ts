/**
 * The avatar a student builds for themselves.
 *
 * Every choice is a *key*, never a colour or a style: the database stores
 * `"hair": "curly"` and `"skin": "tan"`, the drawing decides what those look
 * like, and nothing a student picks can reach a style attribute. That is the
 * same rule the note designer follows, and it is why the parser below is
 * strict — a design read back out of jsonb is trusted no further than a set of
 * known words.
 *
 * Pure, so the choices can be tested without a browser or a database.
 */

export const SKINS = ['porcelain', 'sand', 'tan', 'olive', 'bronze', 'deep'] as const;
export type Skin = (typeof SKINS)[number];

export const HAIRS = [
  'none', 'short', 'curly', 'long', 'bun', 'wavy', 'buzz', 'hijab', 'ghutra',
] as const;
export type Hair = (typeof HAIRS)[number];

export const HAIR_COLOURS = ['black', 'brown', 'chestnut', 'blonde', 'auburn', 'grey'] as const;
export type HairColour = (typeof HAIR_COLOURS)[number];

export const FACES = ['smile', 'grin', 'calm', 'focus', 'wink'] as const;
export type Face = (typeof FACES)[number];

export const EXTRAS = ['none', 'glasses', 'shades', 'earrings', 'freckles'] as const;
export type Extra = (typeof EXTRAS)[number];

/** The disc behind the head. Keys again, resolved to CSS variables. */
export const BACKDROPS = ['violet', 'mint', 'sky', 'rose', 'amber', 'slate'] as const;
export type Backdrop = (typeof BACKDROPS)[number];

export interface AvatarDesign {
  skin: Skin;
  hair: Hair;
  hairColour: HairColour;
  face: Face;
  extra: Extra;
  backdrop: Backdrop;
}

export const DEFAULT_AVATAR: AvatarDesign = {
  skin: 'sand',
  hair: 'short',
  hairColour: 'black',
  face: 'smile',
  extra: 'none',
  backdrop: 'violet',
};

function pick<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (options as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * Read a design back out of storage.
 *
 * Never throws and never returns a partial design: an unknown key, a missing
 * field or a value from an older version of this list all fall back to the
 * default for that one feature, so a design saved last term still draws.
 */
export function parseAvatar(raw: unknown): AvatarDesign {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    skin: pick(SKINS, r.skin, DEFAULT_AVATAR.skin),
    hair: pick(HAIRS, r.hair, DEFAULT_AVATAR.hair),
    hairColour: pick(HAIR_COLOURS, r.hairColour, DEFAULT_AVATAR.hairColour),
    face: pick(FACES, r.face, DEFAULT_AVATAR.face),
    extra: pick(EXTRAS, r.extra, DEFAULT_AVATAR.extra),
    backdrop: pick(BACKDROPS, r.backdrop, DEFAULT_AVATAR.backdrop),
  };
}

/** Which of the three things the account's picture is. */
export const AVATAR_KINDS = ['initials', 'photo', 'character'] as const;
export type AvatarKind = (typeof AVATAR_KINDS)[number];

export function parseAvatarKind(value: unknown): AvatarKind {
  return pick(AVATAR_KINDS, value, 'initials');
}

/**
 * The initials shown when there is no photo and no character.
 *
 * Two letters at most, from a name if there is one and from the address if
 * there is not — an email is a poor name but a better answer than a blank
 * circle on a shared laptop.
 */
export function initialsFrom(name: string | null, email: string): string {
  return (name ?? email)
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '·';
}
