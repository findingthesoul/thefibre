'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WorkingHoursEditor, defaultSchedule, type Schedule } from '@/components/working-hours-editor';
import { updateHost, type SaveResult } from './actions';

type Initial = {
  slug: string;
  bio: string | null;
  location: string | null;
  personal_room_url: string | null;
  timezone: string;
  photo_url: string | null;
  working_hours: Record<string, { start: string; end: string }[]> | null;
};

export function SettingsForm({ initial }: { initial: Initial }) {
  const [state, formAction, pending] = useActionState<SaveResult, FormData>(
    updateHost,
    {},
  );
  const [hours, setHours] = useState<Schedule>(
    (initial.working_hours as Schedule | null) ?? defaultSchedule(),
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="slug">URL slug</Label>
          <Input
            id="slug"
            name="slug"
            defaultValue={initial.slug}
            pattern="[a-z0-9-]+"
            required
          />
          <p className="text-xs text-ink-muted mt-1">
            meet.thefibre.app/<strong>{initial.slug}</strong>
          </p>
        </div>
        <div>
          <Label htmlFor="timezone">Timezone</Label>
          <Input
            id="timezone"
            name="timezone"
            defaultValue={initial.timezone}
            placeholder="Europe/Amsterdam"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="bio">Bio</Label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={initial.bio ?? ''}
          rows={4}
          className="mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            defaultValue={initial.location ?? ''}
            placeholder="Amsterdam, NL"
          />
        </div>
        <div>
          <Label htmlFor="photo_url">Photo URL</Label>
          <Input
            id="photo_url"
            name="photo_url"
            defaultValue={initial.photo_url ?? ''}
            placeholder="https://…"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="personal_room_url">Personal meeting room URL</Label>
        <Input
          id="personal_room_url"
          name="personal_room_url"
          defaultValue={initial.personal_room_url ?? ''}
          placeholder="https://zoom.us/j/…"
        />
        <p className="text-xs text-ink-muted mt-1">
          Used for meeting types set to &ldquo;Personal room&rdquo;.
        </p>
      </div>

      <div>
        <Label>Working hours</Label>
        <div className="mt-2">
          <WorkingHoursEditor value={hours} onChange={setHours} />
        </div>
        <input
          type="hidden"
          name="working_hours_json"
          value={JSON.stringify(hours)}
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
