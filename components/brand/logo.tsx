/**
 * UniMate mark: a graduation-cap diamond whose lower half resolves into an
 * upward path of three nodes — the academic route, read as a connected
 * network. One shape, works at 16px, no text dependency.
 */
export function UniMateMark({
  size = 32,
  className,
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <rect width="32" height="32" rx="9" fill="url(#unimate-bg)" />
      {/* Mortarboard */}
      <path d="M16 7.5 26 12l-10 4.5L6 12l10-4.5Z" fill="#fff" fillOpacity="0.96" />
      {/* Tassel cord dropping to the path */}
      <path d="M23.4 13.2v4.1" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.3" strokeLinecap="round" />
      {/* Ascending path of three nodes */}
      <path
        d="M9 24.2 13.7 21l4.6 2.1 4.8-4"
        stroke="#fff"
        strokeOpacity="0.85"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="24.2" r="1.9" fill="#fff" />
      <circle cx="18.3" cy="23.1" r="1.9" fill="#fff" />
      <circle cx="23.1" cy="19.1" r="2.3" fill="var(--logo-accent, #e8b463)" />
      <defs>
        <linearGradient id="unimate-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4f3dd4" />
          <stop offset="1" stopColor="#2f2489" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function UniMateLogo({
  size = 32,
  showWordmark = true,
  name = 'UniMate',
  className = '',
}: {
  size?: number;
  showWordmark?: boolean;
  name?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <UniMateMark size={size} />
      {showWordmark ? (
        <span
          className="font-display font-semibold tracking-tight"
          style={{ fontSize: size * 0.62, color: 'var(--text-primary)' }}
        >
          {name}
        </span>
      ) : null}
    </span>
  );
}
