'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n/provider';
import { MateBotFace } from '@/components/brand/mate-bot';

/**
 * Mate, once you are signed in: the landing page's character shrunk to a
 * button in the bottom corner that opens the assistant.
 *
 * A link rather than a button, and to the real `/assistant` page rather than
 * a popover chat, so the conversation keeps its own URL — it can be shared,
 * bookmarked, reached from the sidebar, and returned to with the back button.
 * A floating panel would lose all of that and cover the page it is meant to
 * help with.
 *
 * Placement:
 *  - `end-*`, not `right-*`. Bottom-right in English, bottom-left in Arabic,
 *    which is the same corner as far as the reader is concerned.
 *  - Lifted clear of the mobile bottom bar and its safe-area inset, so he
 *    never sits on top of the navigation on a phone.
 *  - `z-40`: above the bars at `z-30`, below modals at `z-50` and toasts at
 *    `z-[60]`, so a dialog's backdrop covers him instead of him floating over
 *    it.
 *
 * He hides himself on `/assistant` — a button that takes you to the page you
 * are already reading is noise, and there he would sit over the composer.
 */
export function AssistantLauncher() {
  const { t } = useI18n();
  const pathname = usePathname();

  // Shown whether or not an API key is configured. Without one the page he
  // opens says so in a sentence, which is a better answer than a corner that
  // is sometimes empty: the way to the assistant should be in the same place
  // every time you look for it.
  if (pathname === '/assistant' || pathname.startsWith('/assistant/')) return null;

  return (
    <Link
      href="/assistant"
      aria-label={t.assistant.launcherLabel}
      title={t.assistant.launcherLabel}
      className="group fixed z-40 end-4 lg:end-6
                 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-6
                 w-14 h-14 grid place-items-center rounded-full
                 text-[var(--text-on-accent)]
                 shadow-[var(--shadow-float)] ring-1 ring-white/15
                 transition-transform duration-200 hover:scale-105 active:scale-95
                 focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-[var(--accent)]"
      style={{
        background: 'linear-gradient(135deg, var(--color-violet-600), var(--color-violet-800))',
      }}
    >
      <MateBotFace size={30} />
      {/*
        The label fades in beside the button on hover, on a pointer device
        only — it scales rather than slides, so there is no direction to get
        wrong when the page flips to Arabic.
        It is `aria-hidden` because the link is already named above, and
        `pointer-events-none` so it can never swallow the click it decorates.
      */}
      <span
        aria-hidden="true"
        className="pointer-events-none hidden lg:block absolute end-full me-3 whitespace-nowrap
                   px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium
                   bg-[var(--bg-surface)] text-[var(--text-primary)]
                   border border-[var(--border-subtle)] shadow-[var(--shadow-card)]
                   opacity-0 scale-95 transition-[opacity,transform] duration-150
                   group-hover:opacity-100 group-hover:scale-100
                   group-focus-visible:opacity-100 group-focus-visible:scale-100"
      >
        {t.assistant.launcherHint}
      </span>
    </Link>
  );
}
