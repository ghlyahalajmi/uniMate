import type {
  AvatarDesign, Backdrop, Hair, HairColour, Skin,
} from '@/lib/avatar/design';

/**
 * The avatar, drawn.
 *
 * Inline SVG built from a handful of keys: nothing to download, nothing that
 * can fail to load, and it scales from a 28px bar button to a 120px preview
 * without a second asset. The palettes live here rather than in the database,
 * so a tone can be corrected later without rewriting anyone's saved design.
 */

const SKIN: Record<Skin, { base: string; shade: string }> = {
  porcelain: { base: '#f6ded0', shade: '#e4c2ae' },
  sand:      { base: '#eec9a4', shade: '#d9a878' },
  tan:       { base: '#d9a06a', shade: '#bd8250' },
  olive:     { base: '#c08752', shade: '#a06b3d' },
  bronze:    { base: '#9a6237', shade: '#7c4b28' },
  deep:      { base: '#6d4326', shade: '#54321b' },
};

const HAIR: Record<HairColour, string> = {
  black:    '#221c2b',
  brown:    '#5a3a24',
  chestnut: '#7b4a2a',
  blonde:   '#d9ac5c',
  auburn:   '#8f3b28',
  grey:     '#9aa0ab',
};

const BACKDROP: Record<Backdrop, string> = {
  violet: '#4f3dd4',
  mint:   '#2f9e77',
  sky:    '#2f7fc4',
  rose:   '#c24d7c',
  amber:  '#c98a2b',
  slate:  '#5a6474',
};

export function AvatarArt({
  design, size = 40, className,
}: {
  design: AvatarDesign;
  size?: number;
  className?: string;
}) {
  const skin = SKIN[design.skin];
  const hair = HAIR[design.hairColour];
  // The clip is per-instance: two avatars on one page sharing an id would
  // clip each other, and the bar and the picker are on screen together.
  const clipId = `av-${design.backdrop}-${design.skin}-${design.hair}-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="presentation"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <clipPath id={clipId}><circle cx="32" cy="32" r="32" /></clipPath>
      </defs>

      <circle cx="32" cy="32" r="32" fill={BACKDROP[design.backdrop]} />

      <g clipPath={`url(#${clipId})`}>
        {/* Shoulders, clipped by the disc so the head sits in it, not on it. */}
        <ellipse cx="32" cy="63" rx="20" ry="14" fill="#fff" fillOpacity="0.92" />

        <BackHair hair={design.hair} colour={hair} />

        <rect x="27" y="38" width="10" height="10" rx="4" fill={skin.shade} />
        <ellipse cx="32" cy="29" rx="13" ry="14.5" fill={skin.base} />

        {/* Ears sit under a covering, so a covering means no ears. */}
        {design.hair === 'hijab' || design.hair === 'ghutra' ? null : (
          <>
            <circle cx="19.5" cy="30" r="2.6" fill={skin.shade} />
            <circle cx="44.5" cy="30" r="2.6" fill={skin.shade} />
          </>
        )}

        <FrontHair hair={design.hair} colour={hair} />
        <Face face={design.face} />
        <Extra extra={design.extra} />
      </g>
    </svg>
  );
}

function BackHair({ hair, colour }: { hair: Hair; colour: string }) {
  switch (hair) {
    case 'long':   return <ellipse cx="32" cy="34" rx="17" ry="20" fill={colour} />;
    case 'wavy':   return <ellipse cx="32" cy="32" rx="16" ry="17" fill={colour} />;
    case 'curly':  return <ellipse cx="32" cy="27" rx="16.5" ry="16" fill={colour} />;
    case 'hijab':  return <ellipse cx="32" cy="34" rx="18" ry="21" fill={colour} />;
    case 'ghutra': return <ellipse cx="32" cy="34" rx="18" ry="21" fill="#f2efe7" />;
    default:       return null;
  }
}

