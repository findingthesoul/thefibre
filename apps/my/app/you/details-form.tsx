'use client';

// Your details, editable.
//
// Two fields and a language, because that is everything on this surface a
// member owns: a name, which is identity and which GDPR Article 16 gives
// them the right to correct, and a language, which decides what every email
// from every community arrives in.
//
// The email is shown and not editable. It is the key the whole portal is
// scoped by — changing it here would not move your tickets, it would orphan
// them.
//
// The form says what saving reaches BEFORE it is pressed. "This updates your
// name everywhere" is a fact a person is entitled to in advance, not after.

import { useState } from 'react';
import { saveProfile, type MyProfile } from '@/lib/portal-api';

const LANGUAGES: { value: string; label: string }[] = [
  { value: '', label: 'No preference' },
  { value: 'en', label: 'English' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'es', label: 'Español' },
  { value: 'pt', label: 'Português' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
];

export function DetailsForm({ profile }: { profile: MyProfile }) {
  const [first, setFirst] = useState(profile.first_name ?? '');
  const [last, setLast] = useState(profile.last_name ?? '');
  const [locale, setLocale] = useState(profile.locale ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What the SERVER now holds, which is not the same as the prop after a
  // save: this is a client component and `profile` stays whatever the page
  // was rendered with. Comparing against the prop meant a successful save
  // left the form still "dirty" — no confirmation, Save still lit, inviting
  // a second identical write. Found by driving it, not by reading it.
  const [committed, setCommitted] = useState({
    first: profile.first_name ?? '',
    last: profile.last_name ?? '',
    locale: profile.locale ?? '',
  });

  const dirty = first !== committed.first || last !== committed.last || locale !== committed.locale;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await saveProfile({ first_name: first, last_name: last, locale });
      setCommitted({ first, last, locale });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not save.');
    } finally {
      setBusy(false);
    }
  }

  const field =
    'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-line-strong focus:outline-none';

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            First name
          </span>
          <input
            className={`mt-1 ${field}`}
            value={first}
            onChange={(e) => {
              setFirst(e.target.value);
              setSaved(false);
            }}
            autoComplete="given-name"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Last name
          </span>
          <input
            className={`mt-1 ${field}`}
            value={last}
            onChange={(e) => {
              setLast(e.target.value);
              setSaved(false);
            }}
            autoComplete="family-name"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Email
        </span>
        <input className={`mt-1 ${field} text-ink-muted`} value={profile.email} readOnly disabled />
        <span className="mt-1 block text-xs text-ink-muted">
          This is how every community finds you, so it cannot be changed here.
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Language
        </span>
        <select
          className={`mt-1 ${field}`}
          value={locale}
          onChange={(e) => {
            setLocale(e.target.value);
            setSaved(false);
          }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-ink-muted">
          What emails and pages arrive in, everywhere.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || !dirty}
          className="inline-flex min-h-11 items-center rounded-lg bg-ink px-5 text-sm font-medium text-surface hover:opacity-90 disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        {saved && !dirty && <span className="text-sm text-ink-muted">Saved.</span>}
        {error && <span className="text-sm text-ink-muted">{error}</span>}
      </div>

      {profile.person_rows > 1 && (
        <p className="text-xs text-ink-muted">
          Your name is used by {profile.person_rows} communities. Saving corrects it in all of
          them.
        </p>
      )}
    </form>
  );
}
