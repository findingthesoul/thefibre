'use client';

// The app-bound half of the shared SignOut: this app's Supabase browser
// client, and where a member lands afterwards (back to the portal, signed
// out, which shows the sign-in form rather than a blank page).

import { SignOut } from '@thefibre/shared/ui/sign-out';
import { browserSupabase } from '@/lib/supabase/client';
import { forgetTickets } from '@/lib/kept-tickets';

export function SignOutButton() {
  return (
    <SignOut
      busyLabel="Signing out…"
      onSignOut={async () => {
        // The kept tickets go FIRST, before anything can fail. Data held for
        // convenience must not outlive the session that justified it — that is
        // the rule the service worker follows for pages, and the condition on
        // which tickets were allowed onto devices at all.
        forgetTickets();
        // The QRs live in the worker's cache, which this page cannot reach
        // directly, so it asks. Best-effort: no worker means no cache.
        navigator.serviceWorker?.controller?.postMessage('forget-tickets');

        await browserSupabase().auth.signOut();
        window.location.href = '/';
      }}
    />
  );
}
