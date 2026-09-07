'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n-ui';
import { startZoomAuth, disconnectZoom } from '../actions';

export function ZoomConnect({
  connected,
  accountEmail,
  configured,
  statusParam,
  reasonParam,
  locale,
}: {
  connected: boolean;
  accountEmail: string | null;
  /** False when the server has no Zoom app credentials — connecting can't work. */
  configured: boolean;
  statusParam: string | null;
  reasonParam: string | null;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function connect() {
    setError(null);
    start(async () => {
      const r = await startZoomAuth();
      if (r.error || !r.url) {
        setError(r.error ?? t(locale, 'zoom_start_failed'));
        return;
      }
      window.location.href = r.url;
    });
  }

  function disconnect() {
    setError(null);
    start(async () => {
      const r = await disconnectZoom();
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-line bg-surface-raised p-5">
      <div className="flex items-baseline justify-between gap-6">
        <div className="min-w-0">
          <div className="font-medium">Zoom</div>
          <div className="text-sm text-ink-subtle mt-1">{t(locale, 'zoom_desc')}</div>
          {connected && accountEmail && (
            <div className="mt-2 text-sm text-ink-subtle">
              {t(locale, 'zoom_account', { email: accountEmail })}
            </div>
          )}
          {statusParam === 'connected' && !error && (
            <div className="mt-3 text-sm text-emerald-700">{t(locale, 'zoom_connected_msg')}</div>
          )}
          {statusParam === 'error' && (
            <div className="mt-3 text-sm text-red-700">
              {t(locale, 'zoom_error_msg', { reason: reasonParam ? ` (${reasonParam})` : '' })}
            </div>
          )}
          {!configured && !connected && (
            <div className="mt-3 text-sm text-ink-subtle">{t(locale, 'zoom_not_configured')}</div>
          )}
          {error && <div className="mt-3 text-sm text-red-700">{error}</div>}
        </div>
        <div className="shrink-0">
          {connected ? (
            <Button variant="secondary" size="sm" onClick={disconnect} disabled={pending}>
              {pending ? t(locale, 'working') : t(locale, 'disconnect')}
            </Button>
          ) : (
            <Button onClick={connect} disabled={pending || !configured}>
              {pending ? t(locale, 'redirecting') : t(locale, 'connect_zoom')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
