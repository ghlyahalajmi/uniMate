'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Button, Card, CardHeader } from '@/components/ui/primitives';
import { Icon } from '@/components/shell/icons';
import { useToast } from '@/components/ui/toast';

type State = 'checking' | 'unsupported' | 'blocked' | 'off' | 'on' | 'working';

/**
 * Reminders that arrive with the app closed.
 *
 * Permission has to be asked for by a press, not on load: a browser ignores a
 * permission prompt that nobody asked for, and a person who says no once is
 * hard to ask again. So the button says what it will do before it does it.
 *
 * On iPhone this only works once UniMate has been added to the home screen —
 * Safari refuses push to a plain tab — so that is said here rather than left
 * for the student to discover by the notification never arriving.
 */
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const { t } = useI18n();
  const toast = useToast();
  const [state, setState] = useState<State>('checking');

  /*
   * Derived rather than assigned in an effect: the effect below only asks the
   * browser what it already knows, and the answer is the state.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!publicKey
        || typeof window === 'undefined'
        || !('serviceWorker' in navigator)
        || !('PushManager' in window)
        || !('Notification' in window)) {
        if (!cancelled) setState('unsupported');
        return;
      }

      if (Notification.permission === 'denied') {
        if (!cancelled) setState('blocked');
        return;
      }

      try {
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (!cancelled) setState(sub ? 'on' : 'off');
      } catch {
        if (!cancelled) setState('off');
      }
    })();

    return () => { cancelled = true; };
  }, [publicKey]);

  async function enable() {
    if (!publicKey) return;
    setState('working');

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off');
        return;
      }

      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });

      const json = sub.toJSON();
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? null,
          auth: json.keys?.auth ?? null,
          userAgent: navigator.userAgent,
        }),
      });

      if (!res.ok) throw new Error('save failed');
      setState('on');
      toast.success(t.settings.pushOnToast);
    } catch {
      setState('off');
      toast.error(t.errors.generic);
    }
  }

  async function disable() {
    setState('working');
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = reg ? await reg.pushManager.getSubscription() : null;

      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }

      setState('off');
      toast.success(t.settings.pushOffToast);
    } catch {
      setState('on');
      toast.error(t.errors.generic);
    }
  }

  return (
    <Card className="mt-5">
      <CardHeader
        title={t.settings.pushTitle}
        action={
          state === 'on' ? (
            <Button variant="secondary" size="sm" onClick={() => void disable()}>
              {t.settings.pushDisable}
            </Button>
          ) : state === 'off' || state === 'working' ? (
            <Button size="sm" onClick={() => void enable()} loading={state === 'working'}>
              <Icon.bell size={15} />
              {t.settings.pushEnable}
            </Button>
          ) : undefined
        }
      />

      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
        {state === 'checking' ? t.settings.pushOffBody
          : state === 'unsupported' ? t.settings.pushUnsupported
          : state === 'blocked' ? t.settings.pushBlocked
          : state === 'on' ? t.settings.pushOnBody
          : t.settings.pushOffBody}
      </p>

      {/* Said before it is needed rather than after it has failed: on iPhone
          the button cannot work from a browser tab, and a person who presses
          it there deserves to know that before nothing happens. */}
      <p className="text-xs text-[var(--text-muted)] leading-relaxed mt-2.5">
        {t.settings.pushIphone}
      </p>
    </Card>
  );
}
