'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField, TextAreaField } from '@/components/ui/field';
import {
  WorkingHoursEditor,
  coerceSchedule,
  type Schedule,
} from '@/components/working-hours-editor';
import { updateHost, type SaveResult } from './actions';

type Initial = {
  slug: string;
  bio: string | null;
  location: string | null;
  personal_room_url: string | null;
  timezone: string;
  photo_url: string | null;
  working_hours: Record<string, { start: string; end: string }[]> | null;
  requires_approval?: boolean;
};

export function SettingsForm({ initial }: { initial: Initial }) {
  const [state, formAction, pending] = useActionState<SaveResult, FormData>(
    updateHost,
    {},
  );
  const [hours, setHours] = useState<Schedule>(coerceSchedule(initial.working_hours));

  return (
    <form action={formAction} className="space-y-5">
      <TextField
        label="URL slug"
        name="slug"
        defaultValue={initial.slug}
        pattern="[a-z0-9-]+"
        required
        hint={`Changing this updates your public booking link: meet.thefibre.app/${initial.slug}`}
      />
      <TextField
        label="Timezone"
        name="timezone"
        defaultValue={initial.timezone}
        placeholder="Europe/Amsterdam"
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

      <div>
        <span className="text-sm text-ink-subtle">Working hours</span>
        <div className="mt-2">
          <WorkingHoursEditor value={hours} onChange={setHours} />
        </div>
        <input
          type="hidden"
          name="working_hours_json"
          value={JSON.stringify(hours)}
        />
      </div>

      <div className="border-t border-line pt-5">
        <div className="text-sm font-medium">Approval default</div>
        <p className="mt-1 text-sm text-ink-subtle">
          Sets the default for new meeting types. Each meeting type can
          still override this on its Availability tab.
        </p>
        {/* Presence sentinel so an unchecked box still updates the column. */}
        <input type="hidden" name="requires_approval_present" value="1" />
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="requires_approval"
            defaultChecked={initial.requires_approval ?? false}
            className="mt-1"
          />
          <span>
            Require my approval before a booking is confirmed
            <span className="block text-xs text-ink-muted mt-0.5">
              Invitees get a "request received" email; you approve or reject from the Bookings page.
            </span>
          </span>
        </label>
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
