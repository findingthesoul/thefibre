'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { startGoogleAuth, disconnectGoogle } from '../actions';

export function GoogleConnect({
  connected,
  statusParam,
  reasonParam,
}: {
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
        setError(r.error ?? 'Could not start Google connect.');
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
          <div className="font-medium">Google Calendar</div>
          <div className="text-sm text-ink-subtle mt-1">
            One connection for all Fibre apps: Meet reads your free/busy and
            creates calendar events (with a Meet link) when someone books.
          </div>
          {statusParam === 'connected' && !error && (
            <div className="mt-3 text-sm text-emerald-700">
              ✓ Connected. Calendars synced.
            </div>
          )}
          {statusParam === 'error' && (
            <div className="mt-3 text-sm text-red-700">
              Couldn&apos;t connect{reasonParam ? ` (${reasonParam})` : ''}. Try
              again.
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
              {pending ? 'Working…' : 'Disconnect'}
            </Button>
          ) : (
            <Button type="button" onClick={connect} disabled={pending}>
              {pending ? 'Starting…' : 'Connect Google'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
