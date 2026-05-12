'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createOrganisation } from '../actions';

export function NewOrgForm() {
  const [state, action] = useActionState(createOrganisation, {});

  return (
    <form action={action} className="mt-8 space-y-4">
      <Field name="name" label="Name" required errors={state.fieldErrors?.name} />
      <Field name="domain" label="Domain" placeholder="example.org" errors={state.fieldErrors?.domain} />
      <Field name="country" label="Country (ISO 2-letter)" placeholder="NL" maxLength={2} errors={state.fieldErrors?.country} />
      <Field name="sector" label="Sector" placeholder="Education, government, …" errors={state.fieldErrors?.sector} />
      <Select
        name="org_type"
        label="Type"
        options={[
          { value: '', label: '—' },
          { value: 'private', label: 'Private' },
          { value: 'public', label: 'Public' },
          { value: 'ngo', label: 'NGO' },
          { value: 'cooperative', label: 'Cooperative' },
          { value: 'government', label: 'Government' },
          { value: 'education', label: 'Education' },
        ]}
        errors={state.fieldErrors?.org_type}
      />

      {state.error && (
        <div className="rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
          {state.error}
        </div>
      )}

      <Submit />
    </form>
  );
}

function Field({
  name, label, type = 'text', required = false, placeholder, maxLength, errors,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  errors?: string[] | undefined;
}) {
  return (
    <label className="block">
      <span className="text-sm text-ink-subtle">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        className="mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none"
      />
      {errors?.map((e) => (
        <span key={e} className="mt-1 block text-xs text-red-700">{e}</span>
      ))}
    </label>
  );
}

function Select({
  name, label, options, errors,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  errors?: string[] | undefined;
}) {
  return (
    <label className="block">
      <span className="text-sm text-ink-subtle">{label}</span>
      <select
        name={name}
        className="mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {errors?.map((e) => (
        <span key={e} className="mt-1 block text-xs text-red-700">{e}</span>
      ))}
    </label>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-ink text-ink-inverse px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Add organisation'}
    </button>
  );
}
