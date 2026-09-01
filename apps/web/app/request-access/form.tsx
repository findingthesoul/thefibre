'use client';

import { useActionState } from 'react';
import { submitRequestAccess, type RequestAccessResult } from './actions';

const INPUT =
  'mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none';

export type PackageOption = { id: string; name: string; priceLabel: string };

export function RequestAccessForm({
  packages,
  preselected,
}: {
  packages: PackageOption[];
  preselected: string | null;
}) {
  const [state, action, pending] = useActionState<RequestAccessResult, FormData>(
    submitRequestAccess,
    {},
  );

  if (state.ok) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-700 leading-relaxed">
        <div className="font-medium text-neutral-900">
          {state.alreadyRequested ? 'You&apos;re already on the list.' : 'Thanks — request received.'}
        </div>
        <p className="mt-2">
          We&apos;ll review and send an email when your access is ready. No further
          action needed from you.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Full name"
        name="full_name"
        required
        placeholder="Jane Doe"
        errors={state.fieldErrors?.full_name}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        required
        placeholder="jane@example.org"
        errors={state.fieldErrors?.email}
      />
      <Field
        label="Organisation (optional)"
        name="organisation_name"
        placeholder="Your company, network, programme…"
        errors={state.fieldErrors?.organisation_name}
      />
      <TextArea
        label="What would you use The Fibre for? (optional)"
        name="reason"
        placeholder="Helps us tailor your onboarding — feel free to keep it short."
        errors={state.fieldErrors?.reason}
      />

      {packages.length > 0 && (
        <fieldset>
          <legend className="text-sm text-neutral-700">
            Which package are you interested in?
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {packages.map((p) => (
              <PackagePill
                key={p.id}
                value={p.id}
                label={`${p.name} · ${p.priceLabel}`}
                defaultChecked={preselected === p.id}
              />
            ))}
            <PackagePill value="" label="Not sure yet" defaultChecked={preselected === null} />
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Just so we know — your workspace starts free either way, and nothing is charged
            until you choose to upgrade inside.
          </p>
        </fieldset>
      )}

      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Request access'}
      </button>
    </form>
  );
}

function PackagePill({
  value,
  label,
  defaultChecked,
}: {
  value: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name="desired_plan"
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="inline-block rounded-full border border-neutral-300 px-3.5 py-1.5 text-sm text-neutral-700 transition-colors peer-checked:border-neutral-900 peer-checked:bg-neutral-900 peer-checked:text-white hover:border-neutral-500">
        {label}
      </span>
    </label>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  placeholder,
  errors,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  errors?: string[] | undefined;
}) {
  return (
    <label className="block">
      <span className="text-sm text-neutral-700">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <input
        className={INPUT}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
      />
      {errors?.map((e) => (
        <span key={e} className="mt-1 block text-xs text-red-700">
          {e}
        </span>
      ))}
    </label>
  );
}

function TextArea({
  label,
  name,
  placeholder,
  errors,
}: {
  label: string;
  name: string;
  placeholder?: string;
  errors?: string[] | undefined;
}) {
  return (
    <label className="block">
      <span className="text-sm text-neutral-700">{label}</span>
      <textarea
        className={`${INPUT} min-h-[100px] resize-y`}
        name={name}
        placeholder={placeholder}
        maxLength={2000}
      />
      {errors?.map((e) => (
        <span key={e} className="mt-1 block text-xs text-red-700">
          {e}
        </span>
      ))}
    </label>
  );
}
