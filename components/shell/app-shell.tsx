'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { UniMateLogo } from '@/components/brand/logo';
import { cx } from '@/components/ui/primitives';
import { Icon } from './icons';
import { NAV_ITEMS, SETTINGS_ITEM, type NavItem } from './nav-config';
import { LanguageSwitcher, ThemeToggle, SkipLink } from './controls';
import { AssistantLauncher } from '@/components/assistant/assistant-launcher';

interface ShellProps {
  children: React.ReactNode;
  user: { name: string | null; email: string; isDemo: boolean };
  /** Whether an API key is configured; Mate is hidden when it is not. */
  aiEnabled: boolean;
}

export function AppShell({ children, user, aiEnabled }: ShellProps) {
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

  return (
    <div className="min-h-dvh">
      <SkipLink />

      {/* Desktop sidebar ------------------------------------------------- */}
      <aside
        aria-label={t.nav.main}
        className={cx(
          'hidden lg:flex fixed inset-y-0 start-0 w-[248px] flex-col z-30',
          'bg-[var(--bg-surface)] border-e border-[var(--border-subtle)]',
        )}
      >
        <div className="px-5 py-5">
          <Link href="/dashboard" className="inline-flex items-center min-h-[40px] rounded-[var(--radius-sm)]">
            <UniMateLogo size={30} name={t.brand.name} />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <NavLink item={item} active={isActive(pathname, item.href)} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-3 py-3 border-t border-[var(--border-subtle)] space-y-0.5">
          <NavLink item={SETTINGS_ITEM} active={isActive(pathname, SETTINGS_ITEM.href)} />
          <LanguageSwitcher />
          <ThemeToggle />
          <UserChip user={user} />
        </div>
      </aside>

      {/* Mobile header --------------------------------------------------- */}
      <header
        className={cx(
          'lg:hidden sticky top-0 z-30 glass',
          'flex items-center justify-between gap-2 px-4 h-14 border-b',
        )}
      >
        <Link href="/dashboard" className="inline-flex items-center min-h-[40px] rounded-[var(--radius-sm)]">
          <UniMateLogo size={26} name={t.brand.name} />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle compact />
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t.a11y.openMenu}
            aria-expanded={drawerOpen}
            className="w-10 h-10 grid place-items-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:bg-[var(--bg-inset)]"
          >
            <Icon.menu size={22} />
          </button>
        </div>
      </header>

      {/* Mobile drawer --------------------------------------------------- */}
      {drawerOpen ? (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-[var(--color-ink-950)]/45"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.nav.main}
            className={cx(
              'absolute inset-y-0 end-0 w-[min(84vw,300px)] flex flex-col',
              'bg-[var(--bg-surface)] border-s border-[var(--border-subtle)] shadow-[var(--shadow-float)]',
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
                {NAV_ITEMS.map((item) => (
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
            <div className="p-3 border-t border-[var(--border-subtle)] space-y-0.5">
              <NavLink
                item={SETTINGS_ITEM}
                active={isActive(pathname, SETTINGS_ITEM.href)}
                onNavigate={() => setDrawerOpen(false)}
              />
              <LanguageSwitcher />
              <UserChip user={user} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Content --------------------------------------------------------- */}
      <div className="lg:ps-[248px]">
        <main
          id="main"
          className="px-4 sm:px-6 lg:px-8 py-5 sm:py-7 pb-24 lg:pb-10 max-w-[1180px] mx-auto"
        >
          {children}
        </main>
      </div>

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
                'flex flex-col items-center justify-center gap-0.5 min-h-[58px] px-1',
                'text-xs font-medium transition-colors',
                active ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]',
              )}
            >
              <Glyph size={21} />
              <span className="truncate max-w-full">{item.label(t)}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 min-h-[58px] px-1 text-xs font-medium text-[var(--text-muted)]"
        >
          <Icon.menu size={21} />
          <span>{t.nav.menu}</span>
        </button>
      </nav>

      {/*
        Mate, last in the tree so he is last in the tab order: he is a shortcut
        to a page the sidebar already lists, and nobody should have to tab past
        a floating button to reach the content.
      */}
      <AssistantLauncher aiEnabled={aiEnabled} />
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
    'flex items-center gap-3 px-3 min-h-[40px] rounded-[var(--radius-sm)]',
    'text-sm font-medium transition-colors duration-150',
    active
      ? 'bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)]'
      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]',
  );

  const body = (
    <>
      <Glyph size={19} />
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

function UserChip({ user }: { user: ShellProps['user'] }) {
  const { t } = useI18n();
  const initials = (user.name ?? user.email)
    .split(/[\s@.]+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]?.toUpperCase()).join('');

  return (
    <div className="flex items-center gap-2.5 px-2 py-2 mt-1">
      <span
        aria-hidden="true"
        className="w-8 h-8 shrink-0 rounded-full grid place-items-center text-xs font-semibold bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)]"
      >
        {initials || '·'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.8125rem] font-medium truncate">{user.name ?? user.email}</span>
        {user.isDemo ? (
          <span className="block text-xs text-[var(--warning)]">{t.common.demoData}</span>
        ) : (
          <span className="block text-xs text-[var(--text-muted)] truncate">{user.email}</span>
        )}
      </span>
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
