'use client';

// THE PAGE BASKET (Sjoerd, 2026-10-16): "can I add the membership... and then
// add products... and I see the basket filling.... and I only have to fill in
// emails and data only once. Not at product level (membership is a product
// too, in a sense)".
//
// Every card adds to ONE basket; a tier is just another item (one per
// basket — another replaces it). The basket stays with you: a sticky bar on
// phones that opens into a sheet, a sticky panel beside the cards on wide
// screens. ONE checkout step asks the country, name, email, invoicing,
// consent and terms once, then ONE Stripe Checkout. The rules are in
// lib/basket.ts (pure, tested); this file renders and wires them.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { COUNTRIES, COUNTRY_OPTIONS } from '@thefibre/shared/countries';
import { SearchSelect } from '@thefibre/shared/ui/search-select';
import { redirectToCheckout } from '@thefibre/shared/checkout-redirect';
import { DiscountCodeField } from '@thefibre/shared/ui/discount-code-field';
import { InvoiceBillingFields, readBillingFields } from '@thefibre/shared/ui/payment-methods';
import { VatInclNote } from '@thefibre/shared/ui/vat-price';
import { X } from 'lucide-react';
import type { PriceLogic } from '@thefibre/shared/price-logic';
import {
  EMPTY_BASKET,
  addProduct,
  addTier,
  checkoutTarget,
  initialCountry,
  lines as basketLines,
  netOf,
  normalize,
  parseStored,
  removeProduct,
  removeTier,
  setInterval_,
  suggestions,
  totals as basketTotals,
  intervalsOf,
  type Basket,
  type Catalog,
  type Interval,
} from '@/lib/basket';
import { payLineFor } from '@/lib/pay-line';
import { publicFetch, PublicApiError, type PublicProduct, type PublicTier } from '@/lib/public-api';
import { money } from '@/lib/money';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

const INPUT = 'w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none';
const VALID = new Set(COUNTRY_OPTIONS.map((o) => o.value));
const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;
const fmt = (c: number, cur: string) => money(c, cur);

type Quote = { rate_pct: number; reverse_charge: boolean };
type Ctx = {
  basket: Basket;
  catalog: Catalog;
  country: string;
  setCountry: (c: string) => void;
  /** The rate the small "incl. VAT" notes use: the quote once a country is
   *  known (0 for a reverse charge or outside the EU), else the home rate. */
  noteRatePct: number | null;
  vatRegistered: boolean;
  addTier: (id: string) => void;
  removeTier: () => void;
  addProduct: (id: string) => void;
  removeProduct: (id: string) => void;
  openBasket: () => void;
};
const BasketContext = createContext<Ctx | null>(null);
export function useBasket(): Ctx {
  const ctx = useContext(BasketContext);
  if (!ctx) throw new Error('useBasket outside BasketProvider');
  return ctx;
}

