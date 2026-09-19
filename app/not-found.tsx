import Link from 'next/link';
import { getDictionary } from '@/lib/i18n/server';
import { UniMateMark } from '@/components/brand/logo';

export default async function NotFound() {
  const { t } = await getDictionary();

  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <div className="text-center max-w-sm">
        <UniMateMark size={48} className="mx-auto mb-5" />
        <h1 className="font-display text-2xl font-semibold">{t.errors.notFound}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-2">{t.errors.notFoundBody}</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center px-5 min-h-[44px] rounded-[var(--radius-sm)] font-medium bg-[var(--accent)] text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] mt-6"
        >
          {t.nav.dashboard}
        </Link>
      </div>
    </div>
  );
}
