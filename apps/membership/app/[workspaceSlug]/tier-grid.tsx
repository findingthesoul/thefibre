'use client';

// Tier cards + inline join form. Yearly price is the headline; a monthly
// price (when set) is offered as an interval choice inside the form.

import { useEffect, useMemo, useState } from 'react';
import { redirectToCheckout } from '@thefibre/shared/checkout-redirect';
import { applyPct, evaluatePriceLogic, type PriceLogic } from '@thefibre/shared/price-logic';
import { VatBreakdown, VatInclNote } from '@thefibre/shared/ui/vat-price';
import { Check } from 'lucide-react';
import { COUNTRIES, COUNTRY_OPTIONS } from '@thefibre/shared/countries';
import { payLineFor } from '@/lib/pay-line';
import { DiscountCodeField } from '@thefibre/shared/ui/discount-code-field';
import { SearchSelect } from '@thefibre/shared/ui/search-select';
import {
  InvoiceBillingFields,
  readBillingFields,
} from '@thefibre/shared/ui/payment-methods';
import { publicFetch, PublicApiError, type PublicProduct, type PublicTier } from '@/lib/public-api';
import { money } from '@/lib/money';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

// Pricing logic (§3.9): the catalog carries the workspace's price_logic;
// this PREVIEW mirrors the server's evaluator — the server recomputes the
// authoritative amount at checkout, so a tampered preview changes nothing.
export // WHICH PERCENTAGE, AND WHAT IT DOES TO A PRICE — from the same module the
// CHARGE uses (@thefibre/shared/price-logic). This panel had its own copy,
// and the two disagreed on anything that was not a whole number between 1 and
// 100: a 12.5% rule showed 12.5 here and charged 13, and a 0% rule showed
// free and charged 1%. A price shown and a price taken may not come from two
// pieces of code.
const previewPct = (logic: PriceLogic | null, country: string, interval: 'year' | 'month') =>
  evaluatePriceLogic(logic, { country, interval }).pct;
const adjust = applyPct;

// The same list the invoicing picker two fields below uses, sorted by
// name — they were two copies of one map on one page.

const INPUT =
  'w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none';

type JoinState = 'idle' | 'submitting' | 'redirecting' | 'already';

export function TierGrid({
  workspaceSlug,
  tiers,
  products,
  initialTierId,
  priceLogic = null,
  vatRegistered = false,
  vatHomeRatePct = null,
  locale = 'en',
  workspaceName,
  membersAreaUrl,
  terms,
}: {
  workspaceSlug: string;
  tiers: PublicTier[];
  products: PublicProduct[];
  initialTierId: string | null;
  priceLogic?: PriceLogic | null;
  /** Prices are excl. VAT and this community adds it (2026-10-15): the page
   *  asks for the country and shows excl. / VAT / total. */
  vatRegistered?: boolean;
  /** The seller's home VAT rate: "incl. VAT" before a country is chosen. */
  vatHomeRatePct?: number | null;
  /** Resolved server-side by the page (Thread pattern) — never from cookies. */
  locale?: Locale;
  /** The community's own name, for the consent sentence when a tier confers
   *  no category: "Show me in the members area of Soul". */
  workspaceName: string;
  /** This community's members area on my.thread, resolved server-side. */
  membersAreaUrl: string;
  /** Which terms a joiner must accept: this community's own, or The Thread's
   *  standard ones. The API decides and the catalogue says so — the form only
   *  shows what it was told. */
  terms: { url: string; standard: boolean };
}) {
  const [openTierId, setOpenTierId] = useState<string | null>(
    initialTierId && tiers.some((t) => t.id === initialTierId) ? initialTierId : null,
  );
  // Self-declared country (§3.9 D1) — one choice for the whole page.
  const [country, setCountry] = useState('');
  const hasCountryRules = Boolean(
    priceLogic?.rules?.some((r) => r.when.attr === 'country'),
  );
  const productNames = useMemo(
    () => new Map(products.map((p) => [p.id, p.name])),
    [products],
  );
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const cols =
    tiers.length === 1
      ? 'sm:grid-cols-1 max-w-md mx-auto'
      : tiers.length === 2
        ? 'sm:grid-cols-2 max-w-2xl mx-auto'
        : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <>
      {(hasCountryRules || vatRegistered) && (
        // Left, to match the prose above and the control below — the picker
        // itself has always been left-aligned, so a centred label over it was
        // the odd one out the moment the intro stopped being centred. The
        // block stays centred on the page.
        <div className="mt-8 mx-auto max-w-md text-left">
          <label className="block text-sm text-ink-subtle mb-1.5">
            {t(locale, hasCountryRules ? 'country_question' : 'country_question_vat')}
          </label>
          <SearchSelect
            value={country}
            onChange={setCountry}
            options={COUNTRY_OPTIONS}
            placeholder={t(locale, 'country_placeholder')}
            className="w-full text-left"
          />
        </div>
      )}
      <div className={`mt-10 grid grid-cols-1 gap-6 ${cols}`}>
        {tiers.map((tier) => (
          <TierCard
            key={tier.id}
            workspaceSlug={workspaceSlug}
            tier={tier}
            includedProducts={tier.product_ids
              .map((id) => productNames.get(id))
              .filter((n): n is string => Boolean(n))}
            optionalProducts={(tier.optional_product_ids ?? [])
              .map((id) => productById.get(id))
              .filter((p): p is PublicProduct => Boolean(p))}
            open={openTierId === tier.id}
            onOpen={() => setOpenTierId(tier.id)}
            onClose={() => setOpenTierId(null)}
            country={country}
            priceLogic={priceLogic}
            vatRegistered={vatRegistered}
            vatHomeRatePct={vatHomeRatePct}
            workspaceName={workspaceName}
            membersAreaUrl={membersAreaUrl}
            terms={terms}
            locale={locale}
          />
        ))}
      </div>
    </>
  );
}

