'use client';

// "Notifications on this device" — the per-device opt-in for web push
// (docs/web-push-plan.md §6), on You → Notifications, below the email switch.
//
// NEVER a prompt on page load: the browser's question is asked only inside a
// click on the button — iOS refuses it anywhere else, and every browser
// penalises a page that asks unprompted. No props; it reads everything it
// needs in the browser, after hydration.
//
// It says nothing at all while push is dark on this stack (no VAPID keys):
// a button that cannot work is worse than no button.
//
// The states:
//   unsupported          the browser cannot show notifications
//   ios-not-installed    iPhone/iPad in Safari: install first (Help link)
//   ask                  the button
//   on                   on for this device · Turn off; other devices listed
//   blocked              the person said no to the browser; only they can undo it

import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { Button } from '@thefibre/shared/ui/button';
import { NOTICE } from '@thefibre/shared/ui/recipes';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { t } from '@/lib/i18n';
import { fmtDate } from '@/lib/format';
import {
  currentSubscription,
  listDevices,
  pushConfig,
  pushSupport,
  removeDevice,
  turnOffThisDevice,
  turnOn,
  type PushDevice,
} from '@/lib/push';

type State = 'loading' | 'dark' | 'unsupported' | 'ios-not-installed' | 'ask' | 'on' | 'blocked';

export function PushCard() {
  const locale = useLocale();
  const [state, setState] = useState<State>('loading');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [devices, setDevices] = useState<PushDevice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [mine, setMine] = useState<string | null>(null);

  async function refreshDevices() {
    const [list, sub] = await Promise.all([listDevices().catch(() => []), currentSubscription().catch(() => null)]);
    setMine(sub ? sub.endpoint.slice(-12) : null);
    setDevices(list);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      const key = await pushConfig().catch(() => null);
      if (!alive) return;
      if (!key) return setState('dark');
      setPublicKey(key);
      const support = pushSupport();
      if (support !== 'ok') return setState(support);
      if (Notification.permission === 'denied') return setState('blocked');
      const sub = await currentSubscription().catch(() => null);
      if (!alive) return;
      setState(sub && Notification.permission === 'granted' ? 'on' : 'ask');
      void refreshDevices();
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (state === 'loading' || state === 'dark') return null;

  async function on() {
    if (!publicKey) return;
    setBusy(true);
    setError(false);
    try {
      const r = await turnOn(publicKey);
      setState(r === 'on' ? 'on' : 'blocked');
      await refreshDevices();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function off() {
    setBusy(true);
    setError(false);
    await turnOffThisDevice();
    setState('ask');
    await refreshDevices();
    setBusy(false);
  }

  async function remove(id: string) {
    setError(false);
    try {
      await removeDevice(id);
      await refreshDevices();
    } catch {
      setError(true);
    }
  }

  // "Other devices": everything but this one, recognised by the tail of its
  // own endpoint (the API returns only that tail, never an endpoint).
  const others = devices.filter((d) => d.endpoint_hint !== mine);

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
        <BellRing size={16} strokeWidth={1.75} />
        {t(locale, 'push_title')}
      </h2>
      <div className="mt-3 space-y-3 rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-ink-subtle">{t(locale, 'push_intro')}</p>

        {state === 'unsupported' && <p className="text-sm text-ink-muted">{t(locale, 'push_unsupported')}</p>}

        {state === 'ios-not-installed' && (
          <p className="text-sm text-ink-muted">
            {t(locale, 'push_ios')}{' '}
            <a href="/help" className="underline underline-offset-2 hover:text-ink">
              {t(locale, 'push_ios_link')}
            </a>
          </p>
        )}

        {state === 'blocked' && <p className="text-sm text-ink-muted">{t(locale, 'push_blocked')}</p>}

        {state === 'ask' && (
          <Button type="button" onClick={() => void on()} disabled={busy}>
            {busy ? t(locale, 'push_turning_on') : t(locale, 'push_turn_on')}
          </Button>
        )}

        {state === 'on' && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink">{t(locale, 'push_on')}</p>
            <Button type="button" size="sm" variant="ghost" onClick={() => void off()} disabled={busy}>
              {t(locale, 'push_turn_off')}
            </Button>
          </div>
        )}

        {(state === 'ask' || state === 'on') && <p className="text-xs text-ink-muted">{t(locale, 'push_rules')}</p>}

        {others.length > 0 && (state === 'on' || state === 'ask') && (
          <div className="border-t border-line pt-3">
            <p className="text-xs font-medium text-ink-muted">{t(locale, 'push_other_devices')}</p>
            <ul className="mt-1 divide-y divide-line">
              {others.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-ink">
                    {d.device_label ?? t(locale, 'push_a_device')}{' '}
                    <span className="text-ink-muted">· {t(locale, 'push_since', { date: fmtDate(d.created_at, locale) ?? '' })}</span>
                  </span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void remove(d.id)}>
                    {t(locale, 'push_remove')}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className={NOTICE.error}>{t(locale, 'push_failed')}</p>}
      </div>
    </section>
  );
}
