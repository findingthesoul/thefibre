'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import type { RegistrationField } from '@/lib/thread-types';

function fmtPrice(cents: number | null, currency: string | null): string {
  if (!cents) return 'Free';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency ?? 'EUR',
  }).format(cents / 100);
}

const INPUT =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm focus:border-line-strong focus:outline-none placeholder:text-ink-muted';

export function EnrolCard({
  organiserSlug,
  organiserName,
  threadSlug,
  priceCents,
  priceCurrency,
  registrationFields,
  enrolmentOpen,
}: {
  organiserSlug: string;
  organiserName: string;
  threadSlug: string;
  priceCents: number | null;
  priceCurrency: string | null;
  registrationFields: RegistrationField[];
  enrolmentOpen: boolean;
}) {
  const [state, setState] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  // One idempotency key per page visit — double-submits collapse server-side.
  const requestId = useMemo(
    () => `enr_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
    [],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    if (!name || !email) return setError('Name and email are required.');

    const answers: Record<string, unknown> = {};
    for (const f of registrationFields) {
      const v = f.type === 'checkbox' ? fd.get(`rf_${f.key}`) === 'on' : String(fd.get(`rf_${f.key}`) ?? '').trim();
      if (f.required && (v === '' || v === false)) {
        return setError(`Please fill in “${f.label}”.`);
      }
      answers[f.key] = v;
    }

    setState('submitting');
    try {
      await publicFetch('/api/v1/thread/public/enrol', {
        method: 'POST',
        body: JSON.stringify({
          organiser_slug: organiserSlug,
          thread_slug: threadSlug,
          name,
          email,
          answers,
          marketing_opt_in: fd.get('marketing_opt_in') === 'on',
          request_id: requestId,
        }),
      });
      setState('done');
    } catch (err) {
      setState('idle');
      const body = err instanceof PublicApiError ? (err.body as { error?: unknown }) : null;
      setError(
        typeof body?.error === 'string' ? body.error : 'Something went wrong — please try again.',
      );
    }
  }

  return (
    <aside className="rounded-xl border border-line bg-surface-raised p-5 md:sticky md:top-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Enrol</h2>
        <span className="text-sm text-ink-subtle">{fmtPrice(priceCents, priceCurrency)}</span>
      </div>

      {state === 'done' ? (
        <div className="mt-4 flex items-start gap-2.5 text-sm text-ink-subtle">
          <CheckCircle2 size={18} strokeWidth={1.75} className="text-emerald-600 shrink-0 mt-0.5" />
          <p>
            You&apos;re enrolled. A confirmation is on its way to your inbox —
            see you in the thread.
          </p>
        </div>
      ) : !enrolmentOpen ? (
        <p className="mt-4 text-sm text-ink-subtle">
          Enrolment is closed for this thread.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 space-y-3.5">
          <label className="block">
            <span className="text-xs text-ink-subtle">Name</span>
            <input name="name" required className={INPUT} autoComplete="name" />
          </label>
          <label className="block">
            <span className="text-xs text-ink-subtle">Email</span>
            <input name="email" type="email" required className={INPUT} autoComplete="email" />
          </label>

          {registrationFields.map((f) => (
            <RegistrationFieldInput key={f.key} field={f} />
          ))}

          <label className="flex items-start gap-2 pt-1">
            <input type="checkbox" name="marketing_opt_in" className="mt-0.5" />
            <span className="text-xs text-ink-subtle leading-relaxed">
              Keep me posted about future threads from {organiserName}.
            </span>
          </label>

          {error && (
            <p className="text-xs text-red-700 border border-red-200 bg-red-50 rounded-md px-2.5 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={state === 'submitting'}
            className="w-full h-9 rounded-md bg-ink text-ink-inverse text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {state === 'submitting'
              ? 'Enrolling…'
              : priceCents
                ? `Enrol — ${fmtPrice(priceCents, priceCurrency)}`
                : 'Enrol for free'}
          </button>
          <p className="text-[11px] text-ink-muted leading-relaxed">
            We&apos;ll email you about this thread (that&apos;s required to
            take part). Nothing else without your say-so.
          </p>
        </form>
      )}
    </aside>
  );
}

function RegistrationFieldInput({ field }: { field: RegistrationField }) {
  const name = `rf_${field.key}`;
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-start gap-2">
        <input type="checkbox" name={name} className="mt-0.5" />
        <span className="text-xs text-ink-subtle leading-relaxed">
          {field.label}
          {field.required && <span className="text-red-600"> *</span>}
        </span>
      </label>
    );
  }
  return (
    <label className="block">
      <span className="text-xs text-ink-subtle">
        {field.label}
        {field.required && <span className="text-red-600"> *</span>}
      </span>
      {field.type === 'long' ? (
        <textarea name={name} rows={3} className={INPUT} />
      ) : field.type === 'select' ? (
        <select name={name} className={INPUT} defaultValue="">
          <option value="" disabled>
            Choose…
          </option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input name={name} className={INPUT} />
      )}
    </label>
  );
}
