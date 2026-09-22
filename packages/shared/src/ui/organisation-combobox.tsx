'use client';

// THE organisation picker. Sibling of ui/person-combobox.tsx, and here for
// the same reason and on the same day: Sjoerd, 2026-09-22, seeing Connect
// about to hand-roll a third search box — *"Add company - also a single point
// of truth."*
//
// Same arrangement: a thin organisation-shaped wrapper around SearchSelect in
// async mode, with `search` injected because a server action is bound to one
// app's apiFetch and session. Every result therefore passes that caller's own
// RLS.
//
// `onCreate` is SearchSelect's own "add what you typed" row. It shows whenever
// there is a query — including when nothing matched, which is exactly when it
// is wanted.

import { useEffect, useState } from 'react';
import { SearchSelect, type SearchSelectOption } from './search-select.js';

export type OrganisationOption = {
  id: string;
  name: string;
  domain: string | null;
};

function toOption(o: OrganisationOption): SearchSelectOption {
  return { value: o.id, label: o.name, ...(o.domain ? { hint: o.domain } : {}) };
}

export type OrganisationComboboxProps = {
  label: string;
  name?: string;
  search: (query: string) => Promise<OrganisationOption[]>;
  /** Seed list shown before the first search response. */
  organisations?: OrganisationOption[];
  exclude?: string[];
  value?: string;
  onChange?: (id: string) => void;
  required?: boolean | undefined;
  errors?: string[] | undefined;
  placeholder?: string | undefined;
  searchPlaceholder?: string | undefined;
  onCreate?: (typed: string) => void;
  createLabel?: (typed: string) => string;
};

export function OrganisationCombobox({
  label,
  name,
  search,
  organisations = [],
  exclude = [],
  value,
  onChange,
  required,
  errors,
  placeholder = 'Pick an organisation…',
  searchPlaceholder = 'Search by name or domain…',
  onCreate,
  createLabel,
}: OrganisationComboboxProps) {
  const [inner, setInner] = useState(value ?? '');
  useEffect(() => {
    if (value !== undefined) setInner(value);
  }, [value]);

  const hidden = new Set(exclude);
  const seed = organisations.filter((o) => !hidden.has(o.id)).map(toOption);

  async function load(term: string): Promise<SearchSelectOption[]> {
    const rows = await search(term);
    const source = rows.length || term ? rows : organisations;
    return source.filter((o) => !hidden.has(o.id)).map(toOption);
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
