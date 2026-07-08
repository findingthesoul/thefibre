'use client';

// The platform-profile form — ported from The Thread's settings/profile
// form. Thread's version edits the organiser overlay (slug + photo upload
// through Thread-only components); this one edits the platform values
// directly with plain labelled inputs (Pulse has no field/name-slug kit).

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { updateMyProfile } from './actions';

export type PlatformProfile = {
  display_name: string | null;
  bio: string | null;
  timezone: string | null;
};

const INPUT =
  'mt-1 w-full max-w-md rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none placeholder:text-ink-muted';

export function ProfileForm({ profile }: { profile: PlatformProfile }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    const patch = {
      display_name: String(fd.get('display_name') ?? '').trim() || null,
      bio: String(fd.get('bio') ?? '').trim() || null,
      timezone: String(fd.get('timezone') ?? '').trim() || 'Europe/Amsterdam',
    };
    startTransition(async () => {
      const r = await updateMyProfile(patch);
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6">
      <label className="block">
        <span className="text-sm text-ink-subtle">Display name</span>
        <input
          name="display_name"
          defaultValue={profile.display_name ?? ''}
          placeholder="Your name as others see it"
          className={INPUT}
        />
      </label>
      <label className="block">
        <span className="text-sm text-ink-subtle">Bio</span>
        <textarea
          name="bio"
          rows={3}
          defaultValue={profile.bio ?? ''}
          className={`${INPUT} max-w-xl`}
        />
        <span className="mt-1 block text-xs text-ink-muted">
          A short introduction, shared across Fibre apps.
        </span>
      </label>
      <label className="block">
        <span className="text-sm text-ink-subtle">Timezone</span>
        <input
          name="timezone"
          defaultValue={profile.timezone ?? 'Europe/Amsterdam'}
          className={INPUT}
        />
        <span className="mt-1 block text-xs text-ink-muted">
          IANA name, e.g. Europe/Amsterdam.
        </span>
      </label>
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
