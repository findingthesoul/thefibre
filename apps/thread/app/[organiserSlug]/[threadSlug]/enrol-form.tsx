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
  'te-input mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm focus:border-line-strong focus:outline-none placeholder:text-ink-muted';

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
  paymentMethods = ['stripe'],
  initialNotice = null,
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
  /** Accepted payment methods for paid threads (default: card only). */
  paymentMethods?: ('stripe' | 'invoice')[];
  /** From ?paid= on return from Stripe Checkout. */
  initialNotice?: 'success' | 'cancelled' | null;
}) {
  // 'already' = this email is enrolled for this thread — point at /my
  // instead of promising a confirmation email that won't be sent again.
  // 'pending' = waiting for organiser approval; 'invoice' = invoice follows;
  // 'redirecting' = on the way to Stripe Checkout.
  const [state, setState] = useState<
    'idle' | 'submitting' | 'done' | 'already' | 'pending' | 'invoice' | 'redirecting'
  >(initialNotice === 'success' ? 'done' : 'idle');
  const [payMethod, setPayMethod] = useState<'stripe' | 'invoice'>('stripe');
  const [error, setError] = useState<string | null>(null);
  // Whether this email already has a Fibre account → "sign in" vs "create".
  const [hasAccount, setHasAccount] = useState(false);
  // Default to the first available ticket (organiser's position order).
  const [ticketId, setTicketId] = useState<string | null>(
    () => tickets.find((tk) => !tk.sold_out)?.id ?? null,
  );
  // Discount code — validated server-side via /public/validate-coupon.
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ code: string; price_cents: number } | null>(null);
  const selectedTicket = tickets.find((tk) => tk.id === ticketId) ?? null;
  // The price the button and header show: the applied code's result wins,
  // else the chosen ticket's, else the thread-level price.
  const basePriceCents = tickets.length ? selectedTicket?.price_cents ?? null : priceCents;
  const activePriceCents = applied ? applied.price_cents : basePriceCents;
  const activeCurrency = tickets.length
    ? selectedTicket?.price_currency ?? 'EUR'
    : priceCurrency;

  function pickTicket(id: string) {
    setTicketId(id);
    // A code can be scoped to one ticket — revalidate against the new choice.
    setApplied(null);
    setCouponError(null);
  }

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponError(null);
    try {
      const r = await publicFetch<
        { valid: true; code: string; price_cents: number } | { valid: false; reason: string }
      >('/api/v1/thread/public/validate-coupon', {
        method: 'POST',
        body: JSON.stringify({
          organiser_slug: organiserSlug,
          thread_slug: threadSlug,
          code,
          ...(ticketId ? { ticket_id: ticketId } : {}),
        }),
      });
      if (r.valid) setApplied({ code: r.code, price_cents: r.price_cents });
      else {
        setApplied(null);
        setCouponError(r.reason);
      }
    } catch {
      setCouponError(t(locale, 'something_wrong'));
    }
  }
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
      const res = await publicFetch<{
        already_enrolled?: boolean;
        has_account?: boolean;
        pending_approval?: boolean;
        invoice_pending?: boolean;
        payment_required?: boolean;
        checkout_url?: string | null;
      }>('/api/v1/thread/public/enrol', {
        method: 'POST',
        body: JSON.stringify({
          organiser_slug: organiserSlug,
          thread_slug: threadSlug,
          name,
          email,
          ...(ticketId ? { ticket_id: ticketId } : {}),
          ...(applied ? { coupon_code: applied.code } : {}),
          ...(activePriceCents ? { payment_method: payMethod } : {}),
          answers,
          marketing_opt_in: fd.get('marketing_opt_in') === 'on',
          cohort_opt_in: fd.get('cohort_opt_in') === 'on',
          policy_accepted: true,
          policy_version: policiesVersion(),
          request_id: requestId,
        }),
      });
      setHasAccount(res.has_account === true);
      if (res.payment_required && res.checkout_url) {
        setState('redirecting');
        // Stripe Checkout refuses iframes — inside an embed, escape to the
        // top window; the success/cancel URLs return to the public page.
        try {
          if (window.self !== window.top && window.top) {
            window.top.location.href = res.checkout_url;
          } else {
            window.location.href = res.checkout_url;
          }
        } catch {
          window.location.href = res.checkout_url;
        }
        return;
      }
      setState(
        res.already_enrolled
          ? 'already'
          : res.pending_approval
            ? 'pending'
            : res.invoice_pending
              ? 'invoice'
              : 'done',
      );
    } catch (err) {
      setState('idle');
      const body = err instanceof PublicApiError ? (err.body as { error?: unknown }) : null;
      setError(
        typeof body?.error === 'string' ? body.error : t(locale, 'something_wrong'),
      );
    }
  }

  return (
    <aside className="te-enrol te-card rounded-xl border border-line bg-surface-raised p-5 md:sticky md:top-8">
      <div className="flex items-baseline justify-between">
        <h2 className="te-label text-sm font-medium">{t(locale, 'enrol')}</h2>
        <span className="text-sm text-ink-subtle">
          {/* Applied code → old price struck through, new price next to it. */}
          {applied && (basePriceCents ?? 0) !== applied.price_cents && (
            <s className="mr-1.5 text-ink-muted">
              {fmtPrice(basePriceCents ?? 0, activeCurrency)}
            </s>
          )}
          <span className={applied ? 'font-medium text-emerald-700' : undefined}>
            {activePriceCents ? fmtPrice(activePriceCents, activeCurrency) : t(locale, 'free')}
          </span>
        </span>
      </div>

      {state === 'redirecting' ? (
        <p className="mt-4 text-sm text-ink-subtle">{t(locale, 'redirecting_payment')}</p>
      ) : state === 'done' || state === 'already' || state === 'pending' || state === 'invoice' ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-2.5 text-sm text-ink-subtle">
            <CheckCircle2
              size={18}
              strokeWidth={1.75}
              className="text-emerald-600 shrink-0 mt-0.5"
            />
            <p>
              {t(
                locale,
                state === 'already'
                  ? 'already_enrolled'
                  : state === 'pending'
                    ? 'enrolment_pending_msg'
                    : state === 'invoice'
                      ? 'invoice_pending_msg'
                      : initialNotice === 'success'
                        ? 'payment_success_msg'
                        : 'enrolled_success',
              )}
            </p>
          </div>
          {/* Existing Fibre account → sign in; none → create it (first
              sign-in with this email creates it — no separate signup).
              New tab: inside a website embed the portal must not open in
              the iframe. */}
          <a
            href="/my"
            target="_blank"
            rel="noreferrer"
            className="block w-full h-9 leading-9 text-center rounded-md bg-ink text-ink-inverse text-sm font-medium hover:opacity-90"
          >
            {t(locale, hasAccount ? 'sign_in_personal_page' : 'create_account')}
          </a>
          <p className="text-[11px] text-ink-muted leading-relaxed">
            {t(locale, 'account_note')}
          </p>
        </div>
      ) : !enrolmentOpen ? (
        <p className="mt-4 text-sm text-ink-subtle">
{t(locale, 'enrolment_closed')}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 space-y-3.5">
          {initialNotice === 'cancelled' && (
            <p className="text-xs text-amber-800 border border-amber-200 bg-amber-50 rounded-md px-2.5 py-2">
              {t(locale, 'payment_cancelled_msg')}
            </p>
          )}
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
                      onChange={() => pickTicket(tk.id)}
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

          {/* Discount code — only meaningful when something costs money. */}
          {(basePriceCents ?? 0) > 0 && (
            <div>
              {!couponOpen && !applied ? (
                <button
                  type="button"
                  onClick={() => setCouponOpen(true)}
                  className="text-xs text-ink-subtle underline underline-offset-2 hover:text-ink"
                >
                  {t(locale, 'discount_code')}?
                </button>
              ) : (
                <div>
                  <span className="text-xs text-ink-subtle">{t(locale, 'discount_code')}</span>
                  <div className="mt-1 flex gap-2">
                    <input
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase());
                        setApplied(null);
                        setCouponError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void applyCoupon();
                        }
                      }}
                      className={`${INPUT} mt-0 font-mono uppercase`}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={() => void applyCoupon()}
                      className="shrink-0 h-9 px-3 rounded-md border border-line text-sm text-ink-subtle hover:text-ink hover:bg-surface-sunken"
                    >
                      {t(locale, 'apply')}
                    </button>
                  </div>
                  {applied && (
                    <p className="mt-1.5 text-xs text-emerald-700">
                      {t(locale, 'code_applied', { code: applied.code })}
                    </p>
                  )}
                  {couponError && <p className="mt-1.5 text-xs text-red-700">{couponError}</p>}
                </div>
              )}
            </div>
          )}

          {(activePriceCents ?? 0) > 0 && paymentMethods.includes('invoice') && (
            <div>
              <span className="text-xs text-ink-subtle">{t(locale, 'payment_method')}</span>
              <div className="mt-1 grid grid-cols-2 rounded-md border border-line overflow-hidden h-[34px] text-sm">
                {(['stripe', 'invoice'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMethod(m)}
                    className={
                      payMethod === m
                        ? 'bg-surface-sunken text-ink font-medium'
                        : 'bg-surface text-ink-subtle hover:text-ink hover:bg-surface-sunken'
                    }
                  >
                    {t(locale, m === 'stripe' ? 'pay_online' : 'pay_by_invoice')}
                  </button>
                ))}
              </div>
            </div>
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
            className="te-button w-full h-9 rounded-md bg-ink text-ink-inverse text-sm font-medium hover:opacity-90 disabled:opacity-50"
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
