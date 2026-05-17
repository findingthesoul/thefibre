'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import {
  WorkingHoursEditor,
  coerceSchedule,
  type Schedule,
} from '@/components/working-hours-editor';
import { updateHost, type SaveResult } from '../actions';

type Initial = {
  timezone: string;
  working_hours: Record<string, { start: string; end: string }[]> | null;
};

export function AvailabilityForm({ initial }: { initial: Initial }) {
  const [state, formAction, pending] = useActionState<SaveResult, FormData>(
    updateHost,
    {},
  );
  const [hours, setHours] = useState<Schedule>(coerceSchedule(initial.working_hours));

  return (
    <form action={formAction} className="space-y-6">
      <div className="rounded-lg border border-line bg-surface-raised p-6">
        <div className="text-base font-medium">Timezone &amp; weekly hours</div>
        <p className="mt-1 text-sm text-ink-subtle">
          Your bookable windows in your local timezone.
        </p>

        <div className="mt-5">
          <TextField
            label="Timezone"
            name="timezone"
            defaultValue={initial.timezone}
            placeholder="Europe/Amsterdam"
          />
        </div>

        <div className="mt-6">
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
