'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { COUNTRIES, countryName } from '@/lib/countries';

type Props = {
  label: string;
  name: string;
  defaultValue?: string | null | undefined;
  required?: boolean | undefined;
  errors?: string[] | undefined;
  placeholder?: string | undefined;
};

const INPUT_CLASS =
  'mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none placeholder:text-ink-muted';

export function CountryCombobox({
  label,
  name,
  defaultValue,
  required,
  errors,
  placeholder = 'Start typing a country…',
}: Props) {
  const initial = (defaultValue ?? '').toUpperCase();
  const [code, setCode] = useState(initial);
  const [query, setQuery] = useState(countryName(initial) ?? '');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES.slice(0, 50);
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().startsWith(q),
    ).slice(0, 50);
  }, [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function pick(c: { code: string; name: string }) {
    setCode(c.code);
    setQuery(c.name);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const c = filtered[activeIdx];
      if (c) {
        e.preventDefault();
        pick(c);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function onBlurInput() {
    // If the query no longer matches the selected code's name, clear the code.
    // Allows empty input → submit empty country.
    setTimeout(() => {
      if (!query.trim()) {
        setCode('');
      } else if (countryName(code)?.toLowerCase() !== query.toLowerCase()) {
        // user typed something not picked — leave code as-is (last valid selection)
      }
    }, 150);
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
            setActiveIdx(0);
          }}
          onKeyDown={onKeyDown}
          onBlur={onBlurInput}
        />
        <input type="hidden" name={name} value={code} />
        {open && filtered.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line bg-surface-raised shadow-lg"
          >
            {filtered.map((c, i) => (
              <li
                key={c.code}
                role="option"
                aria-selected={i === activeIdx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(c);
                }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer ${
                  i === activeIdx ? 'bg-surface-sunken' : ''
                }`}
              >
                <span>{c.name}</span>
                <span className="text-xs text-ink-muted">{c.code}</span>
              </li>
            ))}
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
