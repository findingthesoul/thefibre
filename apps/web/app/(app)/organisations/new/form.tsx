'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createOrganisation } from '../actions';
import { Button } from '@/components/ui/button';
import { TextField, SelectField } from '@/components/ui/field';

const ORG_TYPES = [
  { value: '', label: '—' },
  { value: 'private', label: 'Private' },
  { value: 'public', label: 'Public' },
  { value: 'ngo', label: 'NGO' },
  { value: 'cooperative', label: 'Cooperative' },
  { value: 'government', label: 'Government' },
  { value: 'education', label: 'Education' },
];

export function NewOrgForm() {
  const [state, action] = useActionState(createOrganisation, {});

  return (
    <form action={action} className="mt-8 space-y-4">
      <TextField label="Name" name="name" required errors={state.fieldErrors?.name} />
      <TextField label="Domain" name="domain" placeholder="example.org" errors={state.fieldErrors?.domain} />
      <TextField label="Country (ISO 2-letter)" name="country" placeholder="NL" maxLength={2} errors={state.fieldErrors?.country} />
      <TextField label="Sector" name="sector" placeholder="Education, government, …" errors={state.fieldErrors?.sector} />
      <SelectField label="Type" name="org_type" options={ORG_TYPES} errors={state.fieldErrors?.org_type} />

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
      {pending ? 'Saving…' : 'Add organisation'}
    </Button>
  );
}
