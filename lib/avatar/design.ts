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
  'none', 'short', 'curly', 'long', 'bun', 'wavy', 'buzz',
  // Headwear, listed with hair because that is where a student looks for it:
  // a covering is not an accessory worn over a hairstyle, it replaces one.
  'hijab', 'ghutra', 'shmagh',
] as const;
export type Hair = (typeof HAIRS)[number];

/**
 * The figure the avatar is built on.
 *
 * Two, because that is what was asked for and what covers most people here;
 * it changes the shoulders and the default clothing, nothing about the face.
 * Nobody is required to match it to anything — a student can pick either and
 * put whatever they like on top.
 */
export const FIGURES = ['female', 'male'] as const;
export type Figure = (typeof FIGURES)[number];

/**
 * What they are wearing.
 *
 * The Kuwaiti pieces are named properly — a dishdasha is not "a robe" and an
 * abaya is not "a black dress" — because a student from here will notice, and
 * the point of offering them is that they are recognised.
 */
export const OUTFITS = [
  'everyday', 'dishdasha', 'abaya', 'darraa', 'graduation',
] as const;
export type Outfit = (typeof OUTFITS)[number];

export const HAIR_COLOURS = ['black', 'brown', 'chestnut', 'blonde', 'auburn', 'grey'] as const;
export type HairColour = (typeof HAIR_COLOURS)[number];

export const FACES = ['smile', 'grin', 'calm', 'focus', 'wink'] as const;
export type Face = (typeof FACES)[number];

export const EXTRAS = ['none', 'glasses', 'shades', 'earrings', 'freckles'] as const;
export type Extra = (typeof EXTRAS)[number];

/** The disc behind the head. Keys again, resolved to CSS variables. */
export const BACKDROPS = [
  'violet', 'mint', 'sky', 'rose', 'amber', 'slate',
  // Kuwait, four ways: the weave, the towers, the boum, and the flag.
  'sadu', 'towers', 'dhow', 'flag',
] as const;
export type Backdrop = (typeof BACKDROPS)[number];

export interface AvatarDesign {
  figure: Figure;
  skin: Skin;
  hair: Hair;
  hairColour: HairColour;
  face: Face;
  extra: Extra;
  outfit: Outfit;
  backdrop: Backdrop;
}

export const DEFAULT_AVATAR: AvatarDesign = {
  figure: 'female',
  skin: 'sand',
  hair: 'short',
  hairColour: 'black',
  face: 'smile',
  extra: 'none',
  outfit: 'everyday',
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
    figure: pick(FIGURES, r.figure, DEFAULT_AVATAR.figure),
    skin: pick(SKINS, r.skin, DEFAULT_AVATAR.skin),
    hair: pick(HAIRS, r.hair, DEFAULT_AVATAR.hair),
    hairColour: pick(HAIR_COLOURS, r.hairColour, DEFAULT_AVATAR.hairColour),
    face: pick(FACES, r.face, DEFAULT_AVATAR.face),
    extra: pick(EXTRAS, r.extra, DEFAULT_AVATAR.extra),
    outfit: pick(OUTFITS, r.outfit, DEFAULT_AVATAR.outfit),
    backdrop: pick(BACKDROPS, r.backdrop, DEFAULT_AVATAR.backdrop),
  };
}

/**
 * Whole looks, in one tap.
 *
 * Six choices is not many, but it is six more than most people want to make
 * before they have seen what the thing can do. A preset lands them somewhere
 * finished, and every field stays editable afterwards — these are starting
 * points, not costumes you are locked into.
 */
export const PRESETS: ReadonlyArray<{ key: string; design: AvatarDesign }> = [
  {
    key: 'kuwaitiFemale',
    design: {
      figure: 'female', skin: 'sand', hair: 'hijab', hairColour: 'black',
      face: 'smile', extra: 'none', outfit: 'abaya', backdrop: 'sadu',
    },
  },
  {
    key: 'kuwaitiMale',
    design: {
      figure: 'male', skin: 'tan', hair: 'ghutra', hairColour: 'black',
      face: 'calm', extra: 'none', outfit: 'dishdasha', backdrop: 'towers',
    },
  },
  {
    key: 'darraa',
    design: {
      figure: 'female', skin: 'olive', hair: 'long', hairColour: 'black',
      face: 'grin', extra: 'earrings', outfit: 'darraa', backdrop: 'dhow',
    },
  },
  {
    key: 'graduate',
    design: {
      figure: 'female', skin: 'bronze', hair: 'curly', hairColour: 'black',
      face: 'grin', extra: 'glasses', outfit: 'graduation', backdrop: 'violet',
    },
  },
];

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