function TierCard({
  workspaceSlug,
  tier,
  includedProducts,
  optionalProducts,
  open,
  onOpen,
  onClose,
  country,
  priceLogic,
  vatRegistered = false,
  vatHomeRatePct = null,
  locale,
  workspaceName,
  membersAreaUrl,
  terms,
}: {
  workspaceSlug: string;
  tier: PublicTier;
  includedProducts: string[];
  /** Tick-box add-ons: a priced one raises the first payment, €0 = free. */
  optionalProducts: PublicProduct[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  country: string;
  priceLogic: PriceLogic | null;
  vatRegistered?: boolean;
  /** The seller's home VAT rate: "incl. VAT" before a country is chosen. */
  vatHomeRatePct?: number | null;
  locale: Locale;
  /** The community's own name, for the consent sentence when a tier confers
   *  no category: "Show me in the members area of Soul". */
  workspaceName: string;
  /** This community's members area on my.thread, resolved server-side. */
  membersAreaUrl: string;
  /** Which terms this joiner must accept. */
  terms: { url: string; standard: boolean };
}) {
  // DIRECTORY CONSENT, default off and per card, because the form is per card.
  const [listed, setListed] = useState(false);
  // THE TERMS, default off and never remembered: an agreement is given each
  // time it is asked for.
  const [termsAccepted, setTermsAccepted] = useState(false);
  // VAT ON TOP (2026-10-15). The rate comes from the API — THE rule the
  // checkout charges by — for the page's country and, for a business, the
  // VAT number typed below (reverse charge abroad). Shown as excl. / VAT /
  // total right above the button.
  const [vatNo, setVatNo] = useState('');
  const [vatQuote, setVatQuote] = useState<{ rate_pct: number; label: string | null; reverse_charge: boolean } | null>(null);
  useEffect(() => {
    if (!vatRegistered || !country) {
      setVatQuote(null);
      return;
    }
    const timer = setTimeout(() => {
      const q = new URLSearchParams({ workspace_slug: workspaceSlug, country, ...(vatNo.trim() ? { vat_id: vatNo.trim() } : {}) });
      publicFetch<{ rate_pct: number; label: string | null; reverse_charge: boolean }>(`/api/v1/membership/public/vat-quote?${q}`)
        .then(setVatQuote)
        .catch(() => setVatQuote(null));
    }, 400);
    return () => clearTimeout(timer);
  }, [vatRegistered, country, vatNo, workspaceSlug]);

  /** "A", "A and B", "A, B and C" — the categories a tier confers, said the
   *  way a person would say them. */
  function joinNames(names: string[]): string {
    if (names.length <= 1) return names[0] ?? '';
    const and = t(locale, 'list_and');
    return `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;
  }

  const currency = tier.currency ?? 'EUR';
  // The rate the "incl. VAT" notes use: the quote once a country is known
  // (0 for a reverse charge or outside the EU — then no note), else home.
  const cardRatePct = vatQuote ? vatQuote.rate_pct : vatHomeRatePct;
  const hasYear = tier.price_cents_year != null && tier.price_cents_year > 0;
  const hasMonth = tier.price_cents_month != null && tier.price_cents_month > 0;
  // THE TIER'S OWN RULE WHERE IT HAS ONE, which is what the charge uses
  // (`priceLogicFor(ws, tier.id)` prefers a tier-specific rule over the
  // workspace one). The workspace rule stays as the fallback, and as what an
  // older API sends.
  const logicHere = tier.price_logic ?? priceLogic;
  const yearPct = previewPct(logicHere, country, 'year');
  const monthPct = previewPct(logicHere, country, 'month');
  const adjustedYear = hasYear ? adjust(tier.price_cents_year!, yearPct) : null;
  const adjustedMonth = hasMonth ? adjust(tier.price_cents_month!, monthPct) : null;
  const countryName = country ? (COUNTRIES.find((c) => c.code === country)?.name ?? country) : null;
  const isAdjusted = (hasYear && yearPct !== 100) || (hasMonth && monthPct !== 100);

  // Named to avoid shadowing window.setInterval.
  const [interval, setBillingInterval] = useState<'year' | 'month'>(hasYear ? 'year' : 'month');
  // THE DISCOUNT CODE. `applied` is what the SERVER said, never what was
  // typed: the price shown comes back from /public/validate-code, and the
  // join route validates the code again from scratch and ignores whatever
  // this form believed. A discount decided in a browser is a discount anybody
  // can decide.
  //
  // AND IT REMEMBERS WHAT IT WAS PRICED FOR. `/public/validate-code` is asked
  // for a specific interval and country, so its answer is only true for
  // those. Until 2026-10-14 the answer was kept while the tabs changed under
  // it: apply a 50% code on Year (€150), switch to Month, and the panel still
  // promised €150 while Checkout would charge €15. A promise broken by a tab.
  //
  // Staleness is COMPUTED rather than remembered — `appliedHere` below — so
  // there is no reset to forget. A reset would have to be wired to every
  // input that feeds the price, and the next one added would silently not be.
  const [applied, setApplied] = useState<{
    code: string;
    priceCents: number;
    interval: 'year' | 'month';
    country: string;
  } | null>(null);
  const [state, setState] = useState<JoinState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [chosenOptions, setChosenOptions] = useState<Set<string>>(new Set());
  function toggleOption(id: string) {
    setChosenOptions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  // THE EXTRAS THAT CAN ACTUALLY BE BOUGHT AT THIS INTERVAL — defined once,
  // and the same list the tick-boxes render from.
  //
  // A recurring add-on only rides a subscription of its own interval (Stripe
  // bills one interval per subscription); 'once' always fits. The RENDER
  // filtered on this and the total did not, so ticking the yearly Fellowship
  // (€2.000) and switching to Month hid the box while leaving it in the
  // total — and posted its id, which the server then refused with a 400
  // naming a product the person could no longer see. One list, so the offer
  // and the charge cannot disagree.
  const compatibleOptions = optionalProducts.filter(
    (p) => (p.price_interval ?? 'once') === 'once' || p.price_interval === interval,
  );
  const chosen = compatibleOptions.filter((p) => chosenOptions.has(p.id));
  /** Exactly what the join posts: the ids of the extras being charged for.
   *  Derived from `chosen`, never from the raw tick-box set, so an id that
   *  has become incompatible is simply not sent. */
  const chosenIds = chosen.map((p) => p.id);

  /** The code's answer, but only where it is still TRUE.
   *
   *  It was priced for one interval and one country. If either has changed
   *  since, the figure is about a different purchase, and showing it would
   *  promise a price that will not be charged. Treated as absent instead —
   *  the field below is keyed on the same pair, so it clears itself and the
   *  visitor can re-apply and see the real number. */
  const appliedHere =
    applied && applied.interval === interval && applied.country === country ? applied : null;
  // AND IT DOES NOT COME BACK ON ITS OWN. Year with a code → Month → Year
  // made `appliedHere` match again, so the discount reapplied while the
  // field, remounted by the key below, showed nothing. The price was right
  // and the screen could not explain it, which is its own kind of wrong on a
  // payment form: a reader cannot check a figure whose reason has
  // disappeared. Dropping the code when the pair changes means a visitor who
  // wants it back types it again and sees it applied — the same two states
  // the field has always had, and no third one where it is secretly in
  // force.
  useEffect(() => {
    setApplied(null);
  }, [interval, country]);
  const optionsExtraCents = chosen.reduce((sum, p) => sum + (p.price_cents ?? 0), 0);
  // WHAT COMES BACK EVERY PERIOD, and what does not. A one-time extra is paid
  // once and never again, so naming it in the renewal figure would promise a
  // charge that will not happen; leaving the recurring ones out would hide
  // one that will. The join bills them the same way: a recurring extra pays
  // its first period now and renews with the membership, a one-time extra is
  // collected now and is gone.
  const recurringExtraCents = chosen
    .filter((p) => (p.price_interval ?? 'once') === interval)
    .reduce((sum, p) => sum + (p.price_cents ?? 0), 0);

  // WHAT YOU PAY NOW, AND WHEN IT COMES AGAIN.
  //
  // The panel showed a price on a tab and a button saying "Continue to
  // payment", and never said the amount in a sentence or named a renewal
  // date. Under the launch-cohort rule it is worse than vague: a yearly join
  // takes the WHOLE year up front however late in the year somebody joins,
  // and renews on a fixed date — which was visible only on the Stripe
  // receipt, after paying.
  //
  // WHICH sentence is `payLineFor` in lib/pay-line.ts — pure, clock passed
  // in, and running the same `fixedFirstPeriod` the CHARGE runs, so what is
  // shown and what is taken cannot drift apart. Where that rule declines — a
  // date in the past, a monthly join, inside Stripe's 48-hour floor — this
  // says the ordinary thing, because the ordinary thing is what will happen.
  const listCents =
    (interval === 'year' ? adjustedYear : adjustedMonth) === null
      ? null
      : (interval === 'year' ? adjustedYear! : adjustedMonth!) + optionsExtraCents;
  // What is paid NOW: the code's price when one is applied, the list price
  // otherwise. The extras ride on top either way — a code discounts the
  // membership, not somebody's add-ons.
  const payNowCents =
    appliedHere && listCents !== null ? appliedHere.priceCents + optionsExtraCents : listCents;
  // The membership at full price plus whatever recurs — NOT today's total,
  // which includes a discount that applies once and extras that are paid once.
  /** What the code takes off, as the difference between the two figures the
   *  rows already show. Derived rather than recomputed from a percentage: a
   *  second calculation would round on its own and the column would stop
   *  adding up by a cent, which is exactly the complaint this answers. */
  const discountCents =
    appliedHere && listCents !== null
      ? listCents - optionsExtraCents - appliedHere.priceCents
      : 0;
  const renewsAtCents =
    listCents === null ? null : listCents - optionsExtraCents + recurringExtraCents;
  const line = payLineFor({
    amountCents: payNowCents,
    fullAmountCents: renewsAtCents,
    interval,
    firstPeriodEndsOn: tier.first_period_ends_on,
    now: new Date(),
  });
  // INTL_LOCALES, not the bare locale: `toLocaleDateString('en', …)` is
  // en-US, and the first render on staging said "December 31, 2026" to a
  // European audience. The map already exists for exactly this (i18n P3) and
  // sends `en` to en-GB.
  const onDate = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(INTL_LOCALES[locale], {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const amount = payNowCents === null ? '' : money(payNowCents, currency);
  const full = renewsAtCents === null ? '' : money(renewsAtCents, currency);
  const payLine =
    line.kind === 'none'
      ? null
      : line.kind === 'fixed'
        ? line.discounted
          ? t(locale, 'pay_now_fixed_period_full', {
              amount,
              full,
              end: onDate(line.endsOn),
              renews: onDate(line.renewsOn),
            })
          : t(locale, 'pay_now_fixed_period', {
              amount,
              end: onDate(line.endsOn),
              renews: onDate(line.renewsOn),
            })
        : line.discounted
          ? t(
              locale,
              line.interval === 'year' ? 'pay_now_then_year_full' : 'pay_now_then_month_full',
              { amount, full },
            )
          : t(locale, line.interval === 'year' ? 'pay_now_then_year' : 'pay_now_then_month', {
              amount,
            });

  // One idempotency key per page visit — double-submits collapse server-side.
  const requestId = useMemo(
    () => `mjoin_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
    [],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    if (!name || !email) return setError(t(locale, 'fill_name_email'));
    if (!termsAccepted) return setError(t(locale, 'accept_terms_required'));
    if (vatRegistered && (payNowCents ?? 0) > 0 && !country) return setError(t(locale, 'vat_country_required'));

    setState('submitting');
    try {
      const res = await publicFetch<{ url?: string | null; already_member?: boolean }>(
        '/api/v1/membership/public/join',
        {
          method: 'POST',
          body: JSON.stringify({
            workspace_slug: workspaceSlug,
            tier_id: tier.id,
            interval,
            email,
            name,
            ...(country ? { country } : {}),
            locale,
            ...(chosenIds.length ? { option_product_ids: chosenIds } : {}),
            directory_listed: listed,
            terms_accepted: termsAccepted,
            // The invoicing details, read by the same shared helper Thread
            // and Meet use. Empty fields come back as an empty object, which
            // the API treats as "nothing collected" — joining as yourself
            // with a card means typing none of this.
            billing: readBillingFields(fd),
            // The CODE, not its price: the join route looks it up again and
            // decides the amount itself. Sending a price would be asking the
            // browser what to charge.
            ...(appliedHere ? { code: appliedHere.code } : {}),
            request_id: requestId,
          }),
        },
      );
      if (res.already_member) {
        setState('already');
        return;
      }
      if (res.url) {
        setState('redirecting');
        // Escapes the iframe when embedded — Stripe refuses to be framed.
        redirectToCheckout(res.url);
        return;
      }
      setState('idle');
      setError(t(locale, 'something_wrong'));
    } catch (err) {
      setState('idle');
      const body = err instanceof PublicApiError ? (err.body as { error?: unknown }) : null;
      setError(typeof body?.error === 'string' ? body.error : t(locale, 'something_wrong'));
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-line bg-surface-raised p-6">
      <h2 className="text-lg font-medium">{tier.name}</h2>

      <div className="mt-2 flex items-baseline gap-1.5">
        {hasYear ? (
          <>
            <span className="text-2xl font-semibold tabular-nums">
              {money(adjustedYear!, currency)}
            </span>
            <span className="text-sm text-ink-subtle">
              {t(locale, 'per_year')}
              {vatRegistered ? ` ${t(locale, 'excl_vat_suffix')}` : ''}
            </span>
          </>
        ) : hasMonth ? (
          <>
            <span className="text-2xl font-semibold tabular-nums">
              {money(adjustedMonth!, currency)}
            </span>
            <span className="text-sm text-ink-subtle">
              {t(locale, 'per_month')}
              {vatRegistered ? ` ${t(locale, 'excl_vat_suffix')}` : ''}
            </span>
          </>
        ) : (
          <span className="text-sm text-ink-subtle">{t(locale, 'price_on_request')}</span>
        )}
      </div>
      {/* "€363 incl. 21% VAT" (shared with the product cards, Thread and
          Meet): the home rate until a country is chosen, then that one's. */}
      {vatRegistered && (hasYear || hasMonth) && (
        <VatInclNote formatMoney={(c, cur) => money(c, cur)}
          netCents={hasYear ? adjustedYear! : adjustedMonth!}
          ratePct={cardRatePct}
          currency={currency}
          locale={locale}
          className="mt-0.5"
        />
      )}
      {hasYear && hasMonth && (
        <div className="mt-0.5 text-xs text-ink-muted">
          {t(locale, 'or_month', { price: money(adjustedMonth!, currency) })}
        </div>
      )}

      {tier.description && (
        <p className="mt-3 text-sm text-ink-subtle leading-relaxed">{tier.description}</p>
      )}

      {(tier.characteristics?.length ?? 0) > 0 && (
        <ul className="mt-4 space-y-1.5">
          {tier.characteristics!.map((ch, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-ink-subtle">
              <Check size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-emerald-600" />
              {ch}
            </li>
          ))}
        </ul>
      )}

      {includedProducts.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-muted">
            {t(locale, 'includes')}
          </div>
          <ul className="mt-1.5 space-y-1">
            {includedProducts.map((name) => (
              <li key={name} className="text-sm text-ink-subtle">
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto pt-5">
        {state === 'already' ? (
          <p className="text-sm text-ink-subtle rounded-md border border-line bg-surface px-3 py-2.5">
            {t(locale, 'already_member_note')}
          </p>
        ) : (
          <Button
            type="button"
            className="w-full"
            onClick={onOpen}
            disabled={!hasYear && !hasMonth}
          >
            {t(locale, 'join')}
          </Button>
        )}
      </div>

      {/* THE PANEL. Below sm the shared Dialog is a sheet, which is what
          Sjoerd asked for ("a popup or side panel"), and above it a centred
          dialog. The card behind it keeps its own price and includes-list, so
          somebody filling this in can still see what they are buying. */}
      {open && (
        <Dialog
          open
          onClose={onClose}
          title={t(locale, 'join_tier_title', { tier: tier.name })}
        >
          <form
            onSubmit={onSubmit}
            // The VAT number lives in the shared billing fields; read it as it
            // is typed so the VAT lines can say "reverse-charged".
            onChange={(e) => {
              const el = e.target as unknown as HTMLInputElement;
              if (el.name === 'billing_tax_no') setVatNo(el.value);
            }}
            className="space-y-2.5"
          >
            {/* The price incl. VAT at the top, before a country is chosen;
                the excl. / VAT / total lines below take over once it is. */}
            {vatRegistered && !vatQuote && (payNowCents ?? 0) > 0 && (
              <VatInclNote formatMoney={(c, cur) => money(c, cur)} netCents={payNowCents!} ratePct={vatHomeRatePct} currency={currency} locale={locale} />
            )}
            {hasYear && hasMonth && (
              <div className="grid grid-cols-2 rounded-md border border-line overflow-hidden h-[34px] text-sm">
                {(
                  [
                    ['year', `${money(adjustedYear!, currency)} ${t(locale, 'per_year')}`],
                    ['month', `${money(adjustedMonth!, currency)} ${t(locale, 'per_month')}`],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setBillingInterval(k)}
                    className={
                      interval === k
                        ? 'bg-surface-sunken text-ink font-medium'
                        : 'bg-surface text-ink-subtle hover:text-ink hover:bg-surface-sunken'
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <input
              name="name"
              placeholder={t(locale, 'your_name')}
              autoComplete="name"
              required
              className={INPUT}
            />
            <input
              name="email"
              type="email"
              placeholder={t(locale, 'email_placeholder')}
              autoComplete="email"
              required
              className={INPUT}
            />
            {optionalProducts.length > 0 && (
              <div className="rounded-md border border-line bg-surface px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-wider text-ink-muted">
                  {t(locale, 'optional_extras')}
                </div>
                <div className="mt-1.5 space-y-1.5">
                  {compatibleOptions.map((p) => (
                    <label key={p.id} className="flex items-start gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={chosenOptions.has(p.id)}
                        onChange={() => toggleOption(p.id)}
                        className="mt-0.5 accent-current"
                      />
                      {/* Name and price share a line when they fit and stack
                          when they do not. As two flex siblings the name got
                          `flex-1` and wrapped while the price stayed on line
                          one, so a long name like "email@soul.com / Google
                          Workspace" rendered as `email@soul.com+ € 193,20 /
                          year` with the price buried mid-name (Sjoerd's
                          screenshot of the live soul.com join page,
                          2026-09-24). Wrapping the PAIR keeps the price
                          whole and right-aligned on its own line instead. */}
                      <span className="min-w-0 flex-1 flex flex-wrap items-baseline justify-between gap-x-2">
                      <span className="text-ink">{p.name}</span>
                      <span className="shrink-0 text-ink-subtle tabular-nums">
                        {(p.price_cents ?? 0) > 0
                          ? `+ ${money(p.price_cents!, p.currency ?? currency)} ${
                              (p.price_interval ?? 'once') === 'month'
                                ? t(locale, 'per_month')
                                : (p.price_interval ?? 'once') === 'year'
                                  ? t(locale, 'per_year')
                                  : t(locale, 'option_once')
                            }`
                          : // NOT "Included". This box is OPTIONAL EXTRAS,
                            // and an unticked box labelled "Included" is a
                            // contradiction on a payment form: either it is
                            // included, in which case it is not a choice and
                            // belongs in the card's INCLUDES list, or it is a
                            // choice, in which case what the reader needs to
                            // know is that choosing it costs nothing.
                            t(locale, 'option_no_extra_cost')}
                      </span>
                      </span>
                    </label>
                  ))}
                </div>
                {optionsExtraCents > 0 && (
                  <div className="mt-2 border-t border-line pt-1.5 text-xs tabular-nums">
                    {/* THE TOTAL, with the membership in it (Sjoerd, asking
                        for it on his own join page). The extras box used to
                        show "+ € 3.193,20" and nothing else, so the only
                        number near the button was the one that excluded the
                        thing being bought. Now the three lines add up to the
                        figure the sentence below promises, and a reader can
                        check it. */}
                    <div className="flex justify-between text-ink-subtle">
                      <span>{tier.name}</span>
                      <span>
                        {money(interval === 'year' ? adjustedYear! : adjustedMonth!, currency)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex justify-between text-ink-subtle">
                      <span>{t(locale, 'optional_extras')}</span>
                      <span>+ {money(optionsExtraCents, currency)}</span>
                    </div>
                    {/* THE CODE, AS A LINE OF ITS OWN.
                        Without it these lines did not add up: the tier row
                        showed the full price, the extras row showed the
                        extras, and the TOTAL showed the discounted figure —
                        €300 + €3.193,20 printed above €3.343,20. A total a
                        reader cannot check is worse than no total, because
                        the one thing a payment form must not do is look like
                        it got the sum wrong.
                        The tier row stays at list price on purpose: a reader
                        can then see what the membership costs AND what the
                        code took off, which is the information the code was
                        given for. */}
                    {appliedHere && discountCents > 0 && (
                      <div className="mt-0.5 flex justify-between text-ink-subtle">
                        <span>{t(locale, 'code_line', { code: appliedHere.code })}</span>
                        <span>&minus; {money(discountCents, currency)}</span>
                      </div>
                    )}
                    <div className="mt-1 flex justify-between border-t border-line pt-1 text-ink font-medium">
                      <span>{t(locale, 'total')}</span>
                      <span>{money(payNowCents ?? 0, currency)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* THE DISCOUNT CODE. Shared with Thread's enrol form, which is
                where it was written; what differs is only WHERE a code is
                validated, so that arrives as a prop. Hidden behind a reveal
                for the same reason it is there: most people have no code, and
                an empty box invites a hunt for one.

                The note under an applied code is the honest half — it applies
                to the FIRST payment and the membership renews at full price,
                which the sentence above the button then names in full. */}
            {(listCents ?? 0) > 0 && (
              <DiscountCodeField
                // KEYED ON WHAT THE PRICE DEPENDS ON. A code validated for
                // Year/NL is not validated for Month/NL, so when either
                // changes the field is a new field: its typed value and its
                // "applied" badge go, and the visitor is asked again rather
                // than shown a figure from the other tab.
                key={`${interval}:${country}`}
                inputClassName={INPUT}
                labels={{
                  label: t(locale, 'discount_code'),
                  apply: t(locale, 'apply'),
                  applied: (c) => t(locale, 'code_applied', { code: c }),
                }}
                note={t(locale, 'code_first_period_only')}
                onCleared={() => setApplied(null)}
                onValidate={async (code) => {
                  const r = await publicFetch<{
                    valid: boolean;
                    code?: string;
                    price_cents?: number;
                    reason?: string;
                  }>('/api/v1/membership/public/validate-code', {
                    method: 'POST',
                    body: JSON.stringify({
                      workspace_slug: workspaceSlug,
                      tier_id: tier.id,
                      interval,
                      code,
                      ...(country ? { country } : {}),
                    }),
                  });
                  if (!r.valid || r.price_cents === undefined || !r.code) {
                    setApplied(null);
                    return { ok: false as const, reason: r.reason ?? 'this code is not valid' };
                  }
                  // Stamped with the pair it was priced for, which is what
                  // makes `appliedHere` able to tell later that it is stale.
                  setApplied({ code: r.code, priceCents: r.price_cents, interval, country });
                  return { ok: true as const, code: r.code };
                }}
              />
            )}
            {/* THE INVOICING DETAILS, asked here rather than on Stripe's page
                (Sjoerd: "nothing of Stripe is the rule, except payment", and
                "it should be a single point,,, invoicing payments"). The same
                shared fields Thread's enrol form and Meet's booking flow use,
                with the same labels — one copy of each since this panel
                needed them.

                Every field is optional. Somebody joining as themselves with a
                card types nothing here and the join works exactly as before;
                what they do type is written onto the Stripe customer, so the
                invoice carries OUR details and the ledger reads them back off
                it. Behind a disclosure, because most people joining a
                community are not invoicing an employer and a form that opens
                on six empty boxes is a form that loses them. */}
            <details className="group rounded-md border border-line bg-surface px-3 py-2">
              <summary className="cursor-pointer list-none text-sm text-ink-subtle hover:text-ink">
                {t(locale, 'invoice_details_toggle')}
              </summary>
              <div className="mt-2.5 space-y-2.5">
                <InvoiceBillingFields
                  inputClassName={INPUT}
                  // Already asked at the top of the page, to price by. Asking
                  // again on the same form is the kind of thing people notice.
                  defaultCountry={country}
                  whoPays={{
                    label: t(locale, 'who_pays'),
                    myself: t(locale, 'who_pays_myself'),
                    organisation: t(locale, 'who_pays_organisation'),
                  }}
                  labels={{
                    company: t(locale, 'company_name'),
                    address: t(locale, 'billing_address'),
                    postalCode: t(locale, 'postal_code'),
                    city: t(locale, 'city'),
                    country: t(locale, 'country'),
                    countryPlaceholder: t(locale, 'country_placeholder'),
                    taxNo: t(locale, 'tax_number'),
                  }}
                />
              </div>
            </details>
            {/* "Show me in …" — the directory consent. Unticked, always:
                the member decides to be seen, and nothing decides it for
                them. The link opens in a new tab so the half-filled form
                survives a look at what they would be joining. */}
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="directory_listed"
                checked={listed}
                onChange={(e) => setListed(e.target.checked)}
                className="mt-0.5 accent-current"
              />
              <span className="min-w-0 flex-1">
                <span className="text-ink">
                  {/* The sentence is one string with a {where} hole, so a
                      locale can put the place first — and only the PLACE is
                      the link, which is what Sjoerd asked for. */}
                  {t(locale, 'show_me_in', { where: '\u0000' })
                    .split('\u0000')
                    .flatMap((part, i) =>
                      i === 0
                        ? [part]
                        : [
                            <a
                              key="where"
                              href={membersAreaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="underline underline-offset-2 hover:opacity-70"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {(tier.directory_categories ?? []).length
                                ? joinNames(tier.directory_categories!)
                                : t(locale, 'members_area_of', { community: workspaceName })}
                            </a>,
                            part,
                          ],
                    )}
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  {t(locale, 'show_me_in_note')}
                </span>
              </span>
            </label>
            {/* THE TERMS. Required, and required HERE rather than only at the
                API: a person should be stopped before they reach a payment
                page, not after. The API refuses it too — a form can be
                bypassed, and this is an agreement. */}
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="terms_accepted"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 accent-current"
              />
              <span className="min-w-0 flex-1 text-ink">
                {t(locale, 'accept_terms_before')}{' '}
                <a
                  href={terms.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:opacity-70"
                >
                  {terms.standard
                    ? t(locale, 'terms_standard_name')
                    : t(locale, 'terms_own_name', { community: workspaceName })}
                </a>
              </span>
            </label>
            {/* The sentence, immediately above the button that acts on it. */}
            {vatRegistered && (payNowCents ?? 0) > 0 && (
              vatQuote ? (
                <VatBreakdown formatMoney={(c, cur) => money(c, cur)} netCents={payNowCents!} quote={vatQuote} currency={currency} locale={locale} />
              ) : (
                <p className="text-xs text-ink-subtle">{t(locale, 'prices_excl_vat_choose_country')}</p>
              )
            )}
            {payLine && <p className="text-sm text-ink-subtle">{payLine}{vatRegistered ? ` ${t(locale, 'excl_vat_suffix')}` : ''}</p>}
            {state === 'already' && (
              <p className="text-sm text-ink rounded-md border border-line bg-surface px-3 py-2.5">
                {t(locale, 'already_member_form')}{' '}
                {/* Where an existing member changes their membership or adds
                    to it: my.thread → Purchases, on this stack. */}
                <a
                  href={(() => {
                    try {
                      return `${new URL(membersAreaUrl).origin}/purchases`;
                    } catch {
                      return membersAreaUrl;
                    }
                  })()}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:opacity-70"
                >
                  {t(locale, 'already_member_purchases_link')}
                </a>
              </p>
            )}
            {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
            <Button
              type="submit"
              className="w-full"
              // Disabled until the terms are accepted. The submit handler
              // refuses too, and so does the API — but a greyed button is the
              // one a person reads, and a form that LOOKS ready and then
              // refuses teaches somebody they did something wrong.
              disabled={!termsAccepted || state === 'submitting' || state === 'redirecting'}
            >
              {state === 'redirecting'
                ? t(locale, 'taking_to_payment')
                : state === 'submitting'
                  ? t(locale, 'one_moment')
                  : t(locale, 'continue_to_payment')}
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="w-full text-xs text-ink-muted hover:text-ink"
            >
              {t(locale, 'cancel')}
            </button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
