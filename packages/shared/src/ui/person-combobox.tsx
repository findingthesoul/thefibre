'use client';

// THE person picker. One component, every app.
//
// Extracted from apps/web 2026-09-22, on Sjoerd's instruction while Connect
// was about to grow a second one: *"There should be a Single Point of truth
// — it is existing somewhere else."* He was right; it did.
//
// It is a thin, person-shaped wrapper around SearchSelect in async mode. What
// is person-shaped and belongs here: how a person is labelled, that the list
// is searched server-side rather than handed over whole (a hundred names in a
// scrolling list is not something you read, and contact 101 is simply not
// offered), the exclude list, and the field chrome.
//
// What each app supplies, because it cannot live in this package: `search`.
// A server action is bound to one app's apiFetch and its session, and this
// package holds no Next.js server actions — the ui/invoices.tsx pattern. Every
// result therefore passes that caller's own RLS: a picker can never surface
// somebody the person using it could not already see.
//
// Div wrapper, not <label> — a label wrapping SearchSelect's button
// misdirects clicks (component-inventory.md).

import { useEffect, useState } from 'react';
import { SearchSelect, type SearchSelectOption } from './search-select.js';

export type PersonOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export function personLabel(p: PersonOption): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || p.id.slice(0, 8);
}

function toOption(p: PersonOption): SearchSelectOption {
  return { value: p.id, label: personLabel(p), ...(p.email ? { hint: p.email } : {}) };
}

export type PersonComboboxProps = {
  label: string;
  name?: string;
  /** The app's own search, server-side and under the caller's RLS. */
  search: (query: string) => Promise<PersonOption[]>;
  /** Seed list — whatever the page already fetched — shown before the first
   *  search response, so the field is never blank. */
  people?: PersonOption[];
  /** Already linked, e.g. current members of the org — not offered again. */
  exclude?: string[];
  value?: string;
  onChange?: (id: string) => void;
  required?: boolean | undefined;
  errors?: string[] | undefined;
  placeholder?: string | undefined;
  searchPlaceholder?: string | undefined;
  /** Offer "add as a new person" for the typed text (SearchSelect onCreate). */
  onCreate?: (typed: string) => void;
  createLabel?: (typed: string) => string;
};

export function PersonCombobox({
  label,
  name,
  search,
  people = [],
  exclude = [],
  value,
  onChange,
  required,
  errors,
  placeholder = 'Pick a person…',
  searchPlaceholder = 'Search by name or email…',
  onCreate,
  createLabel,
}: PersonComboboxProps) {
  // Controlled when the caller keeps the id in state (the enrol dialog),
  // uncontrolled with the hidden input for the ones that submit a form.
  const [inner, setInner] = useState(value ?? '');
  useEffect(() => {
    if (value !== undefined) setInner(value);
  }, [value]);

  const hidden = new Set(exclude);
  const seed = people.filter((p) => !hidden.has(p.id)).map(toOption);

  async function load(term: string): Promise<SearchSelectOption[]> {
    const rows = await search(term);
    // An empty query that returns nothing keeps the seed rather than
    // emptying the list (the page's own fetch may be fresher than none).
    const source = rows.length || term ? rows : people;
    return source.filter((p) => !hidden.has(p.id)).map(toOption);
  }

  return (
    <div className="block">
      <span className="text-sm text-ink-subtle">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <SearchSelect
        className="mt-1"
        {...(name ? { name } : {})}
        value={inner}
        onChange={(id) => {
          setInner(id);
          onChange?.(id);
        }}
        options={seed}
        loadOptions={load}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        {...(onCreate ? { onCreate } : {})}
        {...(createLabel ? { createLabel } : {})}
      />
      {errors?.map((e) => (
        <span key={e} className="mt-1 block text-xs text-red-700">
          {e}
        </span>
      ))}
    </div>
  );
}
