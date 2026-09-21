import type { Dictionary } from '@/lib/i18n';
import type { IconName } from './icons';

export interface NavItem {
  href: string;
  icon: IconName;
  label: (t: Dictionary) => string;
  /** In the first group of the sidebar: what a student uses every day. */
  primary?: boolean;
  /** Shown in the mobile bottom bar rather than behind the menu. */
  primaryMobile?: boolean;
  /** Leaves UniMate: opened in a new tab and never marked as the current page. */
  external?: boolean;
}

/**
 * The navigation, in two groups: the handful a student opens every day, then
 * everything else.
 *
 * Four things are deliberately absent, because each belongs inside something
 * rather than beside it:
 *
 *   * The syllabus — it describes one course, so the way in is that course's
 *     own Syllabus tab, which links on to the full syllabus workspace.
 *   * Flashcards — a deck belongs to a course, so the way in is that course's
 *     Practice tab, alongside the two written question styles.
 *   * The Hub and Study groups — both are things you do *with* the class, so
 *     the way in is the Student Hub, which is where the class already is.
 *
 * Every one of those routes still exists and is still linked to; none of them
 * needs a sidebar icon of its own.
 *
 * Mate is not here either, and not because he was forgotten: he is a floating
 * button in the corner of every page, and a second entry would be a second
 * thing to keep in step with the first.
 */
export const NAV_ITEMS: NavItem[] = [
  // The six a student touches daily, in the order a day runs: where am I, what
  // is due, what am I taking, when is it, how am I doing, and me.
  { href: '/dashboard', icon: 'dashboard', label: (t) => t.nav.home,      primary: true, primaryMobile: true },
  { href: '/tasks',     icon: 'tasks',     label: (t) => t.nav.tasks,     primary: true, primaryMobile: true },
  { href: '/courses',   icon: 'courses',   label: (t) => t.nav.courses,   primary: true, primaryMobile: true },
  { href: '/calendar',  icon: 'calendar',  label: (t) => t.nav.schedule,  primary: true, primaryMobile: true },
  { href: '/grades',    icon: 'grades',    label: (t) => t.grades.myGpa,  primary: true, primaryMobile: true },
  { href: '/notes',     icon: 'notes',     label: (t) => t.nav.notes,     primary: true },
  { href: '/settings',  icon: 'person',    label: (t) => t.nav.profile,   primary: true },

  // Everything else, one press further away.
  { href: '/journey',   icon: 'trophy',    label: (t) => t.nav.journey },
  { href: '/momentum',  icon: 'flame',     label: (t) => t.nav.momentum },
  { href: '/study',     icon: 'study',     label: (t) => t.nav.study },
  { href: '/planner',   icon: 'planner',   label: (t) => t.nav.planner },
  { href: '/analytics', icon: 'analytics', label: (t) => t.nav.analytics },
  { href: '/records',   icon: 'records',   label: (t) => t.nav.records },
  { href: '/assistant', icon: 'assistant', label: (t) => t.nav.assistant },
  { href: '/automation', icon: 'automation', label: (t) => t.nav.automation },
  { href: '/student-hub', icon: 'students', label: (t) => t.nav.studentHub },
];

/**
 * Kept for the places that still want to say "Settings" in words — the profile
 * entry above points at the same page.
 */
export const SETTINGS_ITEM: NavItem = {
  href: '/settings', icon: 'settings', label: (t) => t.nav.settings,
};
