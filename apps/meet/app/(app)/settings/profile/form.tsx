'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField, TextAreaField } from '@/components/ui/field';
import { updateHost, type SaveResult } from '../actions';

type Initial = {
  slug: string;
  bio: string | null;
  location: string | null;
  personal_room_url: string | null;
  photo_url: string | null;
};

export function ProfileForm({ initial }: { initial: Initial }) {
  const [state, formAction, pending] = useActionState<SaveResult, FormData>(
    updateHost,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      <TextField
        label="URL slug"
        name="slug"
        defaultValue={initial.slug}
        pattern="[a-z0-9-]+"
        required
        hint={`Your public booking link: meet.thefibre.app/${initial.slug}`}
      />
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
      <TextField
        label="Personal meeting room URL"
        name="personal_room_url"
        defaultValue={initial.personal_room_url ?? ''}
        placeholder="https://zoom.us/j/…"
        hint="Used for meeting types set to “Personal room”."
      />
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
