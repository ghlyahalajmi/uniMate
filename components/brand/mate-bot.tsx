/**
 * Mate — the UniMate bot.
 *
 * Deliberately built out of the logo rather than beside it: the same violet
 * gradient, the same mortarboard, the same gold node on the end of the
 * tassel, and the mark's rising path worn across his chest. He reads as the
 * logo grown a face, not as a stock robot that happens to share a page with
 * it.
 *
 * Pure SVG and three keyframes — nothing to download, nothing that can fail
 * to load, and `prefers-reduced-motion` is honoured globally, so he simply
 * stands still for anyone who asks for that.
 *
 * Two shapes, because a character drawn for a 220px hero turns to mud at
 * 26px:
 *   `MateBot`     — the whole character, for the landing page.
 *   `MateBotFace` — the head alone, redrawn at launcher size with fewer and
 *                   fatter shapes so the eyes and the board still read.
 *
 * Both are decorative and carry `aria-hidden`: whatever wraps them owns the
 * accessible name.
 */

const VIOLET = '#4f3dd4';
const VIOLET_DEEP = '#2f2489';

export function MateBot({
  className = 'w-[220px]',
  idScope = 'mate-bot',
}: {
  className?: string;
  /** Override when two bots share a page, so their gradient ids stay unique. */
  idScope?: string;
}) {
  const body = `${idScope}-body`;
  const visor = `${idScope}-visor`;

  return (
    <svg
      viewBox="0 0 128 152"
      fill="none"
      role="presentation"
      aria-hidden="true"
      className={`${className} h-auto shrink-0 animate-bot-float drop-shadow-[0_14px_34px_rgba(79,61,212,0.26)]`}
    >
      {/* Grounds him: without it he reads as pasted on rather than standing. */}
      <ellipse cx="64" cy="147" rx="33" ry="4.5" fill="var(--text-primary)" opacity="0.07" />

      {/* Arms, drawn before the body so only their outer half shows. */}
      <rect x="20" y="104" width="10" height="26" rx="5" fill={`url(#${body})`} opacity="0.75" />
      <rect x="98" y="104" width="10" height="26" rx="5" fill={`url(#${body})`} opacity="0.75" />

      {/* Neck, behind the body and the head alike. */}
      <rect x="57" y="88" width="14" height="16" rx="5" fill={VIOLET_DEEP} />

      {/* Body */}
      <rect x="31" y="99" width="66" height="42" rx="17" fill={`url(#${body})`} />

      {/*
        The logo's rising path, worn as a badge — same three nodes, the gold
        one last, so what he carries is what the brand means.
      */}
      <path
        d="M45 128.5 55 122l10 4 13-10.5"
        stroke="#fff" strokeOpacity="0.8" strokeWidth="2.6"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="45" cy="128.5" r="2.6" fill="#fff" fillOpacity="0.9" />
      <circle cx="65" cy="126" r="2.6" fill="#fff" fillOpacity="0.9" />
      <circle cx="78" cy="115.5" r="3.2" fill="var(--logo-accent, #e8b463)" />

      {/* Side pods */}
      <rect x="13" y="55" width="9" height="19" rx="4.5" fill={`url(#${body})`} opacity="0.85" />
      <rect x="106" y="55" width="9" height="19" rx="4.5" fill={`url(#${body})`} opacity="0.85" />

      {/* Head */}
      <rect x="21" y="32" width="86" height="64" rx="24" fill={`url(#${body})`} />

      {/* Visor, and the face inside it */}
      <rect x="33" y="46" width="62" height="36" rx="17" fill={`url(#${visor})`} />
      <g className="animate-bot-blink" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <circle cx="52" cy="63" r="6" fill="#fff" />
        <circle cx="76" cy="63" r="6" fill="#fff" />
      </g>
      <path
        d="M56.5 73.5Q64 79.5 71.5 73.5"
        stroke="#fff" strokeOpacity="0.85" strokeWidth="2.6" strokeLinecap="round"
      />

      {/* The mortarboard, resting on his head exactly as it does on the mark. */}
      <path d="M64 10 112 26 64 42 16 26 64 10Z" fill="#fff" fillOpacity="0.96" />
      <path
        d="M106 29.5Q111.5 36 111 44"
        stroke="#fff" strokeOpacity="0.6" strokeWidth="2.2" strokeLinecap="round"
      />
      <circle
        cx="111" cy="48" r="4.6"
        fill="var(--logo-accent, #e8b463)"
        className="animate-bot-tassel"
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      />

      <defs>
        <linearGradient id={body} x1="16" y1="10" x2="112" y2="141" gradientUnits="userSpaceOnUse">
          <stop stopColor={VIOLET} />
          <stop offset="1" stopColor={VIOLET_DEEP} />
        </linearGradient>
        <linearGradient id={visor} x1="33" y1="46" x2="95" y2="82" gradientUnits="userSpaceOnUse">
          <stop stopColor="#221a63" />
          <stop offset="1" stopColor="#140f42" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * Mate's head alone, for the launcher.
 *
 * Not the full character scaled down — at 26px the arms, the badge and the
 * tassel cord collapse into noise. This keeps the four things that identify
 * him: the board, the visor, two eyes, and the gold node.
 */
export function MateBotFace({
  size = 26,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      role="presentation"
      aria-hidden="true"
      className={className}
    >
      {/* Side pods */}
      <rect x="2" y="20" width="4" height="9" rx="2" fill="#fff" fillOpacity="0.55" />
      <rect x="34" y="20" width="4" height="9" rx="2" fill="#fff" fillOpacity="0.55" />

      {/* Head */}
      <rect x="5" y="12" width="30" height="24" rx="10" fill="#fff" fillOpacity="0.96" />

      {/* Visor and eyes, in the button's own violet so they read as cut out. */}
      <rect x="10" y="17" width="20" height="14" rx="6" fill={VIOLET_DEEP} />
      <g className="animate-bot-blink" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <circle cx="16" cy="23" r="2.6" fill="#fff" />
        <circle cx="24" cy="23" r="2.6" fill="#fff" />
      </g>
      <path d="M17.5 27.5Q20 29.6 22.5 27.5" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.5" strokeLinecap="round" />

      {/* Board and tassel node */}
      <path d="M20 2 37 8 20 14 3 8 20 2Z" fill="#fff" />
      <circle cx="35" cy="13" r="2.6" fill="var(--logo-accent, #e8b463)" />
    </svg>
  );
}
