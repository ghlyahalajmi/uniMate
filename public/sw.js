/**
 * The part of UniMate that runs when UniMate is not open.
 *
 * It exists for one job: a push arrives with no content, this asks the app
 * what is due — a reminder that has arrived, or a task whose day has gone
 * without it being finished — and shows it. Everything else a service worker is usually for —
 * caching pages, working offline — is deliberately absent. A cached academic
 * record is a stale academic record, and a grade that is one version behind is
 * worse than a grade you had to wait a second for.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

/**
 * The push carries nothing, by design: the browser's push service never sees
 * a course code or a deadline. The words come from UniMate's own API, over the
 * student's own session cookie, which a same-origin fetch from here still
 * carries.
 */
self.addEventListener('push', (event) => {
  event.waitUntil(showDue());
});

async function showDue() {
  const now = new Date();
  const day = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let due = [];
  try {
    const res = await fetch(`/api/reminders/due?day=${day}&time=${time}`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.due)) due = data.due;
    }
  } catch {
    // Offline, or the session has expired. Handled below.
  }

  /*
   * The server's window is generous — it wakes a device for anything due today
   * — because it does not know the phone's timezone. The phone does. If
   * nothing has actually arrived yet, say so quietly rather than inventing a
   * reminder: a browser will not let a push event end with no notification at
   * all, and its own "this site was updated in the background" notice is worse
   * than an honest one.
   */
  if (due.length === 0) {
    return self.registration.showNotification('UniMate', {
      body: 'Checked your reminders — nothing is due yet.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'unimate-quiet',
      silent: true,
    });
  }

  await Promise.all(
    due.slice(0, 3).map((r) =>
      self.registration.showNotification(r.title || 'UniMate', {
        body: r.body || 'Your reminder is due.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        // One notification per item, and re-waking never stacks duplicates.
        tag: `unimate-${r.id}`,
        renotify: true,
        requireInteraction: false,
        /*
         * Where tapping it should land. A missed task is only useful if the
         * tap goes to the task list; a reminder belongs on the calendar. The
         * words themselves were written by the server, in the student's own
         * language — a service worker has no dictionary.
         */
        data: { url: r.kind === 'task' ? '/tasks' : '/calendar' },
      }),
    ),
  );

  // Announced. Marking them here rather than on tap means a reminder read from
  // the lock screen and swiped away does not fire again an hour later.
  try {
    await fetch('/api/reminders/due', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: due.map((r) => r.id) }),
    });
  } catch {
    // It will be marked by the in-app watcher next time the app is opened.
  }
}

/** Tapping it opens the calendar — reusing a window UniMate already has open. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/calendar';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
