'use client';

// THE searchable select — a dropdown with a search field, for any list too
// long to scan (Sjoerd, 2026-09-05: "a list with search field, as a
// component through the app"). First consumers: the thread picker on
// Membership products; next: timezone pickers, person/country comboboxes
// (component-inventory.md counts three hand-rolled ones to converge here).

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export type SearchSelectOption = { value: string; label: string; hint?: string };

export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = 'Pick…',
  searchPlaceholder = 'Search…',
  disabled,
  className = '',
  name,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  /** Render a hidden input so the value rides FormData submits — saves every
   *  call site hand-rolling one (sweep 2026-09-05). */
  name?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value) ?? null;
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(needle) ||
          o.value.toLowerCase().includes(needle) ||
          o.hint?.toLowerCase().includes(needle),
      )
    : options;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setQ('');
          setOpen((o) => !o);
        }}
        className="w-full flex items-center justify-between gap-2 rounded-md border border-line bg-surface-raised px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:opacity-50"
      >
        <span className={selected ? 'text-ink truncate' : 'text-ink-muted truncate'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={15} className="shrink-0 text-ink-muted" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-line bg-surface-raised shadow-lg">
          <div className="relative border-b border-line">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent pl-8 pr-3 py-2 text-sm focus:outline-none placeholder:text-ink-muted"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-ink-muted">No matches.</li>
            )}
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-surface-sunken ${
                    o.value === value ? 'font-medium text-ink' : 'text-ink-subtle'
                  }`}
                >
                  <span className="block truncate">{o.label}</span>
                  {o.hint && <span className="block truncate text-xs text-ink-muted">{o.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
