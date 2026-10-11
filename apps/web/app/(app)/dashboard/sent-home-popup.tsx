'use client';

// "You are back in The Fibre, and here is why."
//
// Sjoerd, 2026-09-28: *"Back to fibre — but a comment in a popup."* An app
// that cannot serve you hands you here (packages/shared/src/sent-home.ts);
// this is the sentence that explains it, so the hop is not silent teleporting.
//
// Deliberately NOT a toast: a toast times out, and somebody who has just been
// moved between apps is looking at a page they did not ask for and needs the
// reason to still be there when they look up. One press dismisses it.
//
// Dismissing also strips the parameters from the URL, so a refresh or a
// shared link does not replay the popup. history.replaceState rather than a
// router push: the explanation is not a place in the history you should be
// able to go back to.
//
// SINCE 2026-10-11 it has a second shape. When the person SWITCHED to the
// workspace the app cannot serve, an apology is the wrong answer — they made
// a choice a moment ago and the useful thing is a way back. So that case
// offers the workspaces where the app does work.
//
// Each of those is ONE button meaning one thing: switch the workspace AND
// open the app there. Not two steps, and not an automatic hop after a
// switch — the label says both halves, so what happens is what was read
// before clicking. Automatic workspace movement is the surprise this whole
// area exists to stop.

import { useState, useTransition } from 'react';
import { Dialog } from '@thefibre/shared/ui/dialog';
import { buttonClassName } from '@thefibre/shared/ui/button';
import { browserSupabase } from '@/lib/supabase/client';

export type SwitchTarget = {
  id: string;
  name: string;
  /** Where to land once the workspace has moved — the app that sent them. */
  href: string;
  /** "Open The Thread in soul.com" — built by the caller, already translated. */
  label: string;
};

export function SentHomePopup({
  title,
  body,
  dismiss,
  askAdmin,
  labelRetry,
  targets = [],
  onSwitch,
}: {
  title: string;
  body: string;
  dismiss: string;
  /** "Ask an admin of {workspace} to give you access to {app}." */
  askAdmin?: string | undefined;
  /** Shown when the token could not be re-minted; the choice is recorded, so
   *  pressing again is the right advice. */
  labelRetry?: string | undefined;
  /** Empty for the ordinary case; the popup then looks exactly as before. */
  targets?: SwitchTarget[];
  /** Records the workspace choice. Resolves to an error string, or null. */
  onSwitch?: (id: string) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(true);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    try {
      const url = new URL(window.location.href);
      for (const k of ['sent_home', 'from', 'in', 'chose']) url.searchParams.delete(k);
      window.history.replaceState(null, '', url.pathname + url.search);
    } catch {
      // A browser that refuses the rewrite still gets the popup closed; the
      // stale parameters are cosmetic.
    }
  }

  function go(t: SwitchTarget) {
    setError(null);
    start(async () => {
      const err = onSwitch ? await onSwitch(t.id) : null;
      if (err) {
        setError(err);
        return;
      }
      // RECORDING the choice is only half of it. The workspace lives in the
      // ACCESS TOKEN, and the API says so in its own answer
      // (`refresh_required: true`) — so without this the browser carries the
      // old token to the app, the app sees the workspace they were just
      // rescued from, and bounces them straight back here.
      //
      // Measured on staging 2026-10-11, and it looked exactly like the button
      // doing nothing: the choice WAS recorded, the hop WAS made, and The
      // Thread sent them back because its token still said the old workspace.
      // The same two-step is in the user menu; this is the second caller.
      try {
        await browserSupabase().auth.refreshSession();
      } catch {
        // The choice is recorded either way. Going on with a stale token
        // would land them back here, so stop and let them press again.
        setError(labelRetry ?? null);
        return;
      }
      // A FULL load, not a router push: the workspace lives in the token and
      // the target is another app. Going there afresh is the only way it
      // renders with the workspace just chosen.
      window.location.href = t.href;
    });
  }

  if (!open) return null;

  return (
    <Dialog open onClose={close} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">{body}</p>
        {targets.length > 0 && (
          <div className="flex flex-col gap-2">
            {targets.map((t) => (
              <button
                key={t.id}
                type="button"
                className={buttonClassName('secondary', 'md')}
                onClick={() => go(t)}
                disabled={pending}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        {askAdmin && <p className="text-sm text-ink-subtle">{askAdmin}</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end">
          <button
            type="button"
            className={buttonClassName('primary', 'md')}
            onClick={close}
            disabled={pending}
          >
            {dismiss}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
