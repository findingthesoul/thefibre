'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TextField, SelectField, TextAreaField } from '@/components/ui/field';
import { createMeetingType, updateMeetingType, type SaveResult } from './actions';

export type MeetingTypeFormValues = {
  id?: string;
  slug?: string;
  name?: string;
  description?: string | null;
  duration_minutes?: number;
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
  min_notice_minutes?: number;
  max_advance_days?: number;
  conferencing_provider?: string;
  default_location?: string | null;
  is_active?: boolean;
};

const PROVIDERS = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'in_person', label: 'In person' },
  { value: 'personal_room', label: 'Personal room' },
  { value: 'none', label: 'No conferencing' },
];

export function MeetingTypeForm({ initial }: { initial: MeetingTypeFormValues }) {
  const isEdit = !!initial.id;
  const action = isEdit
    ? updateMeetingType.bind(null, initial.id!)
    : createMeetingType;
  const [state, formAction, pending] = useActionState<SaveResult, FormData>(
    action as (prev: SaveResult, fd: FormData) => Promise<SaveResult>,
    {},
  );

  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField label="Name" name="name" defaultValue={initial.name ?? ''} required />
        <TextField
          label="URL slug"
          name="slug"
          defaultValue={initial.slug ?? ''}
          placeholder="intro"
          pattern="[a-z0-9-]+"
          required
          hint="meet.thefibre.app/your-handle/<this>"
        />
      </div>

      <TextAreaField
        label="Description"
        name="description"
        defaultValue={initial.description ?? ''}
        rows={3}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TextField
          label="Duration (min)"
          name="duration_minutes"
          type="number"
          min={5}
          max={480}
          defaultValue={initial.duration_minutes ?? 30}
          required
        />
        <TextField
          label="Min notice (min)"
          name="min_notice_minutes"
          type="number"
          min={0}
          defaultValue={initial.min_notice_minutes ?? 60}
        />
        <TextField
          label="Bookable up to (days ahead)"
          name="max_advance_days"
          type="number"
          min={1}
          max={365}
          defaultValue={initial.max_advance_days ?? 60}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField
          label="Buffer before (min)"
          name="buffer_before_minutes"
          type="number"
          min={0}
          defaultValue={initial.buffer_before_minutes ?? 0}
        />
        <TextField
          label="Buffer after (min)"
          name="buffer_after_minutes"
          type="number"
          min={0}
          defaultValue={initial.buffer_after_minutes ?? 0}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SelectField
          label="Conferencing"
          name="conferencing_provider"
          defaultValue={initial.conferencing_provider ?? 'google_meet'}
          options={PROVIDERS}
        />
        <TextField
          label="Default location"
          name="default_location"
          defaultValue={initial.default_location ?? ''}
          placeholder="Address, room, link…"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={initial.is_active ?? true}
        />
        <span>Active (visible on your booking page)</span>
      </label>

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

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create meeting type'}
        </Button>
        <Link
          href="/meeting-types"
          className="text-sm text-ink-subtle hover:text-ink underline underline-offset-2"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
