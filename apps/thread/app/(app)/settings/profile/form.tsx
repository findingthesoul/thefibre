'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateOrganiser } from '../actions';
import type { OrganiserRow } from '@/lib/thread-types';
import { NameAndSlugFields } from '@/components/ui/name-slug';
import { TextField, TextAreaField } from '@/components/ui/field';
import { Button } from '@/components/ui/button';

const THREAD_HOST =
  process.env.NEXT_PUBLIC_THREAD_URL?.replace(/^https?:\/\//, '') ?? 'thread.thefibre.app';

export function ProfileForm({ organiser }: { organiser: OrganiserRow }) {
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
      display_name: String(fd.get('name') ?? '').trim() || null,
      slug: String(fd.get('slug') ?? '').trim(),
      bio: String(fd.get('bio') ?? '').trim() || null,
      photo_url: String(fd.get('photo_url') ?? '').trim() || null,
      timezone: String(fd.get('timezone') ?? '').trim() || 'Europe/Amsterdam',
    };
    if (!patch.slug) return setError('Pick a slug.');
    startTransition(async () => {
      const r = await updateOrganiser(patch);
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6">
      <NameAndSlugFields
        nameLabel="Display name"
        initialName={organiser.display_name ?? ''}
        initialSlug={organiser.slug}
        prefix={`${THREAD_HOST}/`}
        slugHint="Your public organiser URL."
      />
      <TextAreaField
        label="Bio"
        name="bio"
        rows={3}
        defaultValue={organiser.bio ?? ''}
        hint="Shown on your public organiser page."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField
          label="Photo URL"
          name="photo_url"
          type="url"
          defaultValue={organiser.photo_url ?? ''}
          placeholder="https://…"
        />
        <TextField
          label="Timezone"
          name="timezone"
          defaultValue={organiser.timezone}
          hint="IANA name, e.g. Europe/Amsterdam."
        />
      </div>
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
