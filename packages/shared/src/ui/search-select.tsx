'use client';

// THE searchable select — a dropdown with a search field, for any list too
// long to scan (Sjoerd, 2026-09-05: "a list with search field, as a
// component through the app"). First consumers: the thread picker on
// Membership products; next: timezone pickers, person/country comboboxes
// (component-inventory.md counts three hand-rolled ones to converge here).
//
// Sync and async in one component: pass `options` for a list held in the
// bundle (countries, timezones), or `loadOptions` for a list that lives
// behind the API (people — every result must pass the caller's RLS).
// With `loadOptions`, `options` becomes the seed shown before the first
// response lands, so the field is never blank.

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export type SearchSelectOption = { value: string; label: string; hint?: string };

export function SearchSelect({
  value,
  onChange,
  options = [],
  loadOptions,
  placeholder = 'Pick…',
  searchPlaceholder = 'Search…',
  disabled,
  className = '',
  name,
  clearLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options?: SearchSelectOption[];
  /** Async source: called (debounced 250ms) with the search query while the
   *  dropdown is open; results REPLACE the client-side filter — the server
   *  already matched, filtering again here could hide a hit that matched on
   *  a field the option doesn't carry. `options` stays the pre-first-response
   *  seed. A stale guard drops out-of-order replies. */
  loadOptions?: (query: string) => Promise<SearchSelectOption[]>;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  /** Render a hidden input so the value rides FormData submits — saves every
   *  call site hand-rolling one (sweep 2026-09-05). */
  name?: string;
  /** Offer a "clear" row at the top of the list (e.g. '—') that sets the
   *  value to '' — for optional fields where empty is a legitimate answer. */
  clearLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [asyncOptions, setAsyncOptions] = useState<SearchSelectOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  // Async results come and go with the query, so the current value's label
  // may not be in the latest batch — remember the picked option itself.
  const [picked, setPicked] = useState<SearchSelectOption | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Ref, not a dep: a caller defining loadOptions inline would otherwise
  // change its identity every render and re-trigger the fetch effect forever.
  const loadRef = useRef(loadOptions);
  loadRef.current = loadOptions;
  const hasLoader = Boolean(loadOptions);

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

  // One request per pause in typing, not one per keystroke. The stale guard
  // matters more than the delay: replies can arrive out of order, and without
  // it a slow "ma" could land after a fast "marja" and replace it.
  useEffect(() => {
    if (!open || !hasLoader) return;
    let live = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const load = loadRef.current;
      if (!load) return;
      try {
        const rows = await load(q.trim());
        if (!live) return;
        setAsyncOptions(rows);
      } finally {
        if (live) setLoading(false);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, open, hasLoader]);

  const selected =
    options.find((o) => o.value === value) ??
    asyncOptions?.find((o) => o.value === value) ??
    (picked && picked.value === value ? picked : null);

  const needle = q.trim().toLowerCase();
  // Async results are already server-filtered; only the sync path (and the
  // seed shown before the first async response) filters client-side.
  const pool = hasLoader && asyncOptions ? asyncOptions : options;
  const filtered =
    hasLoader && asyncOptions
      ? asyncOptions
      : needle
        ? pool.filter(
            (o) =>
              o.label.toLowerCase().includes(needle) ||
              o.value.toLowerCase().includes(needle) ||
              o.hint?.toLowerCase().includes(needle),
          )
        : pool;

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
            {clearLabel && !needle && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(null);
                    onChange('');
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-sunken"
                >
                  {clearLabel}
                </button>
              </li>
            )}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-ink-muted">
                {loading ? 'Searching…' : 'No matches.'}
              </li>
            )}
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(o);
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
            {filtered.length > 0 && loading && (
              <li className="px-3 py-1.5 text-xs text-ink-muted">Searching…</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
