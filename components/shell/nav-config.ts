import type { Dictionary } from '@/lib/i18n';
import type { IconName } from './icons';

export interface NavItem {
  href: string;
  icon: IconName;
  label: (t: Dictionary) => string;
  /** Shown in the mobile bottom bar rather than behind "More". */
  primaryMobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', icon: 'dashboard', label: (t) => t.nav.dashboard, primaryMobile: true },
  { href: '/courses',   icon: 'courses',   label: (t) => t.nav.courses,   primaryMobile: true },
  { href: '/grades',    icon: 'grades',    label: (t) => t.nav.grades,    primaryMobile: true },
  { href: '/tasks',     icon: 'tasks',     label: (t) => t.nav.tasks,     primaryMobile: true },
  { href: '/notes',     icon: 'notes',     label: (t) => t.nav.notes },
  { href: '/momentum',  icon: 'flame',     label: (t) => t.nav.momentum },
  { href: '/study',     icon: 'study',     label: (t) => t.nav.study },
  { href: '/planner',   icon: 'planner',   label: (t) => t.nav.planner },
  { href: '/syllabi',   icon: 'syllabi',   label: (t) => t.nav.syllabi },
  { href: '/calendar',  icon: 'calendar',  label: (t) => t.nav.calendar },
  { href: '/analytics', icon: 'analytics', label: (t) => t.nav.analytics },
  { href: '/records',   icon: 'records',   label: (t) => t.nav.records },
  { href: '/assistant', icon: 'assistant', label: (t) => t.nav.assistant },
];

export const SETTINGS_ITEM: NavItem = {
  href: '/settings', icon: 'settings', label: (t) => t.nav.settings,
};
