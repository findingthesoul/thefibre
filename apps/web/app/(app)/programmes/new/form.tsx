'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { TextField, SelectField } from '@/components/ui/field';
import { DateField } from '@/components/ui/date-field';
import { createProgramme } from '../actions';

const FORMATS = [
  { value: '', label: '—' },
  { value: 'meeting', label: 'Meeting — Meet' },
  { value: 'event', label: 'Event — Thread' },
  { value: 'journey', label: 'Journey — Thread' },
  { value: 'self_paced', label: 'Self-paced — Learn' },
  { value: 'blended', label: 'Blended — Learn' },
];

export function NewProgrammeForm() {
  const [state, action] = useActionState(createProgramme, {});
  return (
    <form action={action} className="mt-8 space-y-4">
      <TextField label="Title" name="title" required errors={state.fieldErrors?.title} />
      <SelectField label="Format" name="format" required options={FORMATS} errors={state.fieldErrors?.format} hint="The format determines which app delivers this programme." />
      <DateField label="Start date" name="starts_on" />
      <DateField label="End date" name="ends_on" />

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
      {pending ? 'Creating…' : 'Create programme'}
    </Button>
  );
}
