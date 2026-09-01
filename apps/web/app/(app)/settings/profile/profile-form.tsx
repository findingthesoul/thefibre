'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PhotoField } from '@thefibre/shared/ui/photo-field';
import { TextField, TextAreaField, SelectField } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { uploadAsset } from '@/lib/upload';
import { saveProfile } from '../actions';

/**
 * One profile, and it is The Thread's — photo you upload rather than a URL you
 * paste, name, bio, timezone, in that order (Sjoerd, 2026-09-01: "it should be
 * one, and The Thread should be leading").
 *
 * The account section that used to sit above this is gone. It asked for a full
 * name and an "Avatar URL" — the same two things under different names, saved
 * to a different table, free to disagree with these. Now this form writes both:
 * the profile every app inherits, and the user row the sidebar reads.
 *
 * The timezone stays a picker rather than The Thread's free-text IANA field.
 * That is the one place The Fibre was already ahead, and "Europe/Amsterdam"
 * typed by hand is a support ticket waiting to happen.
 */
export type PublicProfile = {
  display_name: string | null;
  bio: string | null;
  photo_url: string | null;
  timezone: string | null;
};

export function ProfileForm({ profile, email }: { profile: PublicProfile; email: string }) {
  const router = useRouter();
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile.photo_url ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const timezones = useMemo(() => {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    return intl.supportedValuesOf?.('timeZone') ?? [];
  }, []);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    const str = (k: string) => String(fd.get(k) ?? '').trim() || null;
    start(async () => {
      const r = await saveProfile({
        display_name: str('display_name'),
        bio: str('bio'),
        photo_url: photoUrl,
        timezone: str('timezone'),
      });
      if (!r.ok) return setError(r.error ?? 'could not save');
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6 max-w-xl">
      <PhotoField
        label="Photo"
        value={photoUrl}
        onChange={(url) => {
          setPhotoUrl(url);
          setSaved(false);
        }}
        upload={uploadAsset}
        onError={setError}
        hint="Shown wherever the apps show you."
      />
      <TextField
        label="Display name"
        name="display_name"
        defaultValue={profile.display_name ?? ''}
        placeholder="How the apps show your name"
      />
      <TextAreaField
        label="Bio"
        name="bio"
        rows={3}
        defaultValue={profile.bio ?? ''}
        placeholder="A short line about you"
      />
      {timezones.length > 0 ? (
        <SelectField
          label="Timezone"
          name="timezone"
          defaultValue={profile.timezone ?? ''}
          options={[{ value: '', label: '—' }, ...timezones.map((tz) => ({ value: tz, label: tz }))]}
        />
      ) : (
        <TextField
          label="Timezone"
          name="timezone"
          defaultValue={profile.timezone ?? ''}
          placeholder="Europe/Amsterdam"
          hint="IANA timezone name"
        />
      )}
      <p className="text-xs text-ink-muted">
        Signed in as {email}. Every app inherits this profile — The Thread and Meet can override
        the name and photo on their own public pages.
      </p>
      {error && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        {saved && <span className="text-sm text-ink-subtle">Saved.</span>}
      </div>
    </form>
  );
}
