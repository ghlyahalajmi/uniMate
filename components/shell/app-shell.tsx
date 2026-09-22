'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { UniMateLogo } from '@/components/brand/logo';
import { MateBotFace } from '@/components/brand/mate-bot';
import { AvatarArt } from '@/components/avatar/avatar-art';
import { initialsFrom, type AvatarDesign, type AvatarKind } from '@/lib/avatar/design';
import { cx } from '@/components/ui/primitives';
import { Icon } from './icons';
import { NAV_ITEMS, type NavItem } from './nav-config';
import { LanguageSwitcher, ThemeToggle, SkipLink } from './controls';
import { AssistantLauncher } from '@/components/assistant/assistant-launcher';

interface ShellProps {
  children: React.ReactNode;
  user: {
    name: string | null;
    email: string;
    isDemo: boolean;
    avatarKind: AvatarKind;
    avatarDesign: AvatarDesign;
    /** Signed link to the uploaded photo, when the student chose one. */
    avatarUrl: string | null;
  };
}

export function AppShell({ children, user }: ShellProps) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const mobilePrimary = NAV_ITEMS.filter((i) => i.primaryMobile);
  const primary = NAV_ITEMS.filter((i) => i.primary);
  const secondary = NAV_ITEMS.filter((i) => !i.primary);

  return (
    <div className="min-h-dvh">
      <SkipLink />

      {/*
        One bar across the top, at every width.
        ------------------------------------------------------------------
        The sidebar used to be pinned open on a wide screen and hidden behind
        a hamburger on a narrow one, so the menu lived in two different places
        depending on the window — and the profile, the language and the
        day/night switch sat at the *bottom* of it, which is the last place
        anyone looks for their own account.

        Now the menu is three lines on the start edge at any size, and the
        three things a student reaches for without thinking are where they can
        see them: top of the page, end edge, in reading order.
      */}
      <header
        className={cx(
          'sticky top-0 z-30 glass border-b border-[var(--border-subtle)]',
          'flex items-center gap-2 px-3 sm:px-4 h-14',
        )}
      >
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={t.a11y.openMenu}
          aria-expanded={drawerOpen}
          aria-controls="app-menu"
          className={cx(
            'group w-10 h-10 shrink-0 grid place-items-center rounded-[var(--radius-sm)]',
            'text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]',
            'transition-colors',
          )}
        >
          <span
            aria-hidden="true"
            className="grid place-items-center transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-95"
          >
            <Icon.menu size={22} />
          </span>
        </button>

        <Link
          href="/dashboard"
          className="inline-flex items-center min-h-[40px] rounded-[var(--radius-sm)]"
        >
          <UniMateLogo size={26} name={t.brand.name} />
        </Link>

        <div className="ms-auto flex items-center gap-1">
          <LanguageSwitcher compact />
          <ThemeToggle compact />
          <ProfileButton user={user} />
        </div>
      </header>

      {/*
        The tabs, on a wide screen.
        ------------------------------------------------------------------
        A phone gets these along the bottom, where a thumb reaches; a desktop
        gets them directly under the bar, because a bottom bar on a 27-inch
        monitor is a long way from where anyone is looking. Same items, same
        selected state, same growing icon — one set of tabs shown twice, not
        two different navigations.
      */}
      <nav
        aria-label={t.nav.main}
        className={cx(
          'hidden lg:block sticky top-14 z-20 glass border-b border-[var(--border-subtle)]',
        )}
      >
        <ul className="flex items-stretch gap-1 px-4 max-w-[1180px] mx-auto overflow-x-auto">
          {primary.map((item) => {
            const active = isActive(pathname, item.href);
            const Glyph = Icon[item.icon];
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'group relative flex items-center gap-2 px-3 min-h-[46px] text-sm font-medium',
                    'transition-colors duration-200',
                    active
                      ? 'text-[var(--accent-soft-text)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      'grid place-items-center transition-transform duration-200 ease-out',
                      'group-hover:scale-125 group-active:scale-95',
                      active && 'scale-125',
                    )}
                  >
                    <Glyph size={18} />
                  </span>
                  <span className="whitespace-nowrap">{item.label(t)}</span>
                  {/* The underline is the selection, drawn on the edge the
                      eye follows along a row rather than as colour alone. */}
                  <span
                    aria-hidden="true"
                    className={cx(
                      'absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-[var(--accent)]',
                      'origin-center transition-transform duration-200',
                      active ? 'scale-x-100' : 'scale-x-0',
                    )}
                  />
                </Link>
              </li>
            );
          })}

          {/*
            Mate, at the end of the row.
            ----------------------------------------------------------------
            Decorative and nothing else: a picture inside a list of tabs that
            navigated somewhere would be a tab nobody labelled, and he already
            has a button of his own in the corner. `aria-hidden` and no tab
            stop, so a keyboard runs Home → Profile and stops, exactly as the
            row reads.

            Pushed to the end with margin rather than by stretching the list,
            so the tabs keep their own spacing and he simply occupies the space
            they were never using. The row keeps its horizontal scroll, so on a
            narrow desktop he is carried along with the tabs instead of forcing
            the page sideways.
          */}
          <li aria-hidden="true" className="ms-auto flex items-center shrink-0 ps-4">
            {/*
              On a violet disc, because that is what this drawing was made for.
              The face is white shapes with a deep-violet visor — it was drawn
              to sit on the assistant's violet button — so loose on a pale bar
              it was white on near-white and read as one flat blob. The disc is
              not decoration around it; it is the ground the shapes were cut
              out of.
            */}
            <span className="grid place-items-center w-9 h-9 rounded-full bg-[var(--accent)] shadow-[var(--shadow-soft)]">
              <MateBotFace size={26} />
            </span>
          </li>
        </ul>
      </nav>

      {/* The menu, at every size ----------------------------------------- */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-[var(--color-ink-950)]/45"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            id="app-menu"
            role="dialog"
            aria-modal="true"
            aria-label={t.nav.main}
            className={cx(
              // Opens from the edge the button sits on. Pressing three lines
              // on the left and watching a panel arrive from the right is a
              // small lie about where the menu lives.
              'absolute inset-y-0 start-0 w-[min(84vw,300px)] flex flex-col',
              'bg-[var(--bg-surface)] border-e border-[var(--border-subtle)] shadow-[var(--shadow-float)]',
            )}
          >
            <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border-subtle)]">
              <UniMateLogo size={26} name={t.brand.name} />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={t.a11y.closeMenu}
                className="w-10 h-10 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:bg-[var(--bg-inset)]"
              >
                <Icon.close size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-0.5">
                {primary.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      item={item}
                      active={isActive(pathname, item.href)}
                      onNavigate={() => setDrawerOpen(false)}
                    />
                  </li>
                ))}
              </ul>
              <p className="px-3 pt-5 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {t.nav.more}
              </p>
              <ul className="space-y-0.5">
                {secondary.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      item={item}
                      active={isActive(pathname, item.href)}
                      onNavigate={() => setDrawerOpen(false)}
                    />
                  </li>
                ))}
              </ul>
            </nav>
            {/* Language, theme and the account live in the bar above; repeating
                them here would be two places to change one setting. */}
            <div className="p-3 border-t border-[var(--border-subtle)]">
              <UserChip user={user} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Content --------------------------------------------------------- */}
      <main
        id="main"
        className="px-4 sm:px-6 lg:px-8 py-5 sm:py-7 pb-24 lg:pb-10 max-w-[1180px] mx-auto"
      >
        {children}
      </main>

      {/* Mobile bottom bar ----------------------------------------------- */}
      <nav
        aria-label={t.nav.main}
        className={cx(
          'lg:hidden fixed bottom-0 inset-x-0 z-30 glass border-t',
          'grid grid-cols-5 pb-[env(safe-area-inset-bottom)]',
        )}
      >
        {mobilePrimary.map((item) => {
          const active = isActive(pathname, item.href);
          const Glyph = Icon[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'group flex flex-col items-center justify-center gap-1 min-h-[58px] px-1',
                'text-xs font-medium transition-colors duration-200',
                active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]',
              )}
            >
              {/*
                The pill is what carries the selection on a phone: a 12px label
                in a tint nobody asked them to compare is not a state, and the
                icon alone moving is too subtle at arm's length.
              */}
              <span
                aria-hidden="true"
                className={cx(
                  'grid place-items-center w-12 h-7 rounded-full',
                  'transition-[background,transform] duration-200 ease-out',
                  'group-hover:scale-110 group-active:scale-90',
                  active ? 'bg-[var(--bg-accent-soft)] scale-110' : 'scale-100',
                )}
              >
                <Glyph size={20} />
              </span>
              <span className="truncate max-w-full leading-none">{item.label(t)}</span>
            </Link>
          );
        })}
      </nav>

      {/*
        Mate, last in the tree so he is last in the tab order: he is a shortcut
        to a page the sidebar already lists, and nobody should have to tab past
        a floating button to reach the content.
      */}
      <AssistantLauncher />
    </div>
  );
}