function FrontHair({ hair, colour }: { hair: Hair; colour: string }) {
  switch (hair) {
    case 'none':
      return null;
    case 'buzz':
      return <path d="M19 27a13 13 0 0 1 26 0c0-7-6-11-13-11s-13 4-13 11Z" fill={colour} opacity="0.85" />;
    case 'short':
      return <path d="M19 28c0-9 6-13 13-13s13 4 13 13c0-5-5-7-13-7s-13 2-13 7Z" fill={colour} />;
    case 'curly':
      return (
        <g fill={colour}>
          <circle cx="22" cy="20" r="6" /><circle cx="32" cy="16" r="7" />
          <circle cx="42" cy="20" r="6" /><circle cx="27" cy="16" r="5" />
          <circle cx="37" cy="16" r="5" />
        </g>
      );
    case 'bun':
      return (
        <g fill={colour}>
          <circle cx="32" cy="10" r="5.5" />
          <path d="M19 28c0-9 6-13 13-13s13 4 13 13c0-5-5-7-13-7s-13 2-13 7Z" />
        </g>
      );
    case 'long':
      return <path d="M19 28c0-10 6-14 13-14s13 4 13 14c0-6-5-8-13-8s-13 2-13 8Z" fill={colour} />;
    case 'wavy':
      return <path d="M19 28c0-9 6-14 13-14s13 5 13 14c-2-4-5-6-13-6s-11 2-13 6Z" fill={colour} />;
    case 'hijab':
      // A frame around the face, not a fringe: the covering *is* the hairline,
      // so no hair shows through it.
      return <path d="M32 12c-11 0-17 8-17 18h6c0-8 4-13 11-13s11 5 11 13h6c0-10-6-18-17-18Z" fill={colour} />;
    case 'ghutra':
      return (
        <g>
          <path d="M32 12c-11 0-17 8-17 18h6c0-8 4-13 11-13s11 5 11 13h6c0-10-6-18-17-18Z" fill="#f2efe7" />
          <rect x="16" y="12" width="32" height="6" rx="3" fill="#2c2c2c" />
        </g>
      );
    default:
      return null;
  }
}

function Face({ face }: { face: AvatarDesign['face'] }) {
  const eye = '#2a2431';
  switch (face) {
    case 'grin':
      return (
        <g>
          <circle cx="27" cy="28" r="1.9" fill={eye} />
          <circle cx="37" cy="28" r="1.9" fill={eye} />
          <path d="M26.5 33.5q5.5 5 11 0Z" fill="#fff" />
          <path d="M26.5 33.5q5.5 5 11 0" stroke={eye} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </g>
      );
    case 'calm':
      return (
        <g stroke={eye} strokeWidth="1.6" strokeLinecap="round" fill="none">
          <path d="M25 28.5q2 -1.6 4 0" /><path d="M35 28.5q2 -1.6 4 0" />
          <path d="M28.5 34h7" />
        </g>
      );
    case 'focus':
      return (
        <g>
          <circle cx="27" cy="28" r="1.9" fill={eye} />
          <circle cx="37" cy="28" r="1.9" fill={eye} />
          <g stroke={eye} strokeWidth="1.5" strokeLinecap="round" fill="none">
            <path d="M24 24.5q3 -1.5 6 -0.5" /><path d="M40 24.5q-3 -1.5 -6 -0.5" />
            <path d="M29 34h6" />
          </g>
        </g>
      );
    case 'wink':
      return (
        <g>
          <path d="M25 28.5q2 -2 4 0" stroke={eye} strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <circle cx="37" cy="28" r="1.9" fill={eye} />
          <path d="M28 33.5q4 3.5 8 0" stroke={eye} strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </g>
      );
    default:
      return (
        <g>
          <circle cx="27" cy="28" r="1.9" fill={eye} />
          <circle cx="37" cy="28" r="1.9" fill={eye} />
          <path d="M28 33.5q4 3.5 8 0" stroke={eye} strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </g>
      );
  }
}

function Extra({ extra }: { extra: AvatarDesign['extra'] }) {
  switch (extra) {
    case 'glasses':
      return (
        <g stroke="#2a2431" strokeWidth="1.5" fill="none">
          <circle cx="27" cy="28" r="5" /><circle cx="37" cy="28" r="5" />
          <path d="M32 28h0.5" /><path d="M22 27h-2" /><path d="M42 27h2" />
        </g>
      );
    case 'shades':
      return (
        <g>
          <rect x="21.5" y="24.5" width="10" height="7" rx="3" fill="#2a2431" />
          <rect x="32.5" y="24.5" width="10" height="7" rx="3" fill="#2a2431" />
          <path d="M31.5 27h1.5" stroke="#2a2431" strokeWidth="1.5" />
        </g>
      );
    case 'earrings':
      return (
        <g fill="var(--logo-accent, #e8b463)">
          <circle cx="19.5" cy="34" r="1.8" /><circle cx="44.5" cy="34" r="1.8" />
        </g>
      );
    case 'freckles':
      return (
        <g fill="#b9764d" opacity="0.6">
          <circle cx="24.5" cy="31" r="0.8" /><circle cx="27" cy="32" r="0.8" />
          <circle cx="39.5" cy="31" r="0.8" /><circle cx="37" cy="32" r="0.8" />
        </g>
      );
    default:
      return null;
  }
}
