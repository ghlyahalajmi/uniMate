import type { Metadata, Viewport } from 'next';
import { Inter, Newsreader, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { getDictionary } from '@/lib/i18n/server';
import { I18nProvider } from '@/lib/i18n/provider';
import { ToastProvider } from '@/components/ui/toast';
import { ThemeScript } from '@/components/ui/theme-script';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-newsreader',
  display: 'swap',
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'UniMate — Your AI-powered university companion',
    template: '%s · UniMate',
  },
  description:
    'Organise your courses, understand your grades, plan your semester, and study with an AI that adapts to you.',
  applicationName: 'UniMate',
  authors: [{ name: 'UniMate' }],
  openGraph: {
    title: 'UniMate — Your AI-powered university companion',
    description:
      'Organise your courses, understand your grades, plan your semester, and study with an AI that adapts to you.',
    type: 'website',
  },
  manifest: '/manifest.webmanifest',
  /*
   * iOS ignores the manifest almost entirely: it takes the name from here, the
   * icon from apple-icon.png, and only opens standalone when `capable` says
   * so. `default` for the status bar keeps the clock and battery legible
   * against a light header, and dark mode repaints it from the theme colour.
   */
  appleWebApp: {
    capable: true,
    title: 'UniMate',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Installed on a phone, the page owns the whole screen including the strip
  // behind the notch and the home indicator; the shell already pads for both.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0e1a' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir } = await getDictionary();
  const isArabic = locale === 'ar';

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${inter.variable} ${newsreader.variable} ${plexArabic.variable}`}
      style={
        {
          // The Arabic face covers display and body; Latin keeps the serif display.
          '--font-sans-family': isArabic
            ? 'var(--font-plex-arabic)'
            : 'var(--font-inter)',
          '--font-display-family': isArabic
            ? 'var(--font-plex-arabic)'
            : 'var(--font-newsreader)',
        } as React.CSSProperties
      }
    >
      <body>
        <ThemeScript />
        <I18nProvider locale={locale}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