function NavLink({
  item, active, onNavigate,
}: {
  item: NavItem;
  active: boolean;
  /** Closes the mobile drawer at the point navigation starts. */
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const Glyph = Icon[item.icon];

  const className = cx(
    'group relative flex items-center gap-3 px-3 min-h-[42px] rounded-[var(--radius-sm)]',
    'text-sm font-medium transition-[background,color] duration-200',
    active
      ? 'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)]'
      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]',
  );

  const body = (
    <>
      {/*
        The marker on the start edge, not a colour change alone: it survives a
        colour-blind reading and it is the thing the eye tracks as the page
        changes. It scales from nothing rather than sliding, so there is no
        direction to get wrong when the page flips to Arabic.
      */}
      <span
        aria-hidden="true"
        className={cx(
          'absolute inset-y-1.5 -start-3 w-[3px] rounded-full bg-[var(--accent)]',
          'origin-center transition-transform duration-200',
          active ? 'scale-y-100' : 'scale-y-0',
        )}
      />
      {/*
        The icon grows a little on hover and a little more once the page is
        the current one — enough to feel answered, not enough to move the row.
      */}
      <span
        aria-hidden="true"
        className={cx(
          'grid place-items-center transition-transform duration-200 ease-out',
          'group-hover:scale-110 group-active:scale-95',
          active && 'scale-110',
        )}
      >
        <Glyph size={19} />
      </span>
      <span className="truncate">{item.label(t)}</span>
      {item.external ? (
        <Icon.external size={13} className="ms-auto shrink-0 text-[var(--text-muted)]" />
      ) : null}
    </>
  );

  // An item that leaves UniMate is a plain anchor, not a client-side route:
  // it opens in its own tab, and rel keeps the opened page from reaching back
  // through window.opener or reading where it came from.
  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className={className}
      >
        {body}
        <span className="sr-only">{t.hub.opensNewTab}</span>
      </a>
    );
  }

  return (
    <Link href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={className}>
      {body}
    </Link>
  );
}

