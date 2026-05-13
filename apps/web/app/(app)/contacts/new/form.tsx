'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createPerson } from '../actions';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';

export function NewPersonForm() {
  const [state, action] = useActionState(createPerson, {});

  return (
    <form action={action} className="mt-8 space-y-4">
      <TextField label="First name" name="first_name" required errors={state.fieldErrors?.first_name} />
      <TextField label="Last name" name="last_name" required errors={state.fieldErrors?.last_name} />
      <TextField label="Email" name="email" type="email" required errors={state.fieldErrors?.email} />
      <TextField label="Country (ISO 2-letter)" name="country" placeholder="NL" maxLength={2} errors={state.fieldErrors?.country} />

      {state.error && (
        <div className="rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
          {state.error}
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
      {pending ? 'Saving…' : 'Add person'}
    </Button>
  );
}
