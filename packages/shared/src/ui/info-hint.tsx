'use client';

// ⓘ — the explanation that is there when you want it and gone when you don't.
//
// Born shared (Sjoerd, 2026-09-09), and born shared on purpose: two sessions
// were asked for this same affordance within the hour, in two apps, which is
// exactly the fork the components-first rule exists to prevent. It replaces
// the multi-line grey paragraph that sits under a form control explaining
// what the control means — those paragraphs are read once, then become
// furniture, and they push the actual controls off the first screen.
//
// Three things it has to survive, each learned rather than guessed:
//
//   Clipping. These live inside dialog bodies that scroll with
//   overflow-y-auto, which clips an absolutely-positioned bubble at the
//   scroll edge. So the bubble is position:fixed and placed from the
//   trigger's own rect — no ancestor can crop it.
//
//   Touch. Hover alone means the explanation does not exist on a phone.
//   Click toggles it and keeps it open, so a finger works.
//
//   Keyboard. It is a real <button>, focus opens it, Escape closes it, and
//   the bubble is wired to the trigger with aria-describedby so a screen
//   reader reaches the text rather than an icon called "i".

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';

export function InfoHint({
  children,
  label = 'More information',
  align = 'start',
}: {
  /** The explanation. Prose, not a component tree — keep it to a sentence
   *  or three, because anything longer wants to be a page. */
  children: ReactNode;
  /** Accessible name for the trigger. Pass a translated string. */
  label?: string;
  /** Which edge of the trigger the bubble lines up with. */
  align?: 'start' | 'end';
}) {
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  // Sticky = opened by click or keyboard; it survives the mouse leaving.
  const [sticky, setSticky] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number; right: number } | null>(null);

  function place() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setAt({ top: r.bottom + 6, left: r.left, right: window.innerWidth - r.right });
  }

  function show(makeSticky = false) {
    place();
    setOpen(true);
    if (makeSticky) setSticky(true);
  }
  function hide() {
    setOpen(false);
    setSticky(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') hide();
    }
    function onDown(e: MouseEvent) {
      if (!btnRef.current?.contains(e.target as Node)) hide();
    }
    // A fixed bubble does not travel with a scrolling parent, so it closes
    // rather than floating away from the control it explains.
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => (sticky ? hide() : show(true))}
        onMouseEnter={() => show()}
        onMouseLeave={() => !sticky && setOpen(false)}
        onFocus={() => show()}
        onBlur={() => !sticky && setOpen(false)}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full align-middle text-ink-muted transition-colors hover:text-ink focus:text-ink focus:outline-none"
      >
        <Info size={13} strokeWidth={1.75} />
      </button>
      {open && at && (
        <div
          id={id}
          role="tooltip"
          style={
            align === 'end'
              ? { position: 'fixed', top: at.top, right: at.right }
              : { position: 'fixed', top: at.top, left: at.left }
          }
          className="z-50 max-w-xs rounded-lg border border-line bg-surface-raised px-3 py-2.5 text-xs leading-relaxed text-ink-subtle shadow-lg"
        >
          {children}
        </div>
      )}
    </>
  );
}
