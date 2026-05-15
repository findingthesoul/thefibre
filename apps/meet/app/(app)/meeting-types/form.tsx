'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
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
    <form action={formAction} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={initial.name ?? ''} required />
        </div>
        <div>
          <Label htmlFor="slug">URL slug</Label>
          <Input
            id="slug"
            name="slug"
            defaultValue={initial.slug ?? ''}
            placeholder="intro"
            pattern="[a-z0-9-]+"
            required
          />
          <p className="text-xs text-ink-muted mt-1">
            meet.thefibre.app/your-slug/<strong>this</strong>
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          defaultValue={initial.description ?? ''}
          rows={3}
          className="mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="duration_minutes">Duration (min)</Label>
          <Input
            id="duration_minutes"
            name="duration_minutes"
            type="number"
            min={5}
            max={480}
            defaultValue={initial.duration_minutes ?? 30}
            required
          />
        </div>
        <div>
          <Label htmlFor="min_notice_minutes">Min notice (min)</Label>
          <Input
            id="min_notice_minutes"
            name="min_notice_minutes"
            type="number"
            min={0}
            defaultValue={initial.min_notice_minutes ?? 60}
          />
        </div>
        <div>
          <Label htmlFor="max_advance_days">Bookable up to (days ahead)</Label>
          <Input
            id="max_advance_days"
            name="max_advance_days"
            type="number"
            min={1}
            max={365}
            defaultValue={initial.max_advance_days ?? 60}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="buffer_before_minutes">Buffer before (min)</Label>
          <Input
            id="buffer_before_minutes"
            name="buffer_before_minutes"
            type="number"
            min={0}
            defaultValue={initial.buffer_before_minutes ?? 0}
          />
        </div>
        <div>
          <Label htmlFor="buffer_after_minutes">Buffer after (min)</Label>
          <Input
            id="buffer_after_minutes"
            name="buffer_after_minutes"
            type="number"
            min={0}
            defaultValue={initial.buffer_after_minutes ?? 0}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="conferencing_provider">Conferencing</Label>
          <Select
            id="conferencing_provider"
            name="conferencing_provider"
            defaultValue={initial.conferencing_provider ?? 'google_meet'}
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="default_location">Default location</Label>
          <Input
            id="default_location"
            name="default_location"
            defaultValue={initial.default_location ?? ''}
            placeholder="Address, room, link…"
          />
        </div>
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

      <div className="flex items-center gap-3">
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
