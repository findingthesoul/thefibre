'use client';

// The paragraph under a page title, and the way to be rid of it.
//
// Sjoerd, 2026-09-21, about Today's: *"This text ... should have a toggle
// button (on and off... reduce info on interface when not really needed)."*
//
// The text earns its place the first few times somebody opens a page and is
// furniture for ever after — but taking it away for everyone would cost the
// person who arrives next week. So it is a choice, and it persists: the
// preference is a domain-wide cookie (`thefibre.intro`), set the same way
// theme and sidebar are, because somebody who does not want the explanation
// on Today does not want it on the landscape either.
//
// WHY A COOKIE AND NOT COMPONENT STATE: the page is server-rendered, so the
// server has to know before it draws. localStorage would render the paragraph
// and then snatch it away a frame later, on every page, for ever.
//
// WHY A SERVER ACTION and not document.cookie: Safari's ITP caps every
// cookie written by JavaScript to seven days whatever max-age says, so a
// preference set in the browser silently comes back a week later. Same
// reasoning as prefs-actions.ts, which is the action this takes as a prop.

import { useState, useTransition, type ReactNode } from 'react';
import { Info, X } from 'lucide-react';

export function PageIntro({
  children,
  /** From the server: the cookie's value on this request. */
  shown,
  /** The app's `savePref` server action. Injected rather than imported — the
   *  package holds no Next.js server actions (the ui/invoices.tsx pattern). */
  onChange,
  /** What the show button says when the text is hidden. */
  showLabel,
  hideLabel,
}: {
  children: ReactNode;
  shown: boolean;
  onChange: (name: string, value: string) => Promise<void>;
  showLabel: string;
  hideLabel: string;
}) {
  // Optimistic: the paragraph goes at once and the cookie catches up. A
  // round trip before the text moves would make the control feel broken.
  const [open, setOpen] = useState(shown);
  const [, start] = useTransition();

  const set = (next: boolean) => {
    setOpen(next);
    start(async () => {
      await onChange('thefibre.intro', next ? 'on' : 'off');
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => set(true)}
        aria-label={showLabel}
        title={showLabel}
        className="mt-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
      >
        <Info size={15} strokeWidth={1.75} />
      </button>
    );
  }

  return (
    <div className="mt-2 flex max-w-2xl items-start gap-2">
      <p className="text-sm text-ink-muted">{children}</p>
      <button
        type="button"
        onClick={() => set(false)}
        aria-label={hideLabel}
        title={hideLabel}
        className="-mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
      >
        <X size={15} strokeWidth={1.75} />
      </button>
    </div>
  );
}
