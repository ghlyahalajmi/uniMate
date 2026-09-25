import type { MetadataRoute } from 'next';

/**
 * What a phone needs to keep UniMate on a home screen.
 *
 * The app was already usable on a phone — the layout has always folded to one
 * column and the navigation to a bottom bar. What it could not do was *stay*
 * there: every visit went through the browser, with a URL bar taking a tenth
 * of the screen and no icon anywhere.
 *
 * With this, Add to Home Screen gives it an icon and opens it standalone, so
 * the thing a student checks between two classes is one tap away rather than
 * a tab they have to find.
 *
 * `start_url` is the dashboard rather than the landing page: somebody who has
 * installed it has already decided, and does not need selling to again. The
 * middleware sends them to sign-in if the session has expired.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'UniMate — Your university companion',
    short_name: 'UniMate',
    description:
      'Your courses, grades, tasks and study plan in one place, in English and Arabic.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // Matches the light theme's page background, so the splash does not flash
    // white against a tinted interface.
    background_color: '#f7f8fa',
    theme_color: '#4f3dd4',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android crops this one to the launcher's own shape, so it is drawn
      // edge to edge with the mark pulled well inside the safe area.
      { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Today', short_name: 'Today', url: '/dashboard' },
      { name: 'Tasks', short_name: 'Tasks', url: '/tasks' },
      { name: 'Calendar', short_name: 'Calendar', url: '/calendar' },
    ],
  };
}
