'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import type { PublicTicket, RegistrationField } from '@/lib/thread-types';
import { t, DEFAULT_LOCALE, type Locale } from '@/lib/i18n';
import { POLICIES, policiesVersion } from '@/lib/policies';

function fmtPrice(cents: number | null, currency: string | null): string {
  if (!cents) return '';
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
  tickets = [],
  registrationFields,
  enrolmentOpen,
  locale = DEFAULT_LOCALE,
  sharesParticipants = false,
}: {
  organiserSlug: string;
  organiserName: string;
  threadSlug: string;
  priceCents: number | null;
  priceCurrency: string | null;
  /** Multiple prices → radio-card chooser (never a dropdown). */
  tickets?: PublicTicket[];
  registrationFields: RegistrationField[];
  enrolmentOpen: boolean;
  locale?: Locale;
  /** Thread shares participants — offer the cohort-directory opt-in. */
  sharesParticipants?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  // Default to the first available ticket (organiser's position order).
  const [ticketId, setTicketId] = useState<string | null>(
    () => tickets.find((tk) => !tk.sold_out)?.id ?? null,
  );
  const selectedTicket = tickets.find((tk) => tk.id === ticketId) ?? null;
  // The price the button and header show: the chosen ticket's when tickets
  // exist, else the thread-level price.
  const activePriceCents = tickets.length ? selectedTicket?.price_cents ?? null : priceCents;
  const activeCurrency = tickets.length
    ? selectedTicket?.price_currency ?? 'EUR'
    : priceCurrency;
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
    if (!name || !email) return setError(t(locale, 'name_email_required'));
    if (fd.get('policy_accepted') !== 'on') {
      return setError(t(locale, 'policy_required', { policy: t(locale, 'policy_privacy') }));
    }

    const answers: Record<string, unknown> = {};
    for (const f of registrationFields) {
      const v = f.type === 'checkbox' ? fd.get(`rf_${f.key}`) === 'on' : String(fd.get(`rf_${f.key}`) ?? '').trim();
      if (f.required && (v === '' || v === false)) {
        return setError(t(locale, 'fill_in_field', { field: f.label }));
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
          ...(ticketId ? { ticket_id: ticketId } : {}),
          answers,
          marketing_opt_in: fd.get('marketing_opt_in') === 'on',
          cohort_opt_in: fd.get('cohort_opt_in') === 'on',
          policy_accepted: true,
          policy_version: policiesVersion(),
          request_id: requestId,
        }),
      });
      setState('done');
    } catch (err) {
      setState('idle');
      const body = err instanceof PublicApiError ? (err.body as { error?: unknown }) : null;
      setError(
        typeof body?.error === 'string' ? body.error : t(locale, 'something_wrong'),
      );
    }
  }

  return (
    <aside className="rounded-xl border border-line bg-surface-raised p-5 md:sticky md:top-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">{t(locale, 'enrol')}</h2>
        <span className="text-sm text-ink-subtle">
          {activePriceCents ? fmtPrice(activePriceCents, activeCurrency) : t(locale, 'free')}
        </span>
      </div>

      {state === 'done' ? (
        <div className="mt-4 flex items-start gap-2.5 text-sm text-ink-subtle">
          <CheckCircle2 size={18} strokeWidth={1.75} className="text-emerald-600 shrink-0 mt-0.5" />
          <p>
{t(locale, 'enrolled_success')}
          </p>
        </div>
      ) : !enrolmentOpen ? (
        <p className="mt-4 text-sm text-ink-subtle">
{t(locale, 'enrolment_closed')}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 space-y-3.5">
          {tickets.length > 1 && (
            <fieldset>
              <legend className="text-xs text-ink-subtle">{t(locale, 'ticket')}</legend>
              <div className="mt-1.5 space-y-2">
                {tickets.map((tk) => (
                  <label
                    key={tk.id}
                    className={`flex items-start gap-2.5 rounded-lg border p-3 transition-colors ${
                      tk.sold_out
                        ? 'border-line opacity-50 cursor-not-allowed'
                        : ticketId === tk.id
                          ? 'border-ink bg-surface-sunken cursor-pointer'
                          : 'border-line bg-surface hover:bg-surface-sunken cursor-pointer'
                    }`}
                  >
                    <input
                      type="radio"
                      name="ticket"
                      className="mt-0.5"
                      disabled={tk.sold_out}
                      checked={ticketId === tk.id}
                      onChange={() => setTicketId(tk.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium">{tk.name}</span>
                        <span className="text-sm text-ink-subtle shrink-0">
                          {tk.sold_out
                            ? t(locale, 'sold_out')
                            : tk.price_cents
                              ? fmtPrice(tk.price_cents, tk.price_currency)
                              : t(locale, 'free')}
                        </span>
                      </span>
                      {tk.description && (
                        <span className="mt-0.5 block text-xs text-ink-subtle leading-relaxed">
                          {tk.description}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <label className="block">
            <span className="text-xs text-ink-subtle">{t(locale, 'name')}</span>
            <input name="name" required className={INPUT} autoComplete="name" />
          </label>
          <label className="block">
            <span className="text-xs text-ink-subtle">{t(locale, 'email')}</span>
            <input name="email" type="email" required className={INPUT} autoComplete="email" />
          </label>

          {registrationFields.map((f) => (
            <RegistrationFieldInput key={f.key} field={f} />
          ))}

          {POLICIES.filter((pol) => pol.required).map((pol) => {
            // Split the sentence around the {policy} placeholder so the
            // policy name renders as a link in every language.
            const [before = '', after = ''] = t(locale, 'policy_agree', {
              policy: '|||',
            }).split('|||');
            return (
              <label key={pol.key} className="flex items-start gap-2 pt-1">
                <input type="checkbox" name="policy_accepted" required className="mt-0.5" />
                <span className="text-xs text-ink-subtle leading-relaxed">
                  {before}
                  <a
                    href={pol.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-ink"
                  >
                    {t(locale, pol.labelKey)}
                  </a>
                  {after}
                  <span className="text-red-600"> *</span>
                </span>
              </label>
            );
          })}

          {sharesParticipants && (
            <label className="flex items-start gap-2 pt-1">
              <input type="checkbox" name="cohort_opt_in" className="mt-0.5" />
              <span className="text-xs text-ink-subtle leading-relaxed">
                {t(locale, 'show_my_name')}
              </span>
            </label>
          )}

          <label className="flex items-start gap-2 pt-1">
            <input type="checkbox" name="marketing_opt_in" className="mt-0.5" />
            <span className="text-xs text-ink-subtle leading-relaxed">
{t(locale, 'keep_me_posted', { organiser: organiserName })}
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
              ? t(locale, 'enrolling')
              : activePriceCents
                ? t(locale, 'enrol_paid', { price: fmtPrice(activePriceCents, activeCurrency) })
                : t(locale, 'enrol_free')}
          </button>
          <p className="text-[11px] text-ink-muted leading-relaxed">
{t(locale, 'email_consent_note')}
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
            {'Choose…'}
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
