'use client';

import { useActionState, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TextField, TextAreaField } from '@/components/ui/field';
import { uploadAsset } from '@/lib/upload';
import { updateHost, type SaveResult } from '../actions';
import { MEET_HOST } from '@/lib/public-host';

type Initial = {
  slug: string;
  bio: string | null;
  location: string | null;
  photo_url: string | null;
};

export function ProfileForm({ initial }: { initial: Initial }) {
  const [state, formAction, pending] = useActionState<SaveResult, FormData>(
    updateHost,
    {},
  );
  const [slug, setSlug] = useState(initial.slug);
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial.photo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      setPhotoUrl(await uploadAsset(file));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label className="block text-sm text-ink-subtle">
          Public URL <span className="text-red-600">*</span>
        </label>
        <div className="mt-1 flex items-stretch rounded-md border border-line bg-surface-raised overflow-hidden focus-within:border-line-strong">
          <span className="px-3 flex items-center text-sm text-ink-muted bg-surface-sunken border-r border-line whitespace-nowrap">
            {MEET_HOST}/
          </span>
          <input
            name="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/g, ''))}
            required
            pattern="[a-z0-9-]+"
            className="flex-1 px-3 py-2 text-sm bg-transparent focus:outline-none min-w-0"
          />
        </div>
        <span className="mt-1 block text-xs text-ink-muted">
          Changing this updates your public booking link.
        </span>
      </div>
      <TextAreaField
        label="Bio"
        name="bio"
        defaultValue={initial.bio ?? ''}
        rows={4}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField
          label="Location"
          name="location"
          defaultValue={initial.location ?? ''}
          placeholder="Amsterdam, NL"
        />
        <div>
          <span className="text-sm text-ink-subtle">Photo</span>
          {/* The upload happens client-side; the saved URL rides along with
              the form submit via this hidden field. */}
          <input type="hidden" name="photo_url" value={photoUrl ?? ''} />
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
          {uploadError && (
            <span className="mt-1 block text-xs text-red-700">{uploadError}</span>
          )}
        </div>
      </div>
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Saved.
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}
