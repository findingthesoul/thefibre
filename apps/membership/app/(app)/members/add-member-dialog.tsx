'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchSelect } from '@thefibre/shared/ui/search-select';
import { BillingChoice } from '@thefibre/shared/ui/billing-choice';
import { COUNTRIES } from '@thefibre/shared/countries';
import { Dialog } from '@/components/ui/dialog';
import { DateField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { createMember, createPerson, savePersonBilling, searchOrganisations, searchPersons } from './actions';
import { dateToIso } from './member-dialog';
import { personName, type MemberPerson, type Tier } from './types';

type OrgResult = { id: string; name: string | null; domain?: string | null };

const INPUT =
  'w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

function money(cents: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale], { style: 'currency', currency }).format(
    cents / 100,
  );
}

export function AddMemberDialog({
  tiers,
  locale,
  onClose,
}: {
  tiers: Tier[];
  locale: Locale;
  onClose: () => void;
}) {
  const router = useRouter();
  // Who holds the membership: a person (default) or an ORGANISATION whose
  // people occupy seats under it (§3.5 v1 — invoice/comped only).
  const [kind, setKind] = useState<'person' | 'organisation'>('person');
  const [orgQuery, setOrgQuery] = useState('');
  const [orgResults, setOrgResults] = useState<OrgResult[]>([]);
  const [org, setOrg] = useState<OrgResult | null>(null);
  const [seatAllowance, setSeatAllowance] = useState(5);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemberPerson[]>([]);
  const [person, setPerson] = useState<MemberPerson | null>(null);
  // New-contact mode: the typed name isn't a contact yet — create one
  // inline instead of dead-ending on "pick a person first".
  const [newContact, setNewContact] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newStreet, setNewStreet] = useState('');
  const [newPostal, setNewPostal] = useState('');
  const [newCity, setNewCity] = useState('');
  // Country doubles as the pricing-rules input, so it applies to existing
  // contacts too, not only new ones.
  const [country, setCountry] = useState('');
  const [vat, setVat] = useState('');
  const [tierId, setTierId] = useState(tiers[0]?.id ?? '');
  const [billing, setBilling] = useState<'invoice' | 'comped'>('invoice');
  const [interval, setInterval] = useState<'year' | 'month'>('year');
  const [invite, setInvite] = useState(true);
  const [renewsAt, setRenewsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tier = tiers.find((x) => x.id === tierId) ?? null;
  const hasYear = (tier?.price_cents_year ?? 0) > 0;
  const hasMonth = (tier?.price_cents_month ?? 0) > 0;
  const priced = hasYear || hasMonth;
  const effectiveInterval: 'year' | 'month' =
    interval === 'year' ? (hasYear ? 'year' : 'month') : hasMonth ? 'month' : 'year';
  const baseCents =
    effectiveInterval === 'year' ? tier?.price_cents_year : tier?.price_cents_month;

  // Debounced search-as-you-type; results come via a server action because
  // the API session lives server-side.
  useEffect(() => {
    if (person || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchPersons(query.trim()).then((r) => setResults(r.data?.items ?? []));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, person]);

  // Organisation search — the same pattern against /organisations.
  useEffect(() => {
    if (org || orgQuery.trim().length < 2) {
      setOrgResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchOrganisations(orgQuery.trim()).then((r) => setOrgResults(r.data?.items ?? []));
    }, 250);
    return () => clearTimeout(timer);
  }, [orgQuery, org]);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!tierId) {
      setError(t(locale, 'pick_a_tier'));
      return;
    }

    // Organisation branch: tier + seat allowance; invoiced to the org (or
    // comped). Seats are added from the member dialog afterwards.
    if (kind === 'organisation') {
      if (!org) {
        setError(t(locale, 'pick_an_organisation'));
        return;
      }
      setBusy(true);
      setError(null);
      const res = await createMember({
        organisation_id: org.id,
        seat_allowance: seatAllowance,
        tier_id: tierId,
        renews_at: renewsAt ? dateToIso(renewsAt) : null,
        billing: priced ? billing : 'comped',
        interval: effectiveInterval,
      });
      if (res.error) {
        setError(res.error);
        setBusy(false);
        return;
      }
      router.refresh();
      if (res.data?.invoice_error) {
        setError(t(locale, 'membership_added_but', { error: res.data.invoice_error }));
        setBusy(false);
        return;
      }
      onClose();
      return;
    }

    if (!person && !newContact) {
      setError(t(locale, 'pick_person_or_new'));
      return;
    }
    setBusy(true);
    setError(null);

    let personId = person?.id ?? null;
    if (!personId && newContact) {
      const name = newName.trim();
      if (!name || !newEmail.trim()) {
        setError(t(locale, 'new_contact_needs'));
        setBusy(false);
        return;
      }
      const parts = name.split(/\s+/);
      const created = await createPerson({
        first_name: parts[0] ?? name,
        last_name: parts.slice(1).join(' ') || '',
        email: newEmail.trim(),
        ...(newPhone.trim() ? { phone: newPhone.trim() } : {}),
        ...(newStreet.trim() ? { street: newStreet.trim() } : {}),
        ...(newPostal.trim() ? { postal_code: newPostal.trim() } : {}),
        ...(newCity.trim() ? { city: newCity.trim() } : {}),
        ...(country ? { country } : {}),
      });
      if (created.error || !created.data) {
        setError(created.error ?? t(locale, 'could_not_create_contact'));
        setBusy(false);
        return;
      }
      personId = created.data.id;
    }

    if (vat.trim() && personId) {
      const b = await savePersonBilling(personId, { tax_id: vat.trim() });
      if (b.error) {
        setError(t(locale, 'vat_save_failed', { error: b.error }));
        setBusy(false);
        return;
      }
    }

    const res = await createMember({
      person_id: personId!,
      tier_id: tierId,
      renews_at: renewsAt ? dateToIso(renewsAt) : null,
      country: country || null,
      billing: priced ? billing : 'comped',
      interval: effectiveInterval,
      invite,
    });
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    router.refresh();
    if (res.data?.invoice_error) {
      // The member exists — keep the dialog open so the warning is read.
      setError(t(locale, 'member_added_but', { error: res.data.invoice_error }));
      setBusy(false);
      return;
    }
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(locale, 'add_member')}
      description={t(locale, 'add_member_desc')}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="add-member-form" disabled={busy}>
            {busy ? t(locale, 'saving') : t(locale, 'save')}
          </Button>
        </>
      }
    >
      <form id="add-member-form" onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-1.5">
          {(['person', 'organisation'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                kind === k ? 'bg-ink text-ink-inverse' : 'bg-surface-sunken text-ink-subtle hover:text-ink'
              }`}
            >
              {k === 'person' ? t(locale, 'kind_person') : t(locale, 'kind_organisation')}
            </button>
          ))}
        </div>

        {kind === 'organisation' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t(locale, 'kind_organisation')}
              </label>
              {org ? (
                <div className="flex items-center justify-between rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm">
                  <div>
                    <span className="text-ink">{org.name ?? t(locale, 'unnamed_organisation')}</span>
                    {org.domain && <span className="ml-2 text-ink-muted">{org.domain}</span>}
                  </div>
                  <button
                    type="button"
                    className="text-xs text-ink-subtle hover:text-ink underline"
                    onClick={() => {
                      setOrg(null);
                      setOrgQuery('');
                    }}
                  >
                    {t(locale, 'change')}
                  </button>
                </div>
              ) : (
                <>
                  <input
                    autoFocus
                    value={orgQuery}
                    onChange={(e) => setOrgQuery(e.target.value)}
                    placeholder={t(locale, 'search_orgs_ph')}
                    className={INPUT}
                  />
                  {orgResults.length > 0 && (
                    <ul className="mt-1 rounded-md border border-line bg-surface-raised divide-y divide-line/60 overflow-hidden">
                      {orgResults.map((o) => (
                        <li key={o.id}>
                          <button
                            type="button"
                            onClick={() => setOrg(o)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-surface-sunken"
                          >
                            <span className="text-ink">
                              {o.name ?? t(locale, 'unnamed_organisation')}
                            </span>
                            {o.domain && <span className="ml-2 text-ink-muted">{o.domain}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t(locale, 'seat_allowance')}</label>
              <input
                type="number"
                min={1}
                max={10000}
                value={seatAllowance}
                onChange={(e) => setSeatAllowance(Math.max(1, Number(e.target.value) || 1))}
                className={INPUT}
              />
              <p className="mt-1 text-xs text-ink-muted">{t(locale, 'seat_allowance_hint')}</p>
            </div>
          </>
        )}

        {kind === 'person' && (
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'kind_person')}</label>
          {person ? (
            <div className="flex items-center justify-between rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm">
              <div>
                <span className="text-ink">{personName(person, t(locale, 'unknown_person'))}</span>
                {person.email && <span className="ml-2 text-ink-muted">{person.email}</span>}
              </div>
              <button
                type="button"
                className="text-xs text-ink-subtle hover:text-ink underline"
                onClick={() => {
                  setPerson(null);
                  setQuery('');
                }}
              >
                {t(locale, 'change')}
              </button>
            </div>
          ) : newContact ? (
            <div className="space-y-2 rounded-md border border-line bg-surface-sunken p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-ink-muted">
                  {t(locale, 'new_contact')}
                </span>
                <button
                  type="button"
                  className="text-xs text-ink-subtle hover:text-ink underline"
                  onClick={() => setNewContact(false)}
                >
                  {t(locale, 'search_instead')}
                </button>
              </div>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t(locale, 'full_name_ph')}
                className={INPUT}
              />
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={t(locale, 'email_address_ph')}
                className={INPUT}
              />
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder={t(locale, 'phone_optional_ph')}
                className={INPUT}
              />
              <input
                value={newStreet}
                onChange={(e) => setNewStreet(e.target.value)}
                placeholder={t(locale, 'street_ph')}
                className={INPUT}
              />
              <div className="grid grid-cols-[1fr_2fr] gap-2">
                <input
                  value={newPostal}
                  onChange={(e) => setNewPostal(e.target.value)}
                  placeholder={t(locale, 'postal_ph')}
                  className={INPUT}
                />
                <input
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  placeholder={t(locale, 'city_ph')}
                  className={INPUT}
                />
              </div>
              <p className="text-xs text-ink-muted">{t(locale, 'creates_contact_hint')}</p>
            </div>
          ) : (
            <>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t(locale, 'search_contacts_ph')}
                className={INPUT}
              />
              {results.length > 0 && (
                <ul className="mt-1 rounded-md border border-line bg-surface-raised divide-y divide-line/60 overflow-hidden">
                  {results.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setPerson(p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-sunken"
                      >
                        <span className="text-ink">
                          {personName(p, t(locale, 'unknown_person'))}
                        </span>
                        {p.email && <span className="ml-2 text-ink-muted">{p.email}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.trim().length >= 2 && (
                <button
                  type="button"
                  className="mt-1.5 w-full rounded-md border border-dashed border-line px-3 py-2 text-left text-sm text-ink-subtle hover:text-ink hover:bg-surface-sunken"
                  onClick={() => {
                    setNewContact(true);
                    setNewName(query.trim());
                  }}
                >
                  {t(locale, 'create_as_new_contact', { name: query.trim() })}
                </button>
              )}
            </>
          )}
        </div>
        )}
        {kind === 'person' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t(locale, 'country')}</label>
            <SearchSelect
              value={country}
              onChange={setCountry}
              options={COUNTRY_OPTIONS}
              placeholder={t(locale, 'pick_country_ph')}
              searchPlaceholder={t(locale, 'search_countries_ph')}
            />
            <p className="mt-1 text-xs text-ink-muted">{t(locale, 'pricing_rules_use_this')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t(locale, 'vat_number')}</label>
            <input
              value={vat}
              onChange={(e) => setVat(e.target.value)}
              placeholder={t(locale, 'if_applicable_ph')}
              className={INPUT}
            />
            <p className="mt-1 text-xs text-ink-muted">{t(locale, 'shown_on_their_invoices')}</p>
          </div>
        </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'tier')}</label>
          <select value={tierId} onChange={(e) => setTierId(e.target.value)} className={INPUT}>
            {tiers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        <BillingChoice
          value={billing}
          onChange={setBilling}
          invoiceDisabled={!priced}
          invoiceDescription={
            priced ? t(locale, 'billing_invoice_desc') : t(locale, 'billing_no_price_desc')
          }
          compedDescription={t(locale, 'billing_comped_desc')}
        >
          {/* flex-wrap: the dialog renders as a bottom sheet below `sm`
              (v0.45.0) — two interval labels + the hint don't fit one row
              at phone width. */}
          <div className="ml-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            {hasYear && (
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="interval"
                  checked={effectiveInterval === 'year'}
                  onChange={() => setInterval('year')}
                />
                {t(locale, 'yearly')}
                {tier?.price_cents_year
                  ? ` · ${money(tier.price_cents_year, tier.currency, locale)}`
                  : ''}
              </label>
            )}
            {hasMonth && (
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="interval"
                  checked={effectiveInterval === 'month'}
                  onChange={() => setInterval('month')}
                />
                {t(locale, 'monthly')}
                {tier?.price_cents_month
                  ? ` · ${money(tier.price_cents_month, tier.currency, locale)}`
                  : ''}
              </label>
            )}
            {baseCents != null && baseCents > 0 && country && (
              <span className="text-xs text-ink-muted">
                {t(locale, 'pricing_rules_may_adjust')}
              </span>
            )}
          </div>
        </BillingChoice>
        {kind === 'person' && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={invite}
            onChange={(e) => setInvite(e.target.checked)}
          />
          <span>
            {t(locale, 'send_invite')}
            <span className="block text-xs text-ink-muted">{t(locale, 'send_invite_hint')}</span>
          </span>
        </label>
        )}
        <DateField
          label={t(locale, 'renews_on')}
          name="renews_at"
          defaultValue={renewsAt || null}
          onValueChange={setRenewsAt}
          hint={t(locale, 'renews_hint')}
        />
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </Dialog>
  );
}
