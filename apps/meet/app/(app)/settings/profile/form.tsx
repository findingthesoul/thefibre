'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField, TextAreaField } from '@/components/ui/field';
import { updateHost, type SaveResult } from '../actions';

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

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label className="block text-sm text-ink-subtle">
          Public URL <span className="text-red-600">*</span>
        </label>
        <div className="mt-1 flex items-stretch rounded-md border border-line bg-surface-raised overflow-hidden focus-within:border-line-strong">
          <span className="px-3 flex items-center text-sm text-ink-muted bg-surface-sunken border-r border-line whitespace-nowrap">
            meet.thefibre.app/
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
        <TextField
          label="Photo URL"
          name="photo_url"
          defaultValue={initial.photo_url ?? ''}
          placeholder="https://…"
        />
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
