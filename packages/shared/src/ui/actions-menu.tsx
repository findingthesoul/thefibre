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
import { MoreHorizontal } from 'lucide-react';

export type ActionsMenuItem = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  /** A destructive verb (archive, delete) reads in the danger colour. */
  destructive?: boolean;
};

export function ActionsMenu({ label, items, className = '' }: { label: string; items: ActionsMenuItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
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
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs text-ink-subtle hover:bg-surface-sunken hover:text-ink"
      >
        <MoreHorizontal size={16} aria-hidden />
        <span className="hidden sm:inline">{label}</span>
      </button>
      {open && (
        <div role="menu" aria-label={label} className="absolute right-0 z-50 mt-1 min-w-44 rounded-lg border border-line bg-surface-raised py-1 text-sm shadow-lg">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-sunken ${it.destructive ? 'text-red-700 dark:text-red-400' : 'text-ink'}`}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
