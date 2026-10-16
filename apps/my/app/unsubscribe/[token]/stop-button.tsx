'use client';

import { useState } from 'react';
import { Button } from '@thefibre/shared/ui/button';
import { NOTICE } from '@thefibre/shared/ui/recipes';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { t } from '@/lib/i18n';

export function StopButton({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'gone'>('idle');
  const [community, setCommunity] = useState<string | null>(null);
  const locale = useLocale();

  async function stop() {
    setState('busy');
    const res = await fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => null);
    if (!res?.ok) {
      setState('gone');
      return;
    }
    const body = (await res.json().catch(() => ({}))) as { community?: string | null };
    setCommunity(body.community ?? null);
    setState('done');
  }

  if (state === 'done') {
    return (
      <p className={`mt-6 ${NOTICE.success}`}>
        {community ? t(locale, 'unsub_done_from', { community }) : t(locale, 'unsub_done')}
      </p>
    );
  }
  if (state === 'gone') {
    return (
      <p className={`mt-6 ${NOTICE.error}`}>
        {t(locale, 'unsub_failed')}
      </p>
    );
  }
  return (
    <div className="mt-6">
      <Button type="button" onClick={stop} disabled={state === 'busy'}>
        {state === 'busy' ? t(locale, 'unsub_stopping') : t(locale, 'unsub_title')}
      </Button>
    </div>
  );
}
