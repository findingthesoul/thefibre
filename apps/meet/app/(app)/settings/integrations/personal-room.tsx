'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { updateHost, type SaveResult } from '../actions';

export function PersonalRoomForm({ initial }: { initial: string }) {
  const [state, formAction, pending] = useActionState<SaveResult, FormData>(
    updateHost,
    {},
  );
  return (
    <form
      action={formAction}
      className="rounded-lg border border-line bg-surface-raised p-6 space-y-4"
    >
      <TextField
        label="Personal meeting room URL"
        name="personal_room_url"
        defaultValue={initial}
        placeholder="https://zoom.us/j/…"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        {state.ok && <span className="text-xs text-emerald-700">Saved.</span>}
        {state.error && <span className="text-xs text-red-700">{state.error}</span>}
      </div>
    </form>
  );
}
