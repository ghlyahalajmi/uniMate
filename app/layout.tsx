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
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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
