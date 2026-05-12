'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createPerson } from '../actions';

export function NewPersonForm() {
  const [state, action] = useActionState(createPerson, {});

  return (
    <form action={action} className="mt-8 space-y-4">
      <Field name="first_name" label="First name" required errors={state.fieldErrors?.first_name} />
      <Field name="last_name" label="Last name" required errors={state.fieldErrors?.last_name} />
      <Field name="email" type="email" label="Email" required errors={state.fieldErrors?.email} />
      <Field name="country" label="Country (ISO 2-letter)" placeholder="NL" maxLength={2} errors={state.fieldErrors?.country} />

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
  name,
  label,
  type = 'text',
  required = false,
  placeholder,
  maxLength,
  errors,
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
        <span key={e} className="mt-1 block text-xs text-red-700">
          {e}
        </span>
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
      {pending ? 'Saving…' : 'Add person'}
    </button>
  );
}
