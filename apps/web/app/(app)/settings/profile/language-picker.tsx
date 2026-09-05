'use client';

import { useState, useTransition } from 'react';
import { LOCALES, LOCALE_LABELS, isLocale } from '@thefibre/shared';
import { saveLocale } from '../actions';

// The Language setting (i18n P2, D1: ONE user-level language, app-wide).
//
// Lives OUTSIDE the shared ProfileForm on purpose: the shared component is
// five apps' profile face and gaining a field there is a shared-package
// change — this setting is Fibre-web's to host (the settings hubs of the
// other apps link here). Save-on-change with optimistic revert, the same
// pattern as the member-row selects.
//
// Honest scope: today this drives the emails The Fibre sends you; the app
// screens themselves stay English until P3 translates them.

const SELECT_CLASS =
  'mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none';

export function LanguagePicker({ initial }: { initial: string | null }) {
  const [value, setValue] = useState(isLocale(initial) ? initial : '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    const prev = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const r = await saveLocale(next || null);
      if (!r.ok) {
        setValue(prev);
        setError(r.error ?? 'Could not save');
      }
    });
  }

  return (
    <section className="mt-12 border-t border-line pt-8">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">Language</div>
      <label className="mt-3 block max-w-xs">
        <span className="text-sm text-ink-subtle">Preferred language</span>
        <select
          className={SELECT_CLASS}
          value={value}
          disabled={pending}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">No preference (English)</option>
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_LABELS[l]}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-3 text-xs text-ink-muted">
        One setting for all of The Fibre&apos;s apps. Today it sets the language of the emails the
        platform sends you; the app screens themselves are in English for now.
      </p>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
