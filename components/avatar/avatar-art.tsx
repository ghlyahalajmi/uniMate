import type {
  AvatarDesign, Backdrop, Figure, Hair, HairColour, Outfit, Skin,
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
  // The Kuwaiti four. Each is a base colour here and a scene below.
  sadu:   '#8c2f2a',
  towers: '#2f7fc4',
  dhow:   '#1f6f94',
  flag:   '#0f7b3d',
};

/** Sadu weaving: the dark of its geometry. The red ground is the disc itself. */
const SADU_DARK = '#1f1a18';

/**
 * What sits behind the head.
 *
 * Four of these are a flat disc and four are a small scene. A scene is drawn
 * behind the shoulders and clipped by the same circle, so nothing about the
 * figure changes — the backdrop is scenery, not a costume.
 */
function Scene({ backdrop }: { backdrop: Backdrop }) {
  switch (backdrop) {
    case 'sadu':
      // The weave, not a photograph of it: bands and triangles in the red,
      // black and white that a sadu piece is actually built from.
      return (
        <g>
          <rect x="0" y="16" width="64" height="4" fill="#f4ece0" />
          <rect x="0" y="44" width="64" height="4" fill="#f4ece0" />
          <g fill={SADU_DARK}>
            {[2, 12, 22, 32, 42, 52].map((x) => (
              <path key={x} d={`M${x} 20 L${x + 5} 13 L${x + 10} 20 Z`} />
            ))}
            {[2, 12, 22, 32, 42, 52].map((x) => (
              <path key={`b${x}`} d={`M${x} 44 L${x + 5} 51 L${x + 10} 44 Z`} />
            ))}
          </g>
          <rect x="0" y="30" width="64" height="2" fill="#f4ece0" opacity="0.7" />
        </g>
      );

    case 'towers':
      // Kuwait Towers: the two spheres on the big mast, the smaller mast
      // beside it. Read at 28px as a silhouette, which is how they read from
      // the Gulf Road anyway.
      return (
        <g>
          <rect x="0" y="46" width="64" height="18" fill="#1d5c8f" opacity="0.55" />
          <g fill="#eaf2fb" opacity="0.92">
            <rect x="43" y="14" width="2.4" height="34" rx="1.2" />
            <ellipse cx="44.2" cy="26" rx="7.5" ry="6" />
            <ellipse cx="44.2" cy="38" rx="4.6" ry="3.8" />
            <rect x="53" y="20" width="2" height="28" rx="1" />
            <ellipse cx="54" cy="30" rx="4.4" ry="3.6" />
          </g>
          <g fill="#7fb4dd" opacity="0.5">
            <ellipse cx="44.2" cy="26" rx="7.5" ry="2" />
            <ellipse cx="54" cy="30" rx="4.4" ry="1.3" />
          </g>
        </g>
      );

    case 'dhow':
      // A boum under sail on the water, which is the shape on the half-dinar
      // and on every wall in the country.
      return (
        <g>
          <rect x="0" y="44" width="64" height="20" fill="#0f5170" opacity="0.6" />
          <g fill="#f3f7fa" opacity="0.94">
            <path d="M44 16 L44 44 L26 44 Z" />
            <path d="M46 24 L46 44 L58 44 Z" opacity="0.85" />
          </g>
          <path d="M20 44 h34 l-5 6 H25 Z" fill="#7a4a24" />
          <g stroke="#bcd9ea" strokeWidth="1" opacity="0.5">
            <path d="M2 54h14" /><path d="M48 57h14" /><path d="M10 60h20" />
          </g>
        </g>
      );

    case 'flag':
      // Green, white, red, and the black trapezoid on the hoist.
      return (
        <g>
          <rect x="0" y="8" width="64" height="16" fill="#0f7b3d" />
          <rect x="0" y="24" width="64" height="16" fill="#f4f4f2" />
          <rect x="0" y="40" width="64" height="16" fill="#c1272d" />
          <path d="M0 8 H18 L12 24 V40 L18 56 H0 Z" fill="#141414" />
        </g>
      );

    default:
      return null;
  }
}

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
        <Scene backdrop={design.backdrop} />

        {/* The body, then whatever is worn over it. */}
        <Body figure={design.figure} outfit={design.outfit} />

        <BackHair hair={design.hair} colour={hair} />

        <rect x="27" y="38" width="10" height="10" rx="4" fill={skin.shade} />
        <ellipse cx="32" cy="29" rx="13" ry="14.5" fill={skin.base} />

        {/* Ears sit under a covering, so a covering means no ears. */}
        {design.hair === 'hijab' || design.hair === 'ghutra' || design.hair === 'shmagh' ? null : (
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

/**
 * Shoulders, and what is on them.
 *
 * The figure changes the silhouette — narrower and higher for one, broader
 * and squarer for the other — and the outfit is drawn into that shape rather
 * than laid on top of it, so a dishdasha reads as a dishdasha and not as a
 * white rectangle behind a head.
 */
function Body({ figure, outfit }: { figure: Figure; outfit: Outfit }) {
  const girl = figure === 'girl';
  const rx = girl ? 18 : 21;
  const ry = girl ? 13 : 14;
  const cy = girl ? 64 : 63;

  switch (outfit) {
    case 'dishdasha':
      // White, with the collar band and the placket down the front.
      return (
        <g>
          <ellipse cx="32" cy={cy} rx={rx} ry={ry} fill="#fbfaf6" />
          <path d="M26 52 h12 v3 h-12 Z" fill="#eae5da" />
          <rect x="31" y="54" width="2" height="10" fill="#e3ddd0" />
          <circle cx="32" cy="58" r="0.9" fill="#cfc6b4" />
          <circle cx="32" cy="62" r="0.9" fill="#cfc6b4" />
        </g>
      );

    case 'abaya':
      // Black, with the open front line that makes it an abaya rather than a
      // black shape.
      return (
        <g>
          <ellipse cx="32" cy={cy} rx={rx + 1} ry={ry} fill="#17161b" />
          <path d="M32 51 V64" stroke="#2e2c36" strokeWidth="1.2" />
          <path d="M24 53 q8 5 16 0" stroke="#2e2c36" strokeWidth="1" fill="none" />
        </g>
      );

    case 'darraa':
      // The embroidered neckline is the whole character of a darraa, so that
      // is what gets the detail rather than the cloth.
      return (
        <g>
          <ellipse cx="32" cy={cy} rx={rx} ry={ry} fill="#1f6f94" />
          <path d="M23 54 q9 7 18 0" stroke="var(--logo-accent, #e8b463)" strokeWidth="2" fill="none" />
          <g fill="var(--logo-accent, #e8b463)">
            <circle cx="26" cy="58" r="1" /><circle cx="32" cy="60" r="1" />
            <circle cx="38" cy="58" r="1" />
          </g>
        </g>
      );

    case 'graduation':
      return (
        <g>
          <ellipse cx="32" cy={cy} rx={rx} ry={ry} fill="#2a2431" />
          <path d="M26 51 L32 61 L38 51" fill="#f4f4f2" />
          <path d="M27 52 L24 64 h4 Z" fill="#7b1f2b" />
          <path d="M37 52 L40 64 h-4 Z" fill="#7b1f2b" />
        </g>
      );

    default:
      return <ellipse cx="32" cy={cy} rx={rx} ry={ry} fill="#fff" fillOpacity="0.92" />;
  }
}

function BackHair({ hair, colour }: { hair: Hair; colour: string }) {
  switch (hair) {
    case 'long':   return <ellipse cx="32" cy="34" rx="17" ry="20" fill={colour} />;
    case 'wavy':   return <ellipse cx="32" cy="32" rx="16" ry="17" fill={colour} />;
    case 'curly':  return <ellipse cx="32" cy="27" rx="16.5" ry="16" fill={colour} />;
    case 'hijab':  return <ellipse cx="32" cy="34" rx="18" ry="21" fill={colour} />;
    case 'ghutra': return <ellipse cx="32" cy="34" rx="18" ry="21" fill="#f2efe7" />;
    case 'shmagh': return <ellipse cx="32" cy="34" rx="18" ry="21" fill="#f0dcd8" />;
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
          {/* The agal: two black cords, not one band. That doubling is what
              makes it an agal rather than a headband, and it reads even at
              28px because the gap between the cords is the shape. */}
          <rect x="15" y="10.5" width="34" height="3" rx="1.5" fill="#15130f" />
          <rect x="15" y="15" width="34" height="3" rx="1.5" fill="#15130f" />
        </g>
      );

    case 'shmagh':
      return (
        <g>
          <path d="M32 12c-11 0-17 8-17 18h6c0-8 4-13 11-13s11 5 11 13h6c0-10-6-18-17-18Z" fill="#f0dcd8" />
          {/* The red check, suggested rather than drawn thread by thread —
              a lattice at this size is mud, a few crossings is a shmagh. */}
          <g stroke="#b4342c" strokeWidth="1.1" opacity="0.9">
            <path d="M18 18 L24 12" /><path d="M24 22 L32 12" /><path d="M32 22 L40 12" />
            <path d="M40 22 L46 15" />
            <path d="M16 20 H48" /><path d="M17 25 H47" />
          </g>
          <rect x="15" y="10.5" width="34" height="3" rx="1.5" fill="#15130f" />
          <rect x="15" y="15" width="34" height="3" rx="1.5" fill="#15130f" />
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
