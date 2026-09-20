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
 * The class's hub as it was originally published, outside UniMate.
 *
 * The Student Hub is a page here now, so this is only offered as one card on
 * it. It is a Vercel *preview* URL, tied to a branch rather than a project, so
 * it will stop resolving if that branch is renamed or deleted — swap it for a
 * production domain once there is one.
 */
export const STUDENT_HUB_URL =
  'https://myport-git-claude-upbeat-bohr-312ris-t021551-3544.vercel.app/hub';

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', icon: 'dashboard', label: (t) => t.nav.dashboard, primaryMobile: true },
  { href: '/courses',   icon: 'courses',   label: (t) => t.nav.courses,   primaryMobile: true },
  { href: '/grades',    icon: 'grades',    label: (t) => t.nav.grades,    primaryMobile: true },
  { href: '/tasks',     icon: 'tasks',     label: (t) => t.nav.tasks,     primaryMobile: true },
  { href: '/notes',     icon: 'notes',     label: (t) => t.nav.notes },
  { href: '/momentum',  icon: 'flame',     label: (t) => t.nav.momentum },
  { href: '/study',     icon: 'study',     label: (t) => t.nav.study },
  { href: '/flashcards', icon: 'flashcards', label: (t) => t.nav.flashcards },
  { href: '/planner',   icon: 'planner',   label: (t) => t.nav.planner },
  { href: '/syllabi',   icon: 'syllabi',   label: (t) => t.nav.syllabi },
  { href: '/calendar',  icon: 'calendar',  label: (t) => t.nav.calendar },
  { href: '/analytics', icon: 'analytics', label: (t) => t.nav.analytics },
  { href: '/records',   icon: 'records',   label: (t) => t.nav.records },
  { href: '/assistant', icon: 'assistant', label: (t) => t.nav.assistant },
  { href: '/automation', icon: 'automation', label: (t) => t.nav.automation },
  { href: '/hub',       icon: 'hub',        label: (t) => t.nav.hub },
  { href: '/student-hub', icon: 'students', label: (t) => t.nav.studentHub },
];

export const SETTINGS_ITEM: NavItem = {
  href: '/settings', icon: 'settings', label: (t) => t.nav.settings,
};
