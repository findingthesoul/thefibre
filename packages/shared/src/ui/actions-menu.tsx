'use client';

// A labelled "⋯" menu of actions on one thing — a product group's Rename /
// Archive (2026-10-16), and any other row that has a few verbs. Born here
// rather than in an app (components first, 2026-09-05); Flow's lifecycle
// menu is the older private copy of the same idea.
//
// LABELLED on purpose: the button carries `label` as its accessible name AND
// as visible text from `sm` up, because a bare icon next to a name said
// nothing about what it opened (Sjoerd asked for "a labelled group menu").
// Keyboard: Enter/Space opens, Escape closes and returns focus, a click
// outside closes. Items are buttons with role="menuitem".

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2, MoreHorizontal } from 'lucide-react';

export type ActionsMenuItem = {
  label: string;
  icon?: ReactNode;
  /** May return a promise: the menu then stays open with this item showing
   *  a spinner until it settles (2026-10-17: a menu that closed at once and
   *  showed nothing until the server answered read as a click that did not
   *  register). A plain function closes the menu at once, as before. */
  onSelect: () => void | Promise<unknown>;
  /** A destructive verb (archive, delete) reads in the danger colour. */
  destructive?: boolean;
};

export function ActionsMenu({
  label,
  items,
  className = '',
  trigger,
  triggerClassName,
  note,
}: {
  label: string;
  items: ActionsMenuItem[];
  className?: string;
  /** Replaces the "⋯ label" button's insides — e.g. a calendar icon on a
   *  row where the label stays the accessible name only (2026-10-17). */
  trigger?: ReactNode;
  /** Replaces the button's classes when `trigger` needs another shape. */
  triggerClassName?: string;
  /** One quiet line under the items: what the choices mean. */
  note?: string;
}) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={
          triggerClassName ??
          'inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs text-ink-subtle hover:bg-surface-sunken hover:text-ink'
        }
      >
        {trigger ?? (
          <>
            <MoreHorizontal size={16} aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </>
        )}
      </button>
      {open && (
        <div role="menu" aria-label={label} className="absolute right-0 z-50 mt-1 min-w-44 rounded-lg border border-line bg-surface-raised py-1 text-sm shadow-lg">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={working !== null}
              aria-busy={working === it.label || undefined}
              onClick={() => {
                const r = it.onSelect();
                if (r && typeof (r as Promise<unknown>).then === 'function') {
                  setWorking(it.label);
                  void (r as Promise<unknown>).finally(() => {
                    setWorking(null);
                    setOpen(false);
                  });
                } else {
                  setOpen(false);
                }
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-sunken disabled:cursor-wait ${it.destructive ? 'text-red-700 dark:text-red-400' : 'text-ink'} ${working !== null && working !== it.label ? 'opacity-50' : ''}`}
            >
              {working === it.label ? <Loader2 size={14} className="animate-spin" aria-hidden /> : it.icon}
              {it.label}
            </button>
          ))}
          {note && <p className="max-w-64 border-t border-line px-3 pb-1 pt-2 text-xs text-ink-muted">{note}</p>}
        </div>
      )}
    </div>
  );
}
