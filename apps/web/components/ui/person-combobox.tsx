'use client';

// Thin field wrapper around the shared SearchSelect in async mode.
//
// The hand-rolled type-ahead this replaced (~210 lines) searched the API as
// you typed; SearchSelect's `loadOptions` does the same job now (debounced,
// stale-guarded, in shared). What stays here is the person-shaped part:
// the searchPeople server action (every result passes the caller's RLS),
// the exclude list (already-linked people are not offered again), and the
// label + errors field chrome. Div wrapper, not <label> — a label wrapping
// SearchSelect's button misdirects clicks (component-inventory.md).

import { useEffect, useState } from 'react';
import { SearchSelect, type SearchSelectOption } from '@thefibre/shared/ui/search-select';
import { searchPeople, type PersonOption } from '@/lib/person-actions';

type Props = {
  label: string;
  name: string;
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
};

export function personLabel(p: PersonOption): string {
  return (
    [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || p.id.slice(0, 8)
  );
}

function toOption(p: PersonOption): SearchSelectOption {
  return { value: p.id, label: personLabel(p), ...(p.email ? { hint: p.email } : {}) };
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
  placeholder = 'Pick a person…',
}: Props) {
  // Controlled when the caller keeps the id in state (the enrol dialog),
  // uncontrolled with the hidden input for the ones that submit a form.
  const [inner, setInner] = useState(value ?? '');
  useEffect(() => {
    if (value !== undefined) setInner(value);
  }, [value]);

  const hidden = new Set(exclude);
  const seed = people.filter((p) => !hidden.has(p.id)).map(toOption);

  async function load(term: string): Promise<SearchSelectOption[]> {
    const rows = await searchPeople(term);
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
        name={name}
        value={inner}
        onChange={(id) => {
          setInner(id);
          onChange?.(id);
        }}
        options={seed}
        loadOptions={load}
        placeholder={placeholder}
        searchPlaceholder="Search by name or email…"
      />
      {errors?.map((e) => (
        <span key={e} className="mt-1 block text-xs text-red-700">
          {e}
        </span>
      ))}
    </div>
  );
}
