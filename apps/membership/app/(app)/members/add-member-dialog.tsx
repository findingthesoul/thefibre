'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchSelect } from '@thefibre/shared/ui/search-select';
import { BillingChoice } from '@thefibre/shared/ui/billing-choice';
import { COUNTRIES } from '@thefibre/shared/countries';
import { Dialog } from '@/components/ui/dialog';
import { DateField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';
import { createMember, createPerson, savePersonBilling, searchPersons } from './actions';
import { dateToIso } from './member-dialog';
import { personName, type MemberPerson, type Tier } from './types';

const INPUT =
  'w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(cents / 100);
}

export function AddMemberDialog({ tiers, onClose }: { tiers: Tier[]; onClose: () => void }) {
  const router = useRouter();
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

  const tier = tiers.find((t) => t.id === tierId) ?? null;
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
    const t = setTimeout(() => {
      searchPersons(query.trim()).then((r) => setResults(r.data?.items ?? []));
    }, 250);
    return () => clearTimeout(t);
  }, [query, person]);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!person && !newContact) {
      setError('Pick a person, or create a new contact.');
      return;
    }
    if (!tierId) {
      setError('Pick a tier.');
      return;
    }
    setBusy(true);
    setError(null);

    let personId = person?.id ?? null;
    if (!personId && newContact) {
      const name = newName.trim();
      if (!name || !newEmail.trim()) {
        setError('A new contact needs a name and an email address.');
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
        setError(created.error ?? 'could not create the contact');
        setBusy(false);
        return;
      }
      personId = created.data.id;
    }

    if (vat.trim() && personId) {
      const b = await savePersonBilling(personId, { tax_id: vat.trim() });
      if (b.error) {
        setError(`Could not save the VAT number: ${b.error}`);
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
      setError(`Member added, but: ${res.data.invoice_error}`);
      setBusy(false);
      return;
    }
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add member"
      description="Manual add — invoiced by email, or comped. Paid card joins come through the join page."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="add-member-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="add-member-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Person</label>
          {person ? (
            <div className="flex items-center justify-between rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm">
              <div>
                <span className="text-ink">{personName(person)}</span>
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
                Change
              </button>
            </div>
          ) : newContact ? (
            <div className="space-y-2 rounded-md border border-line bg-surface-sunken p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-ink-muted">New contact</span>
                <button
                  type="button"
                  className="text-xs text-ink-subtle hover:text-ink underline"
                  onClick={() => setNewContact(false)}
                >
                  Search instead
                </button>
              </div>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full name"
                className={INPUT}
              />
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Email address"
                className={INPUT}
              />
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Phone (optional)"
                className={INPUT}
              />
              <input
                value={newStreet}
                onChange={(e) => setNewStreet(e.target.value)}
                placeholder="Street and number"
                className={INPUT}
              />
              <div className="grid grid-cols-[1fr_2fr] gap-2">
                <input
                  value={newPostal}
                  onChange={(e) => setNewPostal(e.target.value)}
                  placeholder="Postal code"
                  className={INPUT}
                />
                <input
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  placeholder="City"
                  className={INPUT}
                />
              </div>
              <p className="text-xs text-ink-muted">
                Creates the contact in The Fibre, then adds the membership.
              </p>
            </div>
          ) : (
            <>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contacts by name or email…"
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
                        <span className="text-ink">{personName(p)}</span>
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
                  ＋ Create “{query.trim()}” as a new contact
                </button>
              )}
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Country</label>
            <SearchSelect
              value={country}
              onChange={setCountry}
              options={COUNTRY_OPTIONS}
              placeholder="Pick a country…"
              searchPlaceholder="Search countries…"
            />
            <p className="mt-1 text-xs text-ink-muted">Pricing rules use this.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">VAT number</label>
            <input
              value={vat}
              onChange={(e) => setVat(e.target.value)}
              placeholder="If applicable"
              className={INPUT}
            />
            <p className="mt-1 text-xs text-ink-muted">Shown on their invoices.</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tier</label>
          <select value={tierId} onChange={(e) => setTierId(e.target.value)} className={INPUT}>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <BillingChoice
          value={billing}
          onChange={setBilling}
          invoiceDisabled={!priced}
          invoiceDescription={
            priced
              ? 'Creates a pending invoice and emails it — pay by transfer or payment link.'
              : 'This tier has no price — only comped is possible.'
          }
          compedDescription="Free — no invoice."
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
                Yearly{tier?.price_cents_year ? ` · ${money(tier.price_cents_year, tier.currency)}` : ''}
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
                Monthly{tier?.price_cents_month ? ` · ${money(tier.price_cents_month, tier.currency)}` : ''}
              </label>
            )}
            {baseCents != null && baseCents > 0 && country && (
              <span className="text-xs text-ink-muted">Pricing rules may adjust this.</span>
            )}
          </div>
        </BillingChoice>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={invite}
            onChange={(e) => setInvite(e.target.checked)}
          />
          <span>
            Send an invitation email
            <span className="block text-xs text-ink-muted">
              Welcomes them and links their member page (membership, invoices, payment details).
            </span>
          </span>
        </label>
        <DateField
          label="Renews on"
          name="renews_at"
          defaultValue={renewsAt || null}
          onValueChange={setRenewsAt}
          hint="Optional — the scheduler moves overdue manual members to grace, then lapsed."
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
