'use client';

import { useSyncExternalStore } from 'react';

/**
 * The browser's clock, read safely in a component that also renders on the
 * server.
 *
 * Every time-of-day bug in this codebase has had the same cause: something
 * called `new Date()` during render, a client component rendered on the server
 * first, and the *server's* timezone answered. A student in Kuwait at 21:00
 * was told "Good afternoon" because in Virginia it was.
 *
 * So there is one way to ask for the time, and on the server it refuses:
 * `useBrowserNow` returns 0 during server render and hydration, meaning "not
 * known yet". Callers render a neutral state for 0 rather than a guess, and
 * the real value arrives on mount.
 */

/** Read at most one value per window, so React sees a stable snapshot. */
export function useBrowserNow(windowMs = 30_000): number {
  return useSyncExternalStore(
    (onChange) => {
      const id = setInterval(onChange, windowMs);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / windowMs) * windowMs,
    () => 0,
  );
}
