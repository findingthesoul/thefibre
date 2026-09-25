'use client';

// The page a participant sees when their portal could not load.
//
// Until v1.58.0 a failed read on /api/v1/me/portal rendered as an EMPTY
// portal — no tickets, no threads — with a 200 (testing approach §1.9). The
// API now throws instead, loadSession rethrows anything but a 401, and this
// is where that lands. Without this file it landed on Next's bare error
// screen.
//
// One sentence and a retry. The person reading it has no idea what a server
// component is, the likeliest cause is a moment's API blip, and the thing to
// avoid is the same anxiety the empty list caused: it must not read as "your
// things are gone". They are not; the page just did not get them this time.

import { ENTITY } from '@thefibre/shared';
import { Wordmark } from './wordmark';

export default function PortalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-16">
      <Wordmark className="h-12" />
      <div className="mt-8 rounded-2xl border border-line bg-surface-sunken p-6">
        <p className="text-ink">Your page did not load this time.</p>
        <p className="mt-1 text-sm text-ink-muted">
          Nothing has changed on your side — your tickets and memberships are where they were.
          Try again in a moment.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-lg bg-ink px-5 py-3 text-sm font-medium text-ink-inverse hover:opacity-90"
        >
          Try again
        </button>
      </div>
      <p className="mt-10 text-xs text-ink-muted">{ENTITY.publicName}</p>
    </div>
  );
}
