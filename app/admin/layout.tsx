import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Admin · UniMate', template: '%s · UniMate Admin' },
  // Nothing here belongs in a search result.
  robots: { index: false, follow: false },
};

/**
 * The admin side sits outside the student shell entirely — no tabs, no Mate,
 * no menu. Two products in one deployment, and the chrome should say so the
 * moment anyone looks at the screen.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[var(--bg-canvas)]">{children}</div>;
}
