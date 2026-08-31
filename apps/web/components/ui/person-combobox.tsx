'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { searchPeople, type PersonOption } from '@/lib/person-actions';

/**
 * Pick a person by typing their name.
 *
 * The <select> this replaces held the first 100 contacts. In a workspace with
 * more than that, the person you wanted might not be in the list at all, and
 * even inside it, finding a name meant scrolling a hundred rows.
 *
 * So this searches the API as you type rather than filtering what was handed
 * to it. The seed list — whatever the page already fetched — is what shows
 * before you type a letter, so the field is never blank and picking one of
 * your first contacts still costs one click.
 *
 * Shaped after CountryCombobox: same input styling, same keyboard handling,
 * same hidden input carrying the value. It stays separate because the two
 * differ where it matters — countries are a fixed list held in the bundle,
 * people are a query, and every result must pass the caller's RLS.
 *
 * `onChange` is for the dialogs that keep the id in React state; the hidden
 * input is for the ones that submit a form. Both are always present, so a
 * caller uses whichever it needs.
 */

type Props = {
  label: string;
  name: string;
  people?: PersonOption[];
  /** Already linked, e.g. current members of the org — not offered again. */
  exclude?: string[];
  value?: string;
  onChange?: (id: string) => void;
  required?: boolean | undefined;
  errors?: string[] | undefined;
  placeholder?: string | undefined;
};

const INPUT_CLASS =
  'mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none placeholder:text-ink-muted';

export function personLabel(p: PersonOption): string {
  return (
    [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || p.id.slice(0, 8)
  );
}

export function PersonCombobox({
  label,
  name,
  people = [],
  exclude = [],
  value,
  onChange,
  required,
  errors,
  placeholder = 'Start typing a name…',
}: Props) {
  const [id, setId] = useState(value ?? '');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonOption[]>(people);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // A caller that clears its own state (the enrol dialog, after a save)
  // clears the field with it.
  useEffect(() => {
    if (value === '' && id !== '') {
      setId('');
      setQuery('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const hidden = useMemo(() => new Set(exclude), [exclude]);
  const shown = useMemo(
    () => results.filter((p) => !hidden.has(p.id)),
    [results, hidden],
  );

  // One request per pause in typing, not one per keystroke. The stale guard
  // matters more than the delay: replies can arrive out of order, and without
  // it a slow "ma" could land after a fast "marja" and replace it.
  useEffect(() => {
    const term = query.trim();
    if (!open) return;
    let live = true;
    setSearching(true);
    const t = setTimeout(async () => {
      const rows = await searchPeople(term);
      if (!live) return;
      setResults(rows.length || term ? rows : people);
      setActiveIdx(0);
      setSearching(false);
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function pick(p: PersonOption) {
    setId(p.id);
    setQuery(personLabel(p));
    setOpen(false);
    onChange?.(p.id);
  }

  function clear() {
    setId('');
    onChange?.('');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const p = shown[activeIdx];
      if (open && p) {
        e.preventDefault();
        pick(p);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <label className="block">
      <span className="text-sm text-ink-subtle">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <div ref={wrapRef} className="relative">
        <input
          type="text"
          autoComplete="off"
          className={INPUT_CLASS}
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            // Typing after a pick means that pick no longer stands. Said now
            // rather than letting a stale id be submitted under a new name.
            if (id) clear();
          }}
          onKeyDown={onKeyDown}
        />
        <input type="hidden" name={name} value={id} />
        {open && (
          <ul
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line bg-surface-raised shadow-lg"
          >
            {shown.map((p, i) => (
              <li
                key={p.id}
                role="option"
                aria-selected={i === activeIdx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex items-center justify-between gap-3 px-3 py-2 text-sm cursor-pointer ${
                  i === activeIdx ? 'bg-surface-sunken' : ''
                }`}
              >
                <span className="truncate">{personLabel(p)}</span>
                {p.email && (
                  <span className="text-xs text-ink-muted truncate">{p.email}</span>
                )}
              </li>
            ))}
            {!shown.length && (
              <li className="px-3 py-2 text-sm text-ink-muted">
                {searching ? 'Searching…' : 'No one by that name'}
              </li>
            )}
          </ul>
        )}
      </div>
      {errors?.map((e) => (
        <span key={e} className="mt-1 block text-xs text-red-700">
          {e}
        </span>
      ))}
    </label>
  );
}
