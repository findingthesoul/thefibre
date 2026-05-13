'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { updateMe } from './actions';

type Me = { full_name: string | null; avatar_url: string | null };

export function ProfileForm({ me }: { me: Me }) {
  const [state, action] = useActionState(updateMe, {});

  return (
    <form action={action} className="mt-4 space-y-4 max-w-md">
      <TextField
        label="Full name"
        name="full_name"
        defaultValue={me.full_name ?? ''}
        required
        errors={state.fieldErrors?.full_name}
      />
      <TextField
        label="Avatar URL"
        name="avatar_url"
        defaultValue={me.avatar_url ?? ''}
        placeholder="https://…"
        errors={state.fieldErrors?.avatar_url}
      />

      {state.error && (
        <div className="rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
          {state.error}
        </div>
      )}

      {state.ok && (
        <div className="rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
          Saved.
        </div>
      )}

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  );
}
