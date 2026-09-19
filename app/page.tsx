import Link from 'next/link';
import { getDictionary } from '@/lib/i18n/server';
import { UniMateLogo } from '@/components/brand/logo';
import { HomeControls } from '@/components/marketing/home-controls';
import { DashboardPreview } from '@/components/marketing/dashboard-preview';

export default async function HomePage() {
  const { t } = await getDictionary();

  const steps = [
    { n: '01', title: t.home.step1Title, body: t.home.step1Body },
    { n: '02', title: t.home.step2Title, body: t.home.step2Body },
    { n: '03', title: t.home.step3Title, body: t.home.step3Body },
  ];

  const features = [
    { title: t.home.f1, body: t.home.f1b },
    { title: t.home.f2, body: t.home.f2b },
    { title: t.home.f3, body: t.home.f3b },
    { title: t.home.f4, body: t.home.f4b },
    { title: t.home.f5, body: t.home.f5b },
    { title: t.home.f6, body: t.home.f6b },
  ];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 glass border-b">
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <UniMateLogo size={30} name={t.brand.name} />
          <div className="flex items-center gap-1.5">
            <HomeControls />
            <Link
              href="/auth/sign-in"
              className="hidden sm:inline-flex items-center px-3.5 min-h-[40px] rounded-[var(--radius-sm)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-inset)] transition-colors"
            >
              {t.home.signIn}
            </Link>
            <Link
              href="/auth/sign-up"
              className="inline-flex items-center px-4 min-h-[40px] rounded-[var(--radius-sm)] text-sm font-medium bg-[var(--accent)] text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] shadow-[var(--shadow-card)] transition-colors"
            >
              {t.home.getStarted}
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero ------------------------------------------------------------ */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                'radial-gradient(70% 55% at 50% -10%, var(--bg-accent-soft) 0%, transparent 70%)',
            }}
          />
          <div className="max-w-[1120px] mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-12 sm:pb-16">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                <span aria-hidden="true">✦</span>
                {t.brand.subTagline}
              </p>
              <h1 className="font-display text-[2.5rem] leading-[1.08] sm:text-6xl font-semibold mt-5 text-balance-title">
                {t.brand.name}
              </h1>
              <p className="font-display text-xl sm:text-2xl text-[var(--text-secondary)] mt-3 text-balance-title">
                {t.brand.tagline}
              </p>
              <p className="text-base text-[var(--text-secondary)] mt-5 leading-relaxed max-w-xl">
                {t.home.heroSub}
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  href="/auth/sign-up"
                  className="inline-flex items-center px-6 min-h-[48px] rounded-[var(--radius-sm)] font-medium bg-[var(--accent)] text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] shadow-[var(--shadow-lift)] transition-colors"
                >
                  {t.home.getStarted}
                </Link>
                <Link
                  href="/auth/sign-in"
                  className="inline-flex items-center px-6 min-h-[48px] rounded-[var(--radius-sm)] font-medium bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-colors"
                >
                  {t.home.signIn}
                </Link>
              </div>
            </div>

            <div className="mt-12 sm:mt-16">
              <DashboardPreview />
            </div>
          </div>
        </section>

        {/* How it works ----------------------------------------------------- */}
        <section className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <h2 className="font-display text-3xl font-semibold text-balance-title">{t.home.howItWorks}</h2>
            <ol className="grid gap-6 sm:grid-cols-3 mt-9">
              {steps.map((s) => (
                <li key={s.n}>
                  <p className="font-display text-4xl font-semibold text-[var(--accent)] opacity-35 leading-none">
                    {s.n}
                  </p>
                  <h3 className="font-display text-xl font-semibold mt-3">{s.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features --------------------------------------------------------- */}
        <section className="max-w-[1120px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <h2 className="font-display text-3xl font-semibold text-balance-title">{t.home.featuresTitle}</h2>
          <p className="text-[var(--text-secondary)] mt-2">{t.home.featuresSub}</p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-9">
            {features.map((f) => (
              <li
                key={f.title}
                className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-card)]"
              >
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA -------------------------------------------------------------- */}
        <section className="max-w-[1120px] mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
          <div
            className="rounded-[var(--radius-2xl)] p-8 sm:p-12 text-center"
            style={{
              background: 'linear-gradient(135deg, var(--color-violet-700), var(--color-violet-900))',
            }}
          >
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-white text-balance-title">
              {t.home.ctaTitle}
            </h2>
            <p className="text-[var(--color-violet-200)] mt-3 max-w-md mx-auto">{t.home.ctaBody}</p>
            <Link
              href="/auth/sign-up"
              className="inline-flex items-center px-7 min-h-[48px] rounded-[var(--radius-sm)] font-medium bg-white text-[var(--color-violet-800)] hover:bg-[var(--color-violet-50)] mt-7 transition-colors"
            >
              {t.home.getStarted}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <UniMateLogo size={24} name={t.brand.name} />
          <p className="text-xs text-[var(--text-muted)] max-w-md leading-relaxed">
            {t.home.footerNote}
          </p>
        </div>
      </footer>
    </div>
  );
}
