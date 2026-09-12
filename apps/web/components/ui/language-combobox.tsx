'use client';

// Thin field wrapper around the shared SearchSelect, built as a deliberate
// twin of country-combobox.tsx — the two fields sit side by side in the same
// dialog and behaved differently for no reason: one a picker, one a text box
// asking you to know an ISO code.
//
// Note the div wrapper, not a <label>: a label wrapping SearchSelect's button
// misdirects clicks (component-inventory.md, sweep 2026-09-05).

import { useState } from 'react';
import { SearchSelect } from '@thefibre/shared/ui/search-select';
import { LANGUAGES, languageName } from '@thefibre/shared/languages';

type Props = {
  label: string;
  name: string;
  defaultValue?: string | null | undefined;
  required?: boolean | undefined;
  errors?: string[] | undefined;
  placeholder?: string | undefined;
  clearLabel?: string | undefined;
  searchPlaceholder?: string | undefined;
};

const OPTIONS = LANGUAGES.map((l) => ({ value: l.code, name: l.name })).map((l) => ({
  value: l.value,
  label: l.name,
  hint: l.value,
}));

export function LanguageCombobox({
  label,
  name,
  defaultValue,
  required,
  errors,
  placeholder = 'Pick a language…',
  clearLabel = '— No preference —',
  searchPlaceholder = 'Search languages…',
}: Props) {
  // Stored codes are lowercase ISO 639-1, but the column is free text and has
  // been since it was a text box, so it may hold 'EN' or 'en-GB'. Lowercase
  // to match, and keep a value we cannot place as its own option rather than
  // dropping it — a dropdown that silently discards what somebody already
  // typed is worse than the text box it replaced.
  const stored = (defaultValue ?? '').toLowerCase();
  const [code, setCode] = useState(stored);
  const known = LANGUAGES.some((l) => l.code === stored);
  const options =
    stored && !known
      ? [{ value: stored, label: languageName(stored) ?? stored, hint: stored }, ...OPTIONS]
      : OPTIONS;

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
        options={options}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        {...(required ? {} : { clearLabel })}
      />
      {errors?.map((e) => (
        <span key={e} className="mt-1 block text-xs text-red-700">
          {e}
        </span>
      ))}
    </div>
  );
}
