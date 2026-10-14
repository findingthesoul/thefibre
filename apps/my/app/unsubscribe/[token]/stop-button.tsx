'use client';

import { useState } from 'react';
import { Button } from '@thefibre/shared/ui/button';
import { NOTICE } from '@thefibre/shared/ui/recipes';

export function StopButton({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'gone'>('idle');
  const [community, setCommunity] = useState<string | null>(null);

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
        Done. No more of these emails{community ? ` from ${community}` : ''}.
      </p>
    );
  }
  if (state === 'gone') {
    return (
      <p className={`mt-6 ${NOTICE.error}`}>
        This link did not work. Sign in and turn the emails off under You instead.
      </p>
    );
  }
  return (
    <div className="mt-6">
      <Button type="button" onClick={stop} disabled={state === 'busy'}>
        {state === 'busy' ? 'Stopping…' : 'Stop these emails'}
      </Button>
    </div>
  );
}
