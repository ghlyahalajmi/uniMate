import type { Dictionary } from '@/lib/i18n';
import type { IconName } from './icons';

export interface NavItem {
  href: string;
  icon: IconName;
  label: (t: Dictionary) => string;
  /** Shown in the mobile bottom bar rather than behind "More". */
  primaryMobile?: boolean;
  /** Leaves UniMate: opened in a new tab and never marked as the current page. */
  external?: boolean;
}

/**
 * Three things are deliberately absent from this list, because each belongs
 * inside something else rather than beside it:
 *
 *   * Flashcards — a deck belongs to a course, so the way in is that course's
 *     Practice tab, alongside the two written question styles.
 *   * The Hub and Study groups — both are things you do *with* the class, so
 *     the way in is the Student Hub, which is where the class already is.
 *
 * All three routes still exist and are still linked to; none of them needs a
 * sidebar icon of its own.
 */
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
  { href: '/automation', icon: 'automation', label: (t) => t.nav.automation },
  { href: '/student-hub', icon: 'students', label: (t) => t.nav.studentHub },
];

export const SETTINGS_ITEM: NavItem = {
  href: '/settings', icon: 'settings', label: (t) => t.nav.settings,
};
