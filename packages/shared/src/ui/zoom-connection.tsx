'use client';

// THE Zoom connection card — one implementation for every app that lets a
// person connect Zoom (Settings → Connections). Born in shared per CLAUDE.md
// ("components first"); the app-bound pieces are INJECTED: the two server
// actions (they bake in the app's session + X-App-ID and the `?return=` that
// brings the browser back to THAT app) and every string, already translated
// by the app's own catalog. Nothing here imports app code or next/*, which is
// why a successful disconnect is reported through `onDisconnected` instead of
// calling router.refresh() itself.
//
// The look is Meet's card (apps/meet/.../integrations/zoom.tsx), which still
// has its own copy; port it to this when next touched.

import { useState, useTransition } from 'react';
import { Button } from './button.js';

export type ZoomConnectionLabels = {
  /** What Zoom is used for in this app. */
  description: string;
  /** "Zoom account: x@y.z" — already formatted, or built from the email. */
  account: string | ((email: string) => string);
  /** Shown after returning from a successful connect (?zoom=connected). */
  connectedMessage: string;
  /** Shown after a failed connect; receives " (reason)" or "". */
  errorMessage: string | ((reasonSuffix: string) => string);
  /** The server has no Zoom app credentials, so connecting cannot work. */
  notConfigured: string;
  /** Fallback when starting the flow fails without a message. */
  startFailed: string;
  connect: string;
  disconnect: string;
  /** Pending label on Disconnect (and on Connect while redirecting). */
  working: string;
};

export function ZoomConnectionCard({
  connected,
  accountEmail,
  configured,
  statusParam,
  reasonParam,
  labels,
  onStart,
  onDisconnect,
  onDisconnected,
}: {
  connected: boolean;
  accountEmail: string | null;
  /** False when the server has no Zoom app credentials. */
  configured: boolean;
  /** `?zoom=` from the callback redirect. */
  statusParam: string | null;
  /** `?reason=` from the callback redirect. */
  reasonParam: string | null;
  labels: ZoomConnectionLabels;
  /** Starts the OAuth flow; resolves to Zoom's consent URL. */
  onStart: () => Promise<{ url?: string; error?: string }>;
  onDisconnect: () => Promise<{ ok: boolean; error?: string }>;
  /** Called after a successful disconnect — the app refreshes its route. */
  onDisconnected?: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function connect() {
    setError(null);
    start(async () => {
      const r = await onStart();
      if (r.error || !r.url) {
        setError(r.error ?? labels.startFailed);
        return;
      }
      window.location.href = r.url;
    });
  }

  function disconnect() {
    setError(null);
    start(async () => {
      const r = await onDisconnect();
      if (!r.ok) setError(r.error ?? labels.startFailed);
      else onDisconnected?.();
    });
  }

  const accountLine =
    typeof labels.account === 'function' ? labels.account(accountEmail ?? '') : labels.account;
  const reasonSuffix = reasonParam ? ` (${reasonParam})` : '';
  const errorLine =
    typeof labels.errorMessage === 'function'
      ? labels.errorMessage(reasonSuffix)
      : labels.errorMessage;

  return (
    <div className="rounded-lg border border-line bg-surface-raised p-5">
      <div className="flex items-baseline justify-between gap-6">
        <div className="min-w-0">
          {/* The product name: not translated. */}
          <div className="font-medium">Zoom</div>
          <div className="text-sm text-ink-subtle mt-1">{labels.description}</div>
          {connected && accountEmail && (
            <div className="mt-2 text-sm text-ink-subtle">{accountLine}</div>
          )}
          {statusParam === 'connected' && !error && (
            <div className="mt-3 text-sm text-emerald-700">{labels.connectedMessage}</div>
          )}
          {statusParam === 'error' && (
            <div className="mt-3 text-sm text-red-700">{errorLine}</div>
          )}
          {!configured && !connected && (
            <div className="mt-3 text-sm text-ink-subtle">{labels.notConfigured}</div>
          )}
          {error && <div className="mt-3 text-sm text-red-700">{error}</div>}
        </div>
        <div className="shrink-0">
          {connected ? (
            <Button type="button" variant="secondary" size="sm" onClick={disconnect} disabled={pending}>
              {pending ? labels.working : labels.disconnect}
            </Button>
          ) : (
            <Button type="button" onClick={connect} disabled={pending || !configured}>
              {pending ? labels.working : labels.connect}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
