'use client';

// Thin field wrapper around the shared SearchSelect (label + errors chrome).
// The hand-rolled type-ahead this replaced (~140 lines) is gone — countries
// are a fixed list in the bundle, exactly SearchSelect's sync case.
// Note the div wrapper, not a <label>: a label wrapping SearchSelect's
// button misdirects clicks (component-inventory.md, sweep 2026-09-05).

import { useState } from 'react';
import { SearchSelect } from '@thefibre/shared/ui/search-select';
import { COUNTRIES } from '@thefibre/shared/countries';

type Props = {
  label: string;
  name: string;
  defaultValue?: string | null | undefined;
  required?: boolean | undefined;
  errors?: string[] | undefined;
  placeholder?: string | undefined;
};

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name, hint: c.code }));

export function CountryCombobox({
  label,
  name,
  defaultValue,
  required,
  errors,
  placeholder = 'Pick a country…',
}: Props) {
  const [code, setCode] = useState((defaultValue ?? '').toUpperCase());

  return (
    <div className="block">
      <span className="text-sm text-ink-subtle">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <SearchSelect
        className="mt-1"
        name={name}
        value={code}
        onChange={setCode}
        options={COUNTRY_OPTIONS}
        placeholder={placeholder}
        searchPlaceholder="Search countries…"
        {...(required ? {} : { clearLabel: '— No country —' })}
      />
      {errors?.map((e) => (
        <span key={e} className="mt-1 block text-xs text-red-700">
          {e}
        </span>
      ))}
    </div>
  );
}
