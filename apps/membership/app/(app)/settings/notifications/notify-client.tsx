'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SwitchField } from '@thefibre/shared/ui/switch';
import { t, type Locale } from '@/lib/i18n-ui';
import { Button } from '@/components/ui/button';
import { NOTICE } from '@thefibre/shared/ui/recipes';
import { announceHeldThreads, dismissHeldThreads, saveNotifyMembers } from '../actions';

export type HeldThread = { thread_id: string; title: string; starts_on: string | null; held_at: string };

// One switch, saved when flipped — there is nothing else on the page to
// collect into a form, and a Save button under a single toggle is a second
// step for nothing.
export function NotifyClient({
  on: initial,
  held,
  locale,
}: {
  on: boolean;
  held: HeldThread[];
  locale: Locale;
}) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'announce' | 'dismiss' | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const router = useRouter();

  async function decide(which: 'announce' | 'dismiss') {
    setBusy(which);
    setError(null);
    const r = which === 'announce' ? await announceHeldThreads() : await dismissHeldThreads();
    setBusy(null);
    if (r.error) {
      setError(r.error);
      return;
    }
    setDone(t(locale, which === 'announce' ? 'notify_held_announced' : 'notify_held_dismissed'));
    router.refresh();
  }

  async function flip(v: boolean) {
    setOn(v);
    setError(null);
    const r = await saveNotifyMembers(v);
    if (r.error) {
      setOn(!v);
      setError(r.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border border-line bg-surface-raised p-5 space-y-3">
      <SwitchField
        label={t(locale, 'notify_members_label')}
        hint={t(locale, 'notify_members_hint')}
        checked={on}
        onChange={flip}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className={NOTICE.success}>{done}</p>}

      {/* The circuit breaker's catch: more than 20 at once were not
          announced. The decision is a person's, made once for the batch. */}
      {held.length > 0 && !done && (
        <div className={`${NOTICE.warning} space-y-3`}>
          <p>{t(locale, 'notify_held_title', { n: String(held.length) })}</p>
          <ul className="list-disc pl-5 text-sm">
            {held.slice(0, 8).map((h) => (
              <li key={h.thread_id}>
                {h.title}
                {h.starts_on ? ` · ${h.starts_on}` : ''}
              </li>
            ))}
            {held.length > 8 && <li>{t(locale, 'notify_held_more', { n: String(held.length - 8) })}</li>}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => decide('announce')} disabled={!!busy || !on}>
              {busy === 'announce' ? t(locale, 'saving') : t(locale, 'notify_held_announce')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => decide('dismiss')} disabled={!!busy}>
              {t(locale, 'notify_held_dismiss')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
