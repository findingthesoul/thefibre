'use client';

// THE share menu — one button over a public URL, with the two things anyone
// ever wants to do with one: look at it, or send it to somebody.
//
// Asked for on Meet's meeting-type editor (Sjoerd, 2026-09-24: "meeting type
// -> add a share button (dropdown: visit page link and copy link)"), and born
// here rather than in Meet because every app in the family publishes pages
// whose owner needs exactly this: a thread, a membership, a booking page.
// Nothing in it is Meet-shaped.
//
// Labels come in as props rather than from the chrome catalog: the caller
// already has its own translations for these words, and a shared component
// that owned them would make every consumer add six locales before it could
// say "Copy link".

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Share2 } from 'lucide-react';
import { absoluteUrl } from '../absolute-url.js';
import { Button } from './button.js';
import { CARD } from './recipes.js';

export type ShareMenuLabels = {
  /** The trigger. "Share". */
  share: string;
  /** Opens the page in a new tab. "Visit page". */
  visit: string;
  /** Puts the absolute URL on the clipboard. "Copy link". */
  copy: string;
  /** Shown in place of `copy` for a moment afterwards. "Copied". */
  copied: string;
};

/** A path is resolved against the page's own origin, so a caller can pass
 *  "/sjoerd/intro-call" and the reader still copies something sendable. */
function absolute(url: string): string {
  return absoluteUrl(url, window.location.origin);
}

export function ShareMenu({
  url,
  labels,
  className = '',
}: {
  /** Absolute URL, or a path resolved against the current origin. */
  url: string;
  labels: ShareMenuLabels;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Resolved after mount: `window` does not exist on the server, and a URL
  // rendered one way on the server and another in the browser is a hydration
  // mismatch. Until then the panel shows nothing in its place — and the panel
  // only exists once opened, which is already after mount.
  const [shown, setShown] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setShown(absolute(url)), [url]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function copy() {
    void navigator.clipboard.writeText(absolute(url)).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      // Long enough to read the confirmation, short enough that the menu is
      // not still sitting open when attention has moved on.
      timer.current = setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1200);
    });
  }

  const item =
    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-surface-sunken';

  return (
    <div className={`relative ${className}`} ref={ref}>
      <Button
        type="button"
        variant="secondary"
        leading={<Share2 className="h-4 w-4" strokeWidth={1.5} />}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {labels.share}
      </Button>
      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-30 mt-2 w-[320px] overflow-hidden shadow-lg ${CARD}`}
        >
          {shown && (
            <div className="truncate border-b border-line bg-surface-sunken px-3 py-2 text-xs text-ink-muted">
              {shown}
            </div>
          )}
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              window.open(absolute(url), '_blank', 'noopener,noreferrer');
            }}
          >
            <ExternalLink className="h-4 w-4 text-ink-subtle" strokeWidth={1.5} />
            {labels.visit}
          </button>
          <button type="button" role="menuitem" className={item} onClick={copy}>
            {copied ? (
              <Check className="h-4 w-4 text-ink-subtle" strokeWidth={1.5} />
            ) : (
              <Copy className="h-4 w-4 text-ink-subtle" strokeWidth={1.5} />
            )}
            {copied ? labels.copied : labels.copy}
          </button>
        </div>
      )}
    </div>
  );
}
