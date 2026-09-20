/**
 * One stroke-based icon set at a consistent 1.6 weight on a 24px grid, so the
 * navigation reads as a single family rather than mixed sources.
 */
type IconProps = { size?: number; className?: string };

function Svg({ size = 20, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const Icon = {
  dashboard: (p: IconProps) => (
    <Svg {...p}><rect x="3" y="3" width="7.5" height="8.5" rx="1.6" /><rect x="13.5" y="3" width="7.5" height="5" rx="1.6" /><rect x="13.5" y="11" width="7.5" height="10" rx="1.6" /><rect x="3" y="14.5" width="7.5" height="6.5" rx="1.6" /></Svg>
  ),
  courses: (p: IconProps) => (
    <Svg {...p}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" /><path d="M8 4v16" /></Svg>
  ),
  planner: (p: IconProps) => (
    <Svg {...p}><path d="M4 18V9m5 9V5m5 13v-6m5 6V7" /><path d="M3 21h18" /></Svg>
  ),
  grades: (p: IconProps) => (
    <Svg {...p}><path d="M5 3h14v18l-7-4-7 4V3Z" /><path d="M9.5 9.5 12 12l3-3.5" /></Svg>
  ),
  study: (p: IconProps) => (
    <Svg {...p}><path d="M12 4 3 8l9 4 9-4-9-4Z" /><path d="M6.5 10v4.8c0 1.1 2.5 2.7 5.5 2.7s5.5-1.6 5.5-2.7V10" /><path d="M21 8v5" /></Svg>
  ),
  syllabi: (p: IconProps) => (
    <Svg {...p}><path d="M6 3h8l5 5v13H6V3Z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></Svg>
  ),
  tasks: (p: IconProps) => (
    <Svg {...p}><path d="M4 6.5 6 8.5 9.5 5" /><path d="M4 13.5 6 15.5 9.5 12" /><path d="M13 7h7M13 14h7M13 20h7" /></Svg>
  ),
  notes: (p: IconProps) => (
    <Svg {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m8 9 1.5 1.5L12.5 7.5" /><path d="M8 15h8" /></Svg>
  ),
  calendar: (p: IconProps) => (
    <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>
  ),
  analytics: (p: IconProps) => (
    <Svg {...p}><path d="M3 20h18" /><path d="M5 20V13m4.5 7V7m4.5 13v-5m4.5 5V10" /></Svg>
  ),
  records: (p: IconProps) => (
    <Svg {...p}><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></Svg>
  ),
  assistant: (p: IconProps) => (
    <Svg {...p}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4V5.5Z" /><path d="M9 10h.01M12 10h.01M15 10h.01" /></Svg>
  ),
  settings: (p: IconProps) => (
    <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H2a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H8a1.6 1.6 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V8a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></Svg>
  ),
  menu: (p: IconProps) => (<Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>),
  close: (p: IconProps) => (<Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>),
  plus: (p: IconProps) => (<Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>),
  chevronEnd: (p: IconProps) => (<Svg {...p}><path d="m9 5 7 7-7 7" /></Svg>),
  chevronDown: (p: IconProps) => (<Svg {...p}><path d="m5 9 7 7 7-7" /></Svg>),
  globe: (p: IconProps) => (
    <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3.6 9h16.8M3.6 15h16.8" /><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" /></Svg>
  ),
  sun: (p: IconProps) => (
    <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>
  ),
  moon: (p: IconProps) => (<Svg {...p}><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /></Svg>),
  upload: (p: IconProps) => (
    <Svg {...p}><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /><path d="M12 15V4M8 8l4-4 4 4" /></Svg>
  ),
  camera: (p: IconProps) => (
    <Svg {...p}><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 4.5h8L17.5 7h2A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-9Z" /><circle cx="12" cy="13" r="3.5" /></Svg>
  ),
  download: (p: IconProps) => (
    <Svg {...p}><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /><path d="M12 4v11M8 11l4 4 4-4" /></Svg>
  ),
  trash: (p: IconProps) => (
    <Svg {...p}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 13h10l1-13" /></Svg>
  ),
  edit: (p: IconProps) => (
    <Svg {...p}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="M14.5 6.5 17.5 9.5" /></Svg>
  ),
  check: (p: IconProps) => (<Svg {...p}><path d="m5 12.5 4.5 4.5L19 7" /></Svg>),
  clock: (p: IconProps) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5.5l3.5 2" /></Svg>),
  sparkle: (p: IconProps) => (
    <Svg {...p}><path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9L4.5 10.8 10.2 9 12 3.5Z" /><path d="M18.5 3.5v3M20 5h-3" /></Svg>
  ),
  alert: (p: IconProps) => (
    <Svg {...p}><path d="M12 4.5 21 19H3l9-14.5Z" /><path d="M12 10v4M12 17h.01" /></Svg>
  ),
  bell: (p: IconProps) => (
    <Svg {...p}><path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" /><path d="M10 18a2 2 0 0 0 4 0" /></Svg>
  ),
  logout: (p: IconProps) => (
    <Svg {...p}><path d="M10 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" /><path d="M15 16l4-4-4-4M19 12H9" /></Svg>
  ),
  search: (p: IconProps) => (<Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></Svg>),
  flame: (p: IconProps) => (
    <Svg {...p}><path d="M12 3s5 4.2 5 8.6a5 5 0 0 1-10 0C7 9.4 9 7.6 9 7.6s.5 1.9 1.7 2.6C11.4 8 12 5.4 12 3Z" /></Svg>
  ),
  trophy: (p: IconProps) => (
    <Svg {...p}><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 5.5H4.5A2.5 2.5 0 0 0 7 10M17 5.5h2.5A2.5 2.5 0 0 1 17 10" /><path d="M12 14v3M9 20h6M10 17h4" /></Svg>
  ),
  lock: (p: IconProps) => (
    <Svg {...p}><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" /></Svg>
  ),
  play: (p: IconProps) => (<Svg {...p}><path d="M8 5.5v13l10-6.5-10-6.5Z" /></Svg>),
  pause: (p: IconProps) => (<Svg {...p}><path d="M9 5v14M15 5v14" /></Svg>),
  stop: (p: IconProps) => (<Svg {...p}><rect x="6" y="6" width="12" height="12" rx="2" /></Svg>),
  share: (p: IconProps) => (
    <Svg {...p}><path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" /><path d="M12 15V4M8 8l4-4 4 4" /></Svg>
  ),
  // Two cards, the front one offset — a stack you work through.
  flashcards: (p: IconProps) => (
    <Svg {...p}><rect x="3" y="6.5" width="13" height="11" rx="2" /><path d="M8 4.5h10a2 2 0 0 1 2 2v9" /></Svg>
  ),
  // A list with one option filled in: pick one of several.
  options: (p: IconProps) => (
    <Svg {...p}><circle cx="5.5" cy="7" r="2.5" /><circle cx="5.5" cy="17" r="2.5" fill="currentColor" stroke="none" /><path d="M11 7h9M11 17h9" /></Svg>
  ),
  // A tick and a cross: one statement, two possible answers.
  trueFalse: (p: IconProps) => (
    <Svg {...p}><path d="M2.5 12.2 5.2 15l4.8-6" /><path d="M14.5 9.5l6 6M20.5 9.5l-6 6" /></Svg>
  ),
  // Two figures: the shared, class-wide page rather than your own.
  students: (p: IconProps) => (
    <Svg {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><path d="M16 5.6a3.2 3.2 0 0 1 0 5.9M17.5 14.4a5.5 5.5 0 0 1 3 5.1" /></Svg>
  ),
  // A grid of tiles: separate things gathered onto one page.
  hub: (p: IconProps) => (
    <Svg {...p}><rect x="4" y="4" width="7" height="7" rx="1.8" /><rect x="13" y="4" width="7" height="7" rx="1.8" /><rect x="4" y="13" width="7" height="7" rx="1.8" /><rect x="13" y="13" width="7" height="7" rx="1.8" /></Svg>
  ),
  // An arrow leaving a frame: this opens somewhere else.
  external: (p: IconProps) => (
    <Svg {...p}><path d="M13 5h6v6" /><path d="M19 5l-8 8" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></Svg>
  ),
  pin: (p: IconProps) => (
    <Svg {...p}><path d="M9 3h6l-.7 5.2 3 3.3H6.7l3-3.3L9 3Z" /><path d="M12 11.5V21" /></Svg>
  ),
  // Nodes joined left to right: something happens, then something follows.
  automation: (p: IconProps) => (
    <Svg {...p}><circle cx="5.5" cy="12" r="2.5" /><circle cx="18.5" cy="6.5" r="2.5" /><circle cx="18.5" cy="17.5" r="2.5" /><path d="M8 11.2 16 7.3M8 12.8l8 3.9" /></Svg>
  ),
  mail: (p: IconProps) => (
    <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></Svg>
  ),
  // A map pin: where an office is. Distinct from `pin`, the thumbtack that
  // pins a hub link to the top.
  location: (p: IconProps) => (
    <Svg {...p}><path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" /></Svg>
  ),
  person: (p: IconProps) => (
    <Svg {...p}><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></Svg>
  ),
};

export type IconName = keyof typeof Icon;
