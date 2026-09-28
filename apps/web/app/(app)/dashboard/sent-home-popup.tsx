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

import { useState } from 'react';
import { Dialog } from '@thefibre/shared/ui/dialog';
import { buttonClassName } from '@thefibre/shared/ui/button';

export function SentHomePopup({ title, body, dismiss }: { title: string; body: string; dismiss: string }) {
  const [open, setOpen] = useState(true);

  function close() {
    setOpen(false);
    try {
      const url = new URL(window.location.href);
      for (const k of ['sent_home', 'from', 'in']) url.searchParams.delete(k);
      window.history.replaceState(null, '', url.pathname + url.search);
    } catch {
      // A browser that refuses the rewrite still gets the popup closed; the
      // stale parameters are cosmetic.
    }
  }

  if (!open) return null;

  return (
    <Dialog open onClose={close} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">{body}</p>
        <div className="flex justify-end">
          <button type="button" className={buttonClassName('primary', 'md')} onClick={close}>
            {dismiss}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
