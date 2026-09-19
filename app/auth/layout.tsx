import Link from 'next/link';
import { getDictionary } from '@/lib/i18n/server';
import { UniMateLogo } from '@/components/brand/logo';
import { HomeControls } from '@/components/marketing/home-controls';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getDictionary();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="inline-flex rounded-[var(--radius-sm)]">
          <UniMateLogo size={28} name={t.brand.name} />
        </Link>
        <div className="flex items-center gap-1">
          <HomeControls />
        </div>
      </header>
      <main id="main" className="flex-1 flex items-start sm:items-center justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-[420px]">{children}</div>
      </main>
    </div>
  );
}
