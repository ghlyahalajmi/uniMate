import Link from 'next/link';
import { getDictionary } from '@/lib/i18n/server';
import { UniMateLogo } from '@/components/brand/logo';
import { HomeControls } from '@/components/marketing/home-controls';
import { ScatterHero } from '@/components/marketing/scatter-hero';
import { HeroMark } from '@/components/marketing/hero-mark';
import { MateBot } from '@/components/brand/mate-bot';

export default async function HomePage() {
  const { t } = await getDictionary();

  const steps = [
    { n: '01', title: t.home.step1Title, body: t.home.step1Body },
    { n: '02', title: t.home.step2Title, body: t.home.step2Body },
    { n: '03', title: t.home.step3Title, body: t.home.step3Body },
  ];

  // "Plan smarter. Study better. Graduate stronger." set as three beats rather
  // than one long line. Arabic punctuates with the same full stop, so one split
  // serves both dictionaries; anything that does not split is left whole.
  const beats = t.brand.subTagline.split('.').map((b) => b.trim()).filter(Boolean);

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
            {/*
              The copy and Mate share the hero. Above `lg` he stands beside it
              in his own column; below that the grid collapses and he lands
              under the buttons, centred, rather than squeezing the headline
              into a gutter on a phone.
            */}
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12">
              <div className="max-w-2xl">
                {/* The logo builds itself before the page says a word. */}
                <div className="mb-6">
                  <HeroMark size={84} />
                </div>
                {/*
                  Name, then what it is, then what it gives you — three sizes,
                  one column, nothing repeated. The name is the only coloured
                  thing here, so the eye lands on it first.
                */}
                <h1
                  className="font-display text-[2.75rem] leading-[1.04] sm:text-7xl font-semibold text-balance-title animate-rise"
                  style={{ animationDelay: '0.40s' }}
                >
                  <span className="wordmark">{t.brand.name}</span>
                </h1>
                <p
                  className="font-display text-xl sm:text-[1.75rem] sm:leading-snug text-[var(--text-secondary)] mt-2.5 text-balance-title animate-rise"
                  style={{ animationDelay: '0.50s' }}
                >
                  {t.brand.tagline}
                </p>

                <ul
                  className="flex flex-wrap items-center gap-2 mt-5 animate-rise"
                  style={{ animationDelay: '0.60s' }}
                >
                  {beats.map((beat) => (
                    <li
                      key={beat}
                      className="inline-flex items-center px-3 py-1 rounded-full text-[0.8125rem] font-medium
                                 bg-[var(--bg-accent-soft)] text-[var(--accent-soft-text)]"
                    >
                      {beat}
                    </li>
                  ))}
                </ul>

                <p className="text-base text-[var(--text-secondary)] mt-6 leading-relaxed max-w-xl animate-rise" style={{ animationDelay: '0.70s' }}>
                  {t.home.heroSub}
                </p>
                <div className="flex flex-wrap gap-3 mt-8 animate-rise" style={{ animationDelay: '0.80s' }}>
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

              {/*
                Mate is a portrait here and nothing more — no bubble, no button,
                nothing to press. He introduces himself by standing there; the
                way in to him only appears once you are signed in, as the
                launcher in the corner of every page.
              */}
              <div
                className="justify-self-center lg:justify-self-end animate-rise"
                style={{ animationDelay: '0.9s' }}
              >
                <MateBot className="w-[168px] sm:w-[196px] lg:w-[232px]" />
              </div>
            </div>

            <div className="mt-12 sm:mt-16">
              <ScatterHero />
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
