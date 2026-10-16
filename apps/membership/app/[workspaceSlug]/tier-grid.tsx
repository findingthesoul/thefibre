'use client';

// Tier cards. Since the page basket (2026-10-16) a tier is just another item:
// "Add to basket" puts it in the ONE basket (another tier replaces it), and
// the basket — not a dialog per card — asks for the details once and starts
// the one checkout (basket-provider.tsx). The join dialog that lived here,
// with its own basket step, country, code and invoicing fields, is gone: all
// of that is the basket's now, asked once for everything in it.
//
// Pricing logic (§3.9): the card shows the tier's price for the page's
// country through the SAME function the charge uses
// (@thefibre/shared/price-logic) — a price shown and a price taken may not
// come from two places.

import { Check } from 'lucide-react';
import { applyPct, evaluatePriceLogic, type PriceLogic } from '@thefibre/shared/price-logic';
import { VatInclNote } from '@thefibre/shared/ui/vat-price';
import { COUNTRY_OPTIONS } from '@thefibre/shared/countries';
import { SearchSelect } from '@thefibre/shared/ui/search-select';
import type { PublicProduct, PublicTier } from '@/lib/public-api';
import { money } from '@/lib/money';
import { t, type Locale } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { useBasket } from './basket-provider';

const pctFor = (logic: PriceLogic | null, country: string, interval: 'year' | 'month') =>
  evaluatePriceLogic(logic, { country, interval }).pct;

export function TierGrid({
  tiers,
  products,
  priceLogic = null,
  vatRegistered = false,
  locale = 'en',
}: {
  tiers: PublicTier[];
  products: PublicProduct[];
  priceLogic?: PriceLogic | null;
  vatRegistered?: boolean;
  locale?: Locale;
}) {
  // ONE country for the page, shared with the basket and the products.
  const { country, setCountry } = useBasket();
  const hasCountryRules = Boolean(priceLogic?.rules?.some((r) => r.when.attr === 'country'));
  const productNames = new Map(products.map((p) => [p.id, p.name]));
  const cols =
    tiers.length === 1
      ? 'sm:grid-cols-1 max-w-md mx-auto'
      : tiers.length === 2
        ? 'sm:grid-cols-2 max-w-2xl mx-auto'
        : 'sm:grid-cols-2 xl:grid-cols-3';

  return (
    <>
      {(hasCountryRules || vatRegistered) && (
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
            tier={tier}
            includedProducts={tier.product_ids.map((id) => productNames.get(id)).filter((n): n is string => Boolean(n))}
            priceLogic={priceLogic}
            vatRegistered={vatRegistered}
            locale={locale}
          />
        ))}
      </div>
    </>
  );
}

function TierCard({
  tier,
  includedProducts,
  priceLogic,
  vatRegistered,
  locale,
}: {
  tier: PublicTier;
  includedProducts: string[];
  priceLogic: PriceLogic | null;
  vatRegistered: boolean;
  locale: Locale;
}) {
  const { basket, country, noteRatePct, addTier, removeTier, openBasket } = useBasket();
  const currency = tier.currency ?? 'EUR';
  const hasYear = tier.price_cents_year != null && tier.price_cents_year > 0;
  const hasMonth = tier.price_cents_month != null && tier.price_cents_month > 0;
  // The tier's own rule where it has one — what the charge uses.
  const logicHere = (tier as PublicTier & { price_logic?: PriceLogic | null }).price_logic ?? priceLogic;
  const adjustedYear = hasYear ? applyPct(tier.price_cents_year!, pctFor(logicHere, country, 'year')) : null;
  const adjustedMonth = hasMonth ? applyPct(tier.price_cents_month!, pctFor(logicHere, country, 'month')) : null;
  const inBasket = basket.tierId === tier.id;

  return (
    <div className={`flex flex-col rounded-xl border bg-surface-raised p-6 ${inBasket ? 'border-line-strong' : 'border-line'}`}>
      <h2 className="text-lg font-medium">{tier.name}</h2>

      <div className="mt-2 flex items-baseline gap-1.5">
        {hasYear ? (
          <>
            <span className="text-2xl font-semibold tabular-nums">{money(adjustedYear!, currency)}</span>
            <span className="text-sm text-ink-subtle">
              {t(locale, 'per_year')}
              {vatRegistered ? ` ${t(locale, 'excl_vat_suffix')}` : ''}
            </span>
          </>
        ) : hasMonth ? (
          <>
            <span className="text-2xl font-semibold tabular-nums">{money(adjustedMonth!, currency)}</span>
            <span className="text-sm text-ink-subtle">
              {t(locale, 'per_month')}
              {vatRegistered ? ` ${t(locale, 'excl_vat_suffix')}` : ''}
            </span>
          </>
        ) : (
          <span className="text-sm text-ink-subtle">{t(locale, 'price_on_request')}</span>
        )}
      </div>
      {vatRegistered && (hasYear || hasMonth) && (
        <VatInclNote
          formatMoney={(c, cur) => money(c, cur)}
          netCents={hasYear ? adjustedYear! : adjustedMonth!}
          ratePct={noteRatePct}
          currency={currency}
          locale={locale}
          className="mt-0.5"
        />
      )}
      {hasYear && hasMonth && (
        <div className="mt-0.5 text-xs text-ink-muted">{t(locale, 'or_month', { price: money(adjustedMonth!, currency) })}</div>
      )}

      {tier.description && <p className="mt-3 text-sm text-ink-subtle leading-relaxed">{tier.description}</p>}

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
          <div className="text-[10px] uppercase tracking-wider text-ink-muted">{t(locale, 'includes')}</div>
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
        {inBasket ? (
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={openBasket} className="text-sm font-medium text-ink">
              ✓ {t(locale, 'basket_in')}
            </button>
            <button type="button" onClick={removeTier} className="text-xs text-ink-muted underline underline-offset-2 hover:text-ink">
              {t(locale, 'basket_remove')}
            </button>
          </div>
        ) : (
          <Button type="button" className="w-full" onClick={() => addTier(tier.id)} disabled={!hasYear && !hasMonth}>
            {t(locale, 'basket_add')}
          </Button>
        )}
      </div>
    </div>
  );
}
