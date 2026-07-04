'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, X } from 'lucide-react';
import { updateOrganiser } from '../actions';
import type { OrganiserRow } from '@/lib/thread-types';
import { NameAndSlugFields } from '@/components/ui/name-slug';
import { TextField, TextAreaField } from '@/components/ui/field';
import { uploadAsset } from '@/lib/upload';
import { Button } from '@/components/ui/button';

const THREAD_HOST =
  process.env.NEXT_PUBLIC_THREAD_URL?.replace(/^https?:\/\//, '') ?? 'thread.thefibre.app';

export function ProfileForm({ organiser }: { organiser: OrganiserRow }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [photoUrl, setPhotoUrl] = useState<string | null>(organiser.photo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      setPhotoUrl(await uploadAsset(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    const patch = {
      display_name: String(fd.get('name') ?? '').trim() || null,
      slug: String(fd.get('slug') ?? '').trim(),
      bio: String(fd.get('bio') ?? '').trim() || null,
      photo_url: photoUrl,
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
        <div>
          <span className="text-sm text-ink-subtle">Photo</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickPhoto}
          />
          {photoUrl ? (
            <div className="mt-1 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt=""
                className="h-16 w-16 rounded-full object-cover ring-1 ring-line"
              />
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-xs text-ink-subtle hover:text-ink text-left"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="text-xs text-ink-subtle hover:text-ink inline-flex items-center gap-1"
                >
                  <X size={11} strokeWidth={1.75} /> Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="mt-1 w-full rounded-md border-2 border-dashed border-line hover:border-yellow-400 hover:bg-yellow-50/50 text-ink-subtle hover:text-ink py-4 text-sm inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <ImagePlus size={16} strokeWidth={1.75} />
              {uploading ? 'Uploading…' : 'Upload photo'}
            </button>
          )}
          <span className="mt-1 block text-xs text-ink-muted">
            Shown on your public organiser page.
          </span>
        </div>
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
