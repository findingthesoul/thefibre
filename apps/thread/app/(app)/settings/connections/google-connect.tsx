'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@thefibre/shared';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n-ui';
import { startGoogleAuth, disconnectGoogle } from '../actions';

export function GoogleConnect({
  locale,
  connected,
  statusParam,
  reasonParam,
}: {
  locale: Locale;
  connected: boolean;
  statusParam: string | null;
  reasonParam: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function connect() {
    setError(null);
    start(async () => {
      const r = await startGoogleAuth();
      if (r.error || !r.url) {
        setError(r.error ?? t(locale, 'google_connect_start_failed'));
        return;
      }
      window.location.href = r.url;
    });
  }

  function disconnect() {
    setError(null);
    start(async () => {
      const r = await disconnectGoogle();
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-line bg-surface-raised p-5">
      <div className="flex items-baseline justify-between gap-6">
        <div className="min-w-0">
          <div className="font-medium">{t(locale, 'google_calendar')}</div>
          <div className="text-sm text-ink-subtle mt-1">{t(locale, 'google_connect_desc')}</div>
          {statusParam === 'connected' && !error && (
            <div className="mt-3 text-sm text-emerald-700">{t(locale, 'google_connected_msg')}</div>
          )}
          {statusParam === 'error' && (
            <div className="mt-3 text-sm text-red-700">
              {t(locale, 'google_connect_failed', {
                reason: reasonParam ? ` (${reasonParam})` : '',
              })}
            </div>
          )}
          {error && <div className="mt-3 text-sm text-red-700">{error}</div>}
        </div>
        <div className="shrink-0">
          {connected ? (
            <Button
              type="button"
              variant="secondary"
              onClick={disconnect}
              disabled={pending}
            >
              {pending ? t(locale, 'working') : t(locale, 'disconnect')}
            </Button>
          ) : (
            <Button type="button" onClick={connect} disabled={pending}>
              {pending ? t(locale, 'starting') : t(locale, 'connect_google')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