export function BasketProvider({
  children,
  workspaceSlug,
  workspaceName,
  tiers,
  products,
  priceLogic,
  vatRegistered,
  vatHomeRatePct,
  locale,
  membersAreaUrl,
  terms,
  initialTierId,
  cancelled,
}: {
  children: ReactNode;
  workspaceSlug: string;
  workspaceName: string;
  tiers: PublicTier[];
  products: PublicProduct[];
  priceLogic: PriceLogic | null;
  vatRegistered: boolean;
  vatHomeRatePct: number | null;
  locale: Locale;
  membersAreaUrl: string;
  terms: { url: string; standard: boolean };
  /** ?tier= — an invitation (possibly to a hidden tier) or a cancelled
   *  checkout's way back: that tier lands IN the basket, basket open. */
  initialTierId: string | null;
  cancelled: boolean;
}) {
  const catalog: Catalog = useMemo(
    () => ({ tiers, products, priceLogic, vat: { registered: vatRegistered, homeRatePct: vatHomeRatePct } }),
    [tiers, products, priceLogic, vatRegistered, vatHomeRatePct],
  );
  const BASKET_KEY = `thefibre.basket.${workspaceSlug}`;
  const COUNTRY_KEY = 'thefibre.join.country';
  const [basket, setBasket] = useState<Basket>(EMPTY_BASKET);
  const [country, setCountryState] = useState('');
  const [ready, setReady] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [step, setStep] = useState<'basket' | 'checkout'>('basket');
  const panelRef = useRef<HTMLDivElement>(null);

  // FIRST PAINT → what this viewer had. The basket: stored (a cancelled
  // checkout comes back intact), else the ?tier= of an invitation. The
  // country: stored, else the edge's guess (/api/geo), else nothing.
  useEffect(() => {
    let stored = EMPTY_BASKET;
    let storedCountry: string | null = null;
    try {
      stored = parseStored(window.localStorage.getItem(BASKET_KEY));
      storedCountry = window.localStorage.getItem(COUNTRY_KEY);
    } catch {
      /* private window or blocked storage: start empty */
    }
    let start = normalize(catalog, stored);
    if (initialTierId && start.tierId !== initialTierId && !(cancelled && (start.tierId || start.productIds.length))) {
      start = addTier(catalog, start, initialTierId);
    }
    setBasket(start);
    const fromStore = initialCountry({ stored: storedCountry }, VALID);
    if (fromStore) setCountryState(fromStore);
    else {
      void fetch('/api/geo', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { country?: string | null } | null) => {
          const guess = initialCountry({ header: j?.country ?? null }, VALID);
          if (guess) setCountryState((c) => c || guess);
        })
        .catch(() => undefined);
    }
    if (initialTierId && start.tierId) {
      setSheetOpen(true);
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(BASKET_KEY, JSON.stringify(basket));
    } catch {
      /* not remembered, still in the basket */
    }
  }, [basket, ready, BASKET_KEY]);

  const setCountry = (c: string) => {
    setCountryState(c);
    try {
      if (c) window.localStorage.setItem(COUNTRY_KEY, c);
    } catch {
      /* chosen, not remembered */
    }
  };

  // VAT: the API's rate for this country (and a business's number) — THE rule
  // the checkout charges by.
  const [vatNo, setVatNo] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  useEffect(() => {
    if (!vatRegistered || !country) {
      setQuote(null);
      return;
    }
    const timer = setTimeout(() => {
      const q = new URLSearchParams({ workspace_slug: workspaceSlug, country, ...(vatNo.trim() ? { vat_id: vatNo.trim() } : {}) });
      publicFetch<Quote>(`/api/v1/membership/public/vat-quote?${q}`)
        .then(setQuote)
        .catch(() => setQuote(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [vatRegistered, country, vatNo, workspaceSlug]);

  const noteRatePct = quote ? quote.rate_pct : vatHomeRatePct;
  const count = (basket.tierId ? 1 : 0) + basket.productIds.length;
  // The bar's figure: the total incl. VAT (the home rate before a country).
  const barLines = basketLines(catalog, basket, country);
  const barTotal = basketTotals(barLines, vatRegistered ? noteRatePct ?? 0 : 0);

  const ctx: Ctx = {
    basket,
    catalog,
    country,
    setCountry,
    noteRatePct: vatRegistered ? noteRatePct : null,
    vatRegistered,
    addTier: (id) => setBasket((b) => addTier(catalog, b, id)),
    removeTier: () => setBasket((b) => removeTier(catalog, b)),
    addProduct: (id) => setBasket((b) => addProduct(catalog, b, id)),
    removeProduct: (id) => setBasket((b) => removeProduct(catalog, b, id)),
    openBasket: () => setSheetOpen(true),
  };

  const body = (
    <BasketBody
      step={step}
      setStep={setStep}
      locale={locale}
      workspaceSlug={workspaceSlug}
      workspaceName={workspaceName}
      membersAreaUrl={membersAreaUrl}
      terms={terms}
      quote={quote}
      vatHomeRatePct={vatHomeRatePct}
      vatNo={vatNo}
      setVatNo={setVatNo}
      setBasket={setBasket}
    />
  );

  return (
    <BasketContext.Provider value={ctx}>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
        <div className="min-w-0">{children}</div>
        {/* WIDE: a panel beside the cards that stays while you scroll. */}
        <aside ref={panelRef} className="hidden lg:block lg:sticky lg:top-8 mt-10 rounded-xl border border-line bg-surface-raised p-5">
          <h2 className="text-sm font-medium">{step === 'checkout' ? t(locale, 'basket_checkout_title') : t(locale, 'basket_title')}</h2>
          <div className="mt-3">{body}</div>
        </aside>
      </div>
      {/* NARROW: a bar that stays at the bottom and opens into a sheet. */}
      {count > 0 && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-raised px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => setSheetOpen(true)} className="flex w-full items-center justify-between gap-3 text-left">
            <span className="text-sm">
              <span className="font-medium">{t(locale, 'basket_title')}</span>
              <span className="text-ink-subtle"> · {count === 1 ? t(locale, 'basket_one_item') : t(locale, 'basket_items', { n: count })}</span>
              <span className="text-ink-subtle tabular-nums"> · {fmt(barTotal.grossCents, barLines[0]?.currency ?? 'EUR')}</span>
            </span>
            <span className="text-sm font-medium underline underline-offset-2">{t(locale, 'basket_view')}</span>
          </button>
        </div>
      )}
      {sheetOpen && (
        <div className="lg:hidden">
          <Dialog open onClose={() => setSheetOpen(false)} title={step === 'checkout' ? t(locale, 'basket_checkout_title') : t(locale, 'basket_title')}>
            {body}
          </Dialog>
        </div>
      )}
      {/* Room under the last card for the bar. */}
      {count > 0 && <div className="h-16 lg:hidden" aria-hidden />}
    </BasketContext.Provider>
  );
}

function BasketBody({
  step,
  setStep,
  locale,
  workspaceSlug,
  workspaceName,
  membersAreaUrl,
  terms,
  quote,
  vatHomeRatePct,
  vatNo,
  setVatNo,
  setBasket,
}: {
  step: 'basket' | 'checkout';
  setStep: (s: 'basket' | 'checkout') => void;
  locale: Locale;
  workspaceSlug: string;
  workspaceName: string;
  membersAreaUrl: string;
  terms: { url: string; standard: boolean };
  quote: Quote | null;
  vatHomeRatePct: number | null;
  vatNo: string;
  setVatNo: (v: string) => void;
  setBasket: (f: (b: Basket) => Basket) => void;
}) {
  const { basket, catalog, country, setCountry, vatRegistered, removeTier: dropTier, removeProduct: dropProduct, addProduct: addP } = useBasket();
  const tier = basket.tierId ? catalog.tiers.find((x) => x.id === basket.tierId) ?? null : null;
  const ls = basketLines(catalog, basket, country);
  const currency = ls[0]?.currency ?? 'EUR';

  // THE CODE: the server's answer for THIS tier, interval and country — a
  // stale one (any of the three changed) counts as none.
  const [applied, setApplied] = useState<{ code: string; priceCents: number; key: string } | null>(null);
  const codeKey = `${basket.tierId}:${basket.interval}:${country}`;
  const appliedHere = applied && applied.key === codeKey ? applied : null;
  const tierLine = ls.find((l) => l.kind === 'tier');
  const discountCents = appliedHere && tierLine ? Math.max(0, tierLine.netCents - appliedHere.priceCents) : 0;

  // VAT, always in the totals block: the exact quote once a country is
  // known, the home rate (said so) before.
  const ratePct = !vatRegistered ? 0 : quote ? quote.rate_pct : vatHomeRatePct ?? 0;
  const tot = basketTotals(ls, ratePct, discountCents);
  const vatLabel = !vatRegistered
    ? null
    : quote
      ? quote.reverse_charge
        ? t(locale, 'vat_reverse_charged')
        : quote.rate_pct > 0
          ? `${t(locale, 'vat')} ${quote.rate_pct}%`
          : t(locale, 'vat_out_of_scope')
      : `${t(locale, 'vat')} ${vatHomeRatePct ?? 0}%`;

  // The pay sentence, in INCL. amounts (Sjoerd: the VAT the page knows is in
  // every figure it says).
  const line = tier
    ? payLineFor({ amountCents: tot.grossCents, fullAmountCents: tot.renewGrossCents, interval: basket.interval, firstPeriodEndsOn: tier.first_period_ends_on, now: new Date() })
    : null;
  const onDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(INTL_LOCALES[locale], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const amount = fmt(tot.grossCents, currency);
  const full = fmt(tot.renewGrossCents, currency);
  const renewDiffers = tot.renewGrossCents !== tot.grossCents;
  const paySentence = !line || line.kind === 'none'
    ? null
    : line.kind === 'fixed'
      ? t(locale, renewDiffers ? 'pay_now_fixed_period_full' : 'pay_now_fixed_period', { amount, full, end: onDate(line.endsOn), renews: onDate(line.renewsOn) })
      : t(locale, renewDiffers ? (line.interval === 'year' ? 'pay_now_then_year_full' : 'pay_now_then_month_full') : line.interval === 'year' ? 'pay_now_then_year' : 'pay_now_then_month', { amount, full });

  if (!tier && !basket.productIds.length) {
    return <p className="text-sm text-ink-muted">{t(locale, 'basket_empty')}</p>;
  }

  if (step === 'checkout') {
    return (
      <Checkout
        locale={locale}
        workspaceSlug={workspaceSlug}
        workspaceName={workspaceName}
        membersAreaUrl={membersAreaUrl}
        terms={terms}
        tier={tier}
        amountLine={`${fmt(tot.grossCents, currency)}`}
        paySentence={paySentence}
        code={appliedHere?.code ?? null}
        vatNo={vatNo}
        setVatNo={setVatNo}
        onBack={() => setStep('basket')}
      />
    );
  }

  const sugg = suggestions(catalog, basket);
  const intervals = tier ? intervalsOf(tier) : [];
  return (
    <div className="space-y-3 text-sm">
      <ul className="divide-y divide-line">
        {ls.map((l) => (
          <li key={`${l.kind}:${l.id}`} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <div className="text-ink">{l.name}</div>
              <div className="text-xs text-ink-muted">
                {l.kind === 'tier'
                  ? intervals.length > 1
                    ? null // the toggle below says it
                    : t(locale, basket.interval === 'year' ? 'per_year' : 'per_month')
                  : l.recurring
                    ? t(locale, basket.interval === 'year' ? 'renews_with_membership_year' : 'renews_with_membership_month')
                    : t(locale, 'option_once')}
              </div>
              {l.kind === 'tier' && intervals.length > 1 && (
                <div className="mt-1 inline-flex overflow-hidden rounded-md border border-line text-xs">
                  {intervals.map((iv: Interval) => (
                    <button
                      key={iv}
                      type="button"
                      onClick={() => setBasket((b) => setInterval_(catalog, b, iv))}
                      className={basket.interval === iv ? 'bg-surface-sunken px-2 py-0.5 font-medium text-ink' : 'px-2 py-0.5 text-ink-subtle hover:text-ink'}
                    >
                      {t(locale, iv === 'year' ? 'per_year' : 'per_month')}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="shrink-0 text-right">
              <div className="tabular-nums">{fmt(l.netCents, l.currency)}</div>
              {vatRegistered && <VatInclNote formatMoney={fmt} netCents={l.netCents} ratePct={ratePct} currency={l.currency} locale={locale} />}
            </div>
            <button
              type="button"
              onClick={() => (l.kind === 'tier' ? dropTier() : dropProduct(l.id))}
              aria-label={`${t(locale, 'basket_remove')} ${l.name}`}
              className="shrink-0 rounded p-0.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              <X size={14} aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      {sugg.length > 0 && (
        <div className="rounded-md border border-dashed border-line px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-ink-muted">{t(locale, 'add_to_membership')}</div>
          {sugg.map((p) => (
            <button key={p.id} type="button" onClick={() => addP(p.id)} className="mt-1 flex w-full items-baseline justify-between gap-2 text-left hover:text-ink">
              <span className="text-ink-subtle">+ {p.name}</span>
              <span className="shrink-0 tabular-nums text-ink-muted">
                {fmt(netOf(catalog, p.price_cents ?? 0, p.price_includes_vat), p.currency ?? currency)}{' '}
                {(p.price_interval ?? 'once') === 'once' ? t(locale, 'option_once') : t(locale, basket.interval === 'year' ? 'per_year' : 'per_month')}
              </span>
            </button>
          ))}
        </div>
      )}

      {tier && (
        <div>
          <DiscountCodeField
            key={codeKey}
            inputClassName={INPUT}
            labels={{ label: t(locale, 'discount_code'), apply: t(locale, 'apply'), applied: (c) => t(locale, 'code_applied', { code: c }) }}
            note={t(locale, 'code_first_period_only')}
            onCleared={() => setApplied(null)}
            onValidate={async (code) => {
              const r = await publicFetch<{ valid: boolean; code?: string; price_cents?: number; reason?: string }>('/api/v1/membership/public/validate-code', {
                method: 'POST',
                body: JSON.stringify({ workspace_slug: workspaceSlug, tier_id: tier.id, interval: basket.interval, code, ...(country ? { country } : {}) }),
              });
              if (!r.valid || r.price_cents === undefined || !r.code) {
                setApplied(null);
                return { ok: false as const, reason: r.reason ?? 'this code is not valid' };
              }
              setApplied({ code: r.code, priceCents: r.price_cents, key: codeKey });
              return { ok: true as const, code: r.code };
            }}
          />
          {basket.productIds.length > 0 && <p className="mt-1 text-xs text-ink-muted">{t(locale, 'code_applies_membership')}</p>}
        </div>
      )}

      {/* THE TOTALS — where the VAT lives, always. */}
      <div className="border-t border-line pt-2 text-xs tabular-nums">
        {discountCents > 0 && appliedHere && (
          <div className="flex justify-between text-ink-subtle">
            <span>{t(locale, 'code_line', { code: appliedHere.code })}</span>
            <span>&minus; {fmt(discountCents, currency)}</span>
          </div>
        )}
        {vatRegistered ? (
          <>
            <div className="flex justify-between text-ink-subtle">
              <span>{t(locale, 'basket_subtotal')}</span>
              <span>{fmt(tot.netCents, currency)}</span>
            </div>
            <div className="mt-0.5 flex justify-between text-ink-subtle">
              <span>{vatLabel}</span>
              <span>{fmt(tot.vatCents, currency)}</span>
            </div>
            {!quote && (
              <div className="text-[11px] text-ink-muted">
                {t(locale, 'basket_vat_home_note', { pct: String(vatHomeRatePct ?? 0) })}
              </div>
            )}
          </>
        ) : null}
        <div className="mt-1 flex justify-between border-t border-line pt-1 text-sm font-medium text-ink">
          <span>{t(locale, 'basket_total')}</span>
          <span>{fmt(tot.grossCents, currency)}</span>
        </div>
      </div>
      {paySentence && <p className="text-xs text-ink-subtle">{paySentence}</p>}

      {vatRegistered && (
        <div>
          <label className="mb-1 block text-xs text-ink-subtle">{t(locale, 'country_question_vat')}</label>
          <SearchSelect value={country} onChange={setCountry} options={COUNTRY_OPTIONS} placeholder={t(locale, 'country_placeholder')} className="w-full text-left" />
        </div>
      )}

      <Button type="button" className="w-full" onClick={() => setStep('checkout')}>
        {t(locale, 'basket_continue')}
      </Button>
    </div>
  );
}

function Checkout({
  locale,
  workspaceSlug,
  workspaceName,
  membersAreaUrl,
  terms,
  tier,
  amountLine,
  paySentence,
  code,
  vatNo,
  setVatNo,
  onBack,
}: {
  locale: Locale;
  workspaceSlug: string;
  workspaceName: string;
  membersAreaUrl: string;
  terms: { url: string; standard: boolean };
  tier: PublicTier | null;
  amountLine: string;
  paySentence: string | null;
  code: string | null;
  vatNo: string;
  setVatNo: (v: string) => void;
  onBack: () => void;
}) {
  const { basket, catalog, country, setCountry, vatRegistered } = useBasket();
  const [listed, setListed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [state, setState] = useState<'idle' | 'submitting' | 'redirecting' | 'already'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [editingCountry, setEditingCountry] = useState(!country);
  const requestId = useMemo(() => `mbasket_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`, []);
  const target = checkoutTarget(basket, catalog);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!target || state === 'submitting' || state === 'redirecting') return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    if (!name || !email) return setError(t(locale, 'fill_name_email'));
    if (tier && !termsAccepted) return setError(t(locale, 'accept_terms_required'));
    if (vatRegistered && !country) return setError(t(locale, 'vat_country_required'));
    setState('submitting');
    try {
      const common = { workspace_slug: workspaceSlug, email, name, locale, request_id: requestId, ...(country ? { country } : {}) };
      const body = tier
        ? {
            ...common,
            ...target.body,
            // The viewer's own ticks, never defaulted (consent stays real).
            directory_listed: listed,
            terms_accepted: termsAccepted,
            billing: readBillingFields(fd),
            ...(code ? { code } : {}),
          }
        : target.route.endsWith('/subscribe')
          ? // A subscription of its own takes the VAT number where the join
            // does: in `billing` (tax_no), for the Stripe customer and the
            // reverse-charge rule alike.
            { ...common, ...target.body, ...(vatNo.trim() ? { billing: { tax_no: vatNo.trim() } } : {}) }
          : { ...common, ...target.body, ...(vatNo.trim() ? { vat_id: vatNo.trim() } : {}) };
      const res = await publicFetch<{ url?: string | null; already_member?: boolean; already_purchased?: boolean; product_ids?: string[] }>(target.route, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (res.already_member) {
        setState('already');
        return;
      }
      if (res.already_purchased) {
        const owned = (res.product_ids ?? basket.productIds).map((id) => catalog.products.find((p) => p.id === id)?.name ?? '').filter(Boolean);
        setState('idle');
        setError(t(locale, 'basket_already_have', { names: owned.join(', ') }));
        return;
      }
      if (res.url) {
        setState('redirecting');
        redirectToCheckout(res.url);
        return;
      }
      setState('idle');
      setError(t(locale, 'something_wrong'));
    } catch (err) {
      setState('idle');
      const status = err instanceof PublicApiError ? err.status : 0;
      const b = err instanceof PublicApiError ? (err.body as { error?: unknown }) : null;
      // Several products against an API one release behind: it refuses
      // product_ids (400, a validation shape, not a sentence). Say "try again
      // in a minute" — never a quiet single-product purchase.
      if (status === 400 && 'product_ids' in (target.body as object) && typeof b?.error !== 'string') {
        setError(t(locale, 'basket_try_again'));
        return;
      }
      // A subscription against an API one release behind: the route does not
      // exist there yet (404). A batch promotes the web before the API, so for
      // those minutes the same sentence — never the generic one.
      if (status === 404 && target.route.endsWith('/subscribe')) {
        setError(t(locale, 'basket_try_again'));
        return;
      }
      setError(typeof b?.error === 'string' ? b.error : t(locale, 'something_wrong'));
    }
  }

  const portalPurchases = (() => {
    try {
      return `${new URL(membersAreaUrl).origin}/purchases`;
    } catch {
      return membersAreaUrl;
    }
  })();

  return (
    <form
      onSubmit={onSubmit}
      onChange={(e) => {
        const el = e.target as unknown as HTMLInputElement;
        if (el.name === 'billing_tax_no') setVatNo(el.value);
      }}
      className="space-y-2.5 text-sm"
    >
      {/* The country, asked once — a line when known, the picker when not. */}
      {vatRegistered && (
        editingCountry || !country ? (
          <SearchSelect
            value={country}
            onChange={(c) => {
              setCountry(c);
              setEditingCountry(false);
            }}
            options={COUNTRY_OPTIONS}
            placeholder={t(locale, 'country_question_vat')}
            className="w-full text-left"
          />
        ) : (
          <p className="text-xs text-ink-subtle">
            {countryName(country)} ·{' '}
            <button type="button" onClick={() => setEditingCountry(true)} className="underline underline-offset-2 hover:text-ink">
              {t(locale, 'country_change')}
            </button>
          </p>
        )
      )}
      <input name="name" placeholder={t(locale, 'your_name')} autoComplete="name" required className={INPUT} />
      <input name="email" type="email" placeholder={t(locale, 'email_placeholder')} autoComplete="email" required className={INPUT} />
      {tier ? (
        <details className="group rounded-md border border-line bg-surface px-3 py-2">
          <summary className="cursor-pointer list-none text-sm text-ink-subtle hover:text-ink">{t(locale, 'invoice_details_toggle')}</summary>
          <div className="mt-2.5 space-y-2.5">
            <InvoiceBillingFields
              inputClassName={INPUT}
              defaultCountry={country}
              whoPays={{ label: t(locale, 'who_pays'), myself: t(locale, 'who_pays_myself'), organisation: t(locale, 'who_pays_organisation') }}
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
      ) : (
        vatRegistered && (
          <input name="vat_id" value={vatNo} onChange={(e) => setVatNo(e.target.value)} placeholder={t(locale, 'vat_number_optional')} autoComplete="off" className={INPUT} />
        )
      )}
      {/* Consent: only with a membership — a products-only purchase asks what
          /public/buy needs and nothing more. Never pre-ticked. */}
      {tier && (
        <>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={listed} onChange={(e) => setListed(e.target.checked)} className="mt-0.5 accent-current" />
            <span className="min-w-0 flex-1">
              <span className="text-ink">
                {t(locale, 'show_me_in', { where: (tier.directory_categories ?? []).length ? tier.directory_categories!.join(', ') : t(locale, 'members_area_of', { community: workspaceName }) })}
              </span>
              <span className="mt-0.5 block text-xs text-ink-muted">{t(locale, 'show_me_in_note')}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-0.5 accent-current" />
            <span className="min-w-0 flex-1 text-ink">
              {t(locale, 'accept_terms_before')}{' '}
              <a href={terms.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:opacity-70">
                {terms.standard ? t(locale, 'terms_standard_name') : t(locale, 'terms_own_name', { community: workspaceName })}
              </a>
            </span>
          </label>
        </>
      )}
      {paySentence ? <p className="text-xs text-ink-subtle">{paySentence}</p> : <p className="text-xs text-ink-subtle">{t(locale, 'basket_total')} {amountLine}</p>}
      {state === 'already' && (
        <p className="rounded-md border border-line bg-surface px-3 py-2.5 text-ink">
          {t(locale, 'already_member_form')}{' '}
          <a href={portalPurchases} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:opacity-70">
            {t(locale, 'already_member_purchases_link')}
          </a>
        </p>
      )}
      {error && <p className="text-red-700 dark:text-red-400">{error}</p>}
      <Button type="submit" className="w-full" disabled={(tier ? !termsAccepted : false) || state === 'submitting' || state === 'redirecting'}>
        {state === 'redirecting' ? t(locale, 'taking_to_payment') : state === 'submitting' ? t(locale, 'one_moment') : t(locale, 'continue_to_payment')}
      </Button>
      <button type="button" onClick={onBack} className="w-full text-xs text-ink-muted hover:text-ink">
        {t(locale, 'basket_back')}
      </button>
    </form>
  );
}
