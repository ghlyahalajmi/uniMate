'use client';

import { LanguageSwitcher, ThemeToggle } from '@/components/shell/controls';

export function HomeControls() {
  return (
    <>
      <LanguageSwitcher compact />
      <ThemeToggle compact />
    </>
  );
}
