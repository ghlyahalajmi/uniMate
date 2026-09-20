'use client';

/**
 * The UniMate mark, assembling itself.
 *
 * The same geometry as `UniMateMark` — this is the logo, not a decoration
 * that resembles it — staged so it builds in the order the shape is read:
 * the tile arrives, the mortarboard drops onto it, the tassel falls, the path
 * draws itself left to right, and the three nodes land along it, the gold one
 * last because it is where the path is going.
 *
 * The drawing is `stroke-dashoffset` against `pathLength="1"`, so the timing
 * is independent of the actual path length and the whole thing is two
 * attributes rather than a library. It plays once: a logo that loops is a
 * logo you stop seeing.
 *
 * Reduced motion is honoured globally — durations collapse and the finished
 * mark is simply there.
 */
export function HeroMark({ size = 96 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="presentation"
      aria-hidden="true"
      className="shrink-0 drop-shadow-[0_8px_24px_rgba(79,61,212,0.28)]"
    >
      <rect
        width="32" height="32" rx="9"
        fill="url(#hero-mark-bg)"
        className="animate-mark-tile"
        style={{ transformOrigin: '16px 16px' }}
      />

      <path
        d="M16 7.5 26 12l-10 4.5L6 12l10-4.5Z"
        fill="#fff" fillOpacity="0.96"
        className="animate-mark-drop"
        style={{ transformOrigin: '16px 12px' }}
      />

      <path
        d="M23.4 13.2v4.1"
        stroke="#fff" strokeOpacity="0.55" strokeWidth="1.3" strokeLinecap="round"
        pathLength={1} className="animate-mark-draw"
        style={{ animationDelay: '0.5s' }}
      />

      <path
        d="M9 24.2 13.7 21l4.6 2.1 4.8-4"
        stroke="#fff" strokeOpacity="0.85" strokeWidth="1.7"
        strokeLinecap="round" strokeLinejoin="round"
        pathLength={1} className="animate-mark-draw"
        style={{ animationDelay: '0.62s' }}
      />

      {[
        { cx: 9, cy: 24.2, r: 1.9, fill: '#fff', delay: '0.95s' },
        { cx: 18.3, cy: 23.1, r: 1.9, fill: '#fff', delay: '1.05s' },
        { cx: 23.1, cy: 19.1, r: 2.3, fill: 'var(--logo-accent, #e8b463)', delay: '1.18s' },
      ].map((n) => (
        <circle
          key={`${n.cx}-${n.cy}`}
          cx={n.cx} cy={n.cy} r={n.r} fill={n.fill}
          className="animate-mark-node"
          style={{ transformOrigin: `${n.cx}px ${n.cy}px`, animationDelay: n.delay }}
        />
      ))}

      <defs>
        <linearGradient id="hero-mark-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4f3dd4" />
          <stop offset="1" stopColor="#2f2489" />
        </linearGradient>
      </defs>
    </svg>
  );
}
