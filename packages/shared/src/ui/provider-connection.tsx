'use client';

// THE connection card for an OAuth meeting provider — Zoom, Microsoft Teams,
// and whatever comes next. One implementation for every app that lets a
// person connect one in Settings → Connections.
//
// This is the body that was `ZoomConnectionCard`, with the product name and
// the callback's query-parameter name lifted out. Nothing else about it was
// ever Zoom-specific: the states (not configured / not connected / connected
// / returned-with-error) and the two actions are the same for any provider
// that hands you back to a settings page with `?<provider>=connected`.
//
// Generalised rather than copied when Teams needed a card (2026-10-11),
// because CLAUDE.md's "components first" rule is explicit about it — and
// because a second copy is where the two drift. `ZoomConnectionCard` stays as
// a thin wrapper so no existing call site changes.
//
// The app-bound pieces are INJECTED: the two server actions (they bake in the
// app's session + X-App-ID and the `?return=` that brings the browser back to
// THAT app) and every string, already translated by the app's own catalog.
// Nothing here imports app code or next/*, which is why a successful
// disconnect is reported through `onDisconnected` instead of calling
// router.refresh() itself.

import { useState, useTransition, type ReactNode } from 'react';
import { NOTICE } from './recipes.js';
import { Button } from './button.js';

export type ProviderConnectionLabels = {
  /** What this provider is used for in this app. */
  description: string;
  /** "Zoom account: x@y.z" — already formatted, or built from the email.
   *
   *  `null` means this provider HAS no such line: the connection is a yes/no
   *  and it never reports which account was linked. Google Calendar is that
   *  case.
   *
   *  Required, and nullable, rather than optional. Optional made absence
   *  FORGETTABLE — a new caller that simply omitted it would render nothing
   *  where a line belonged, and the typechecker would say nothing. That is
   *  the silent-no-op shape this codebase keeps paying for. Writing `null` is
   *  one word, and it is a statement that somebody made on purpose. */
  account: string | ((email: string) => string) | null;
  /** Shown after returning from a successful connect. */
  connectedMessage: string;
  /** Shown after a failed connect; receives " (reason)" or "". */
  errorMessage: string | ((reasonSuffix: string) => string);
  /** The server has no app credentials for this provider, so connecting
   *  cannot work.
   *
   *  `null` means the state cannot arise — Google is configured wherever
   *  these apps run. Nullable rather than optional, for the same reason as
   *  `account`: a caller that forgets this one would silently show nothing in
   *  the exact situation the sentence exists for, which is somebody staring
   *  at a dead Connect button with no explanation.
   *
   *  Deliberately NOT folded together with `account` into one "connect-only"
   *  mode: a provider may perfectly well report its account and always be
   *  configured, or neither, and one flag standing for two unrelated facts
   *  goes wrong the first time they differ. */
  notConfigured: string | null;
  /** Fallback when starting the flow fails without a message. */
  startFailed: string;
  connect: string;
  disconnect: string;
  /** Pending label on Disconnect (and on Connect while redirecting). */
  working: string;
};

export function ProviderConnectionCard({
  name,
  connected,
  accountEmail,
  configured,
  notice,
  statusParam,
  reasonParam,
  labels,
  onStart,
  onDisconnect,
  onDisconnected,
}: {
  /** The product name, shown as the card's heading. NOT translated — a
   *  product name is the same in every locale. */
  name: string;
  connected: boolean;
  accountEmail: string | null;
  /** False when the server has no app credentials for this provider. */
  configured: boolean;
  /**
   * A note shown beside the Connect button while NOT connected.
   *
   * Added for the Zoom Marketplace review (2026-10-12): until Zoom approves
   * the app, connecting may not work, and somebody with a meeting to run
   * needs to be told what to do instead rather than left pressing a button.
   * Provider-agnostic on purpose — this card also draws Teams and Google,
   * and any of them can be in this state.
   *
   * REMOVE WHEN THE ZOOM MARKETPLACE APP IS PUBLISHED, along with
   * apps/api/src/lib/zoom-pending.ts. Whether it appears is NOT decided
   * here: the API decides and the call sites pass it.
   */
  notice?: ReactNode;
  /** `?zoom=` / `?teams=` from the callback redirect. */
  statusParam: string | null;
  /** `?reason=` from the callback redirect. */
  reasonParam: string | null;
  labels: ProviderConnectionLabels;
  /** Starts the OAuth flow; resolves to the provider's consent URL. */
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
  // Never rendered when the label is absent — see the guard below — but
  // computed defensively so an absent label cannot throw on the way past.
  const reasonSuffix = reasonParam ? ` (${reasonParam})` : '';
  const errorLine =
    typeof labels.errorMessage === 'function'
      ? labels.errorMessage(reasonSuffix)
      : labels.errorMessage;

  // Nothing to click while the server holds no credentials: the button is
  // rendered but DISABLED, with the reason in words beside it. Deliberately
  // not hidden — a card with no control at all reads as "this does not exist
  // here", when the truth is "this exists and is not switched on yet", and
  // the difference is what tells somebody to go and set the secrets.
  const canConnect = configured && !pending;

  return (
    <div className="rounded-lg border border-line bg-surface-raised p-5">
      {/* Stacks on a phone, side by side from sm up.
          Until 2026-10-12 this was `flex items-baseline justify-between` at
          every width, so the button column kept its size and squeezed the
          text into three or four words a line. Nobody had noticed because the
          descriptions are short; adding the Zoom review notice made a
          paragraph of it and it read like a ribbon. Seen at 375 on staging. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <div className="min-w-0">
          {/* The product name: not translated. */}
          <div className="font-medium">{name}</div>
          <div className="text-sm text-ink-subtle mt-1">{labels.description}</div>
          {connected && accountEmail && labels.account && (
            <div className="mt-2 text-sm text-ink-subtle">{accountLine}</div>
          )}
          {statusParam === 'connected' && !error && (
            <div className="mt-3 text-sm text-emerald-700">{labels.connectedMessage}</div>
          )}
          {statusParam === 'error' && <div className="mt-3 text-sm text-red-700">{errorLine}</div>}
          {!configured && !connected && labels.notConfigured && (
            <div className="mt-3 text-sm text-ink-subtle">{labels.notConfigured}</div>
          )}
          {/* Only while disconnected: it explains what to do INSTEAD of
              connecting, which is not advice for somebody already connected.
              NOTICE.info from the recipes, so it carries no colour of its
              own — a warning-coloured box here would read as a fault in
              their account rather than a state of ours. */}
          {notice && !connected && <div className={`mt-3 ${NOTICE.info}`}>{notice}</div>}
          {error && <div className="mt-3 text-sm text-red-700">{error}</div>}
        </div>
        <div className="shrink-0 self-stretch sm:self-auto">
          {connected ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={disconnect}
              disabled={pending}
            >
              {pending ? labels.working : labels.disconnect}
            </Button>
          ) : (
            <Button type="button" onClick={connect} disabled={!canConnect}>
              {pending ? labels.working : labels.connect}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