/**
 * The account, as one round button at the top of every page.
 *
 * It is a link to Profile rather than a menu: a menu here would put sign-out
 * one slip away from the thing people actually press this for, and the profile
 * page already holds everything that menu would have listed.
 *
 * Initials rather than a generic silhouette, because on a shared laptop the
 * question this answers is "whose account am I in", and a silhouette answers
 * that for nobody.
 */
function ProfileButton({ user }: { user: ShellProps['user'] }) {
  const { t } = useI18n();

  return (
    <Link
      href="/settings"
      aria-label={`${t.nav.profile}${user.name ? ` — ${user.name}` : ''}`}
      title={user.name ?? user.email}
      className="group w-10 h-10 shrink-0 grid place-items-center rounded-full"
    >
      <span
        aria-hidden="true"
        className={cx(
          'grid place-items-center rounded-full overflow-hidden',
          'ring-0 ring-[var(--accent)] transition-[transform,box-shadow] duration-200 ease-out',
          'group-hover:scale-110 group-active:scale-95 group-hover:ring-2',
        )}
      >
        <AvatarFace user={user} size={32} />
      </span>
    </Link>
  );
}

/**
 * The account's face, drawn from whatever the student chose: an uploaded
 * photo, the character they built, or their initials.
 *
 * One component, because the picture at the top of the page and the picture in
 * the menu are the same account — a menu still showing initials after a photo
 * was set reads as a different person.
 */
function AvatarFace({ user, size }: { user: ShellProps['user']; size: number }) {
  const px = { width: size, height: size };

  if (user.avatarKind === 'photo' && user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.avatarUrl} alt="" width={size} height={size} style={px} className="rounded-full object-cover" />
    );
  }

  if (user.avatarKind === 'character') return <AvatarArt design={user.avatarDesign} size={size} />;

  return (
    <span
      style={px}
      className="grid place-items-center rounded-full text-xs font-semibold bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)]"
    >
      {initialsFrom(user.name, user.email)}
    </span>
  );
}

function UserChip({ user }: { user: ShellProps['user'] }) {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-2.5 px-2 py-2 mt-1">
      {/* The picture and the name are one target, and it goes where the
          picture is changed. Sign-out stays a sibling: a form inside a link
          is not a thing, and it should not be the easy thing to hit anyway. */}
      <Link
        href="/settings"
        className="flex items-center gap-2.5 min-w-0 flex-1 rounded-[var(--radius-sm)] p-1 -m-1 hover:bg-[var(--bg-inset)]"
      >
        <span aria-hidden="true" className="shrink-0 grid place-items-center rounded-full overflow-hidden">
          <AvatarFace user={user} size={32} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.8125rem] font-medium truncate">{user.name ?? user.email}</span>
          {user.isDemo ? (
            <span className="block text-xs text-[var(--warning)]">{t.common.demoData}</span>
          ) : (
            <span className="block text-xs text-[var(--text-muted)] truncate">{user.email}</span>
          )}
        </span>
      </Link>
      <form action="/auth/sign-out" method="post">
        <button
          type="submit"
          aria-label={t.common.signOut}
          title={t.common.signOut}
          className="w-8 h-8 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
        >
          <Icon.logout size={17} />
        </button>
      </form>
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
