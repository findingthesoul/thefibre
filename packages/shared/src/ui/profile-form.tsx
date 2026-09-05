'use client';

// THE profile form — one component, every app.
//
// Sjoerd, 2026-09-01, looking at the two screens side by side: "It's not the
// same yet." He was right, and the reason is instructive. Both apps had the
// same fields and the same field kit, byte for byte, and still produced
// different screens: The Thread put the name first and paired the photo with
// the timezone; The Fibre led with a full-width photo and stacked the rest.
// Sharing the widgets was never going to be enough — the layout is the thing
// that drifts.
//
// So the form itself lives here now. The Thread's arrangement won, as asked.
//
// What differs between apps is passed in, and it is one field: The Thread's
// public URL. An organiser page has an address; your platform profile is not
// a page and has none.
//
// Saving stays with the caller: the two write different endpoints (one the
// platform profile, one the organiser row that overrides it), and pretending
// otherwise would put an app's business in a shared component.

import { useMemo, useState, useTransition } from 'react';
import { PhotoField } from './photo-field.js';
import { TextField, TextAreaField, SelectField } from './fields.js';
import { SearchSelect } from './search-select.js';

export type ProfileValues = {
  display_name: string;
  bio: string;
  photo_url: string | null;
  timezone: string;
};

export type ProfileSlug = {
  value: string;
  /** Shown before the input, e.g. "thread.thefibre.app/". */
  prefix: string;
  hint?: string;
  label?: string;
};

export function ProfileForm({
  initial,
  slug,
  upload,
  onSave,
  photoHint,
  bioHint,
  footer,
}: {
  initial: ProfileValues;
  /** Only for apps whose profile is a public page. */
  slug?: ProfileSlug;
  upload: (file: File) => Promise<string>;
  onSave: (
    values: ProfileValues & { slug?: string },
  ) => Promise<{ ok: boolean; error?: string | undefined }>;
  photoHint?: string;
  bioHint?: string;
  footer?: React.ReactNode;
}) {
  const [displayName, setDisplayName] = useState(initial.display_name);
  const [slugValue, setSlugValue] = useState(slug?.value ?? '');
  const [bio, setBio] = useState(initial.bio);
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial.photo_url);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  // A picker rather than a typed IANA name — the one place The Fibre was ahead
  // of The Thread, kept. Falls back to a text field on a runtime without
  // supportedValuesOf.
  const timezones = useMemo(() => {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    return intl.supportedValuesOf?.('timeZone') ?? [];
  }, []);

  function touched<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setSaved(false);
    };
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (slug && !slugValue.trim()) return setError('Pick a public URL.');
    start(async () => {
      const r = await onSave({
        display_name: displayName.trim(),
        bio: bio.trim(),
        photo_url: photoUrl,
        timezone: timezone.trim() || 'Europe/Amsterdam',
        ...(slug ? { slug: slugValue.trim() } : {}),
      });
      if (!r.ok) return setError(r.error ?? 'could not save');
      setSaved(true);
    });
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-6">
      <TextField
        label="Display name"
        required
        value={displayName}
        onChange={(e) => touched(setDisplayName)(e.target.value)}
      />

      {slug && (
        <label className="block">
          <span className="text-sm text-ink-subtle">
            {slug.label ?? 'Public URL'}
            <span className="text-red-600"> *</span>
          </span>
          <div className="mt-1 flex">
            <span className="inline-flex items-center rounded-l-md border border-r-0 border-line bg-surface-sunken px-3 text-sm text-ink-muted">
              {slug.prefix}
            </span>
            <input
              className="w-full rounded-r-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none"
              value={slugValue}
              onChange={(e) => touched(setSlugValue)(e.target.value)}
            />
          </div>
          {slug.hint && <span className="mt-1 block text-xs text-ink-muted">{slug.hint}</span>}
        </label>
      )}

      <TextAreaField
        label="Bio"
        rows={3}
        value={bio}
        onChange={(e) => touched(setBio)(e.target.value)}
        hint={bioHint}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PhotoField
          label="Photo"
          value={photoUrl}
          onChange={touched(setPhotoUrl)}
          upload={upload}
          onError={setError}
          hint={photoHint}
        />
        {timezones.length > 0 ? (
          // div, not label: a label wrapping SearchSelect's internal button
          // misdirects clicks (sweep 2026-09-05).
          <div className="block">
            <span className="text-sm text-ink-subtle">Timezone</span>
            <SearchSelect
              className="mt-1"
              value={timezone}
              onChange={touched(setTimezone)}
              options={timezones.map((tz) => ({ value: tz, label: tz }))}
              placeholder="Pick a timezone…"
              searchPlaceholder="Search timezones…"
            />
          </div>
        ) : (
          <TextField
            label="Timezone"
            value={timezone}
            onChange={(e) => touched(setTimezone)(e.target.value)}
            hint="IANA name, e.g. Europe/Amsterdam."
          />
        )}
      </div>

      {footer}

      {error && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center rounded-md bg-ink px-4 py-2 text-sm font-medium text-surface hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-sm text-ink-subtle">Saved.</span>}
      </div>
    </form>
  );
}
