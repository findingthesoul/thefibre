'use client';

// Product cards (à-la-carte since 2026-09-06). Since the page basket
// (2026-10-16) a product's button ADDS it to the one basket — the per-product
// buy form, with its own name, email, country and VAT fields, is gone; the
// basket asks for all of that once (basket-provider.tsx). Prices are FLAT —
// the pricing logic is tier-scoped. Group headings (product groups) stay.

import { Check } from 'lucide-react';
import type { PublicProduct } from '@/lib/public-api';
import { money } from '@/lib/money';
import { t, type Locale } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { VatInclNote } from '@thefibre/shared/ui/vat-price';
import { addBlocker, netOf } from '@/lib/basket';
import { useBasket } from './basket-provider';

export function ProductGrid({
  products,
  locale = 'en',
  vatRegistered = false,
  groups = [],
}: {
  products: PublicProduct[];
  /** Product groups in their order (2026-10-16): a heading over each group's
   *  products; ungrouped ones last, under no heading. */
  groups?: { id: string; name: string }[];
  /** Prices are excl. VAT and this community adds it (2026-10-15). */
  vatRegistered?: boolean;
  /** Resolved server-side by the page (Thread pattern) — never from cookies. */
  locale?: Locale;
}) {
  const buyable = products.filter(
    (p) => p.purchasable && p.price_cents != null && p.price_cents > 0,
  );
  if (buyable.length === 0) return null;

  const colsFor = (n: number) =>
    n === 1
      ? 'sm:grid-cols-1 max-w-md mx-auto'
      : n === 2
        ? 'sm:grid-cols-2 max-w-2xl mx-auto'
        : 'sm:grid-cols-2 lg:grid-cols-3';
  const grid = (list: PublicProduct[]) => (
    <div className={`mt-6 grid grid-cols-1 gap-6 ${colsFor(list.length)}`}>
      {list.map((product) => (
        <ProductCard key={product.id} product={product} locale={locale} vatRegistered={vatRegistered} />
      ))}
    </div>
  );
  const known = new Set(groups.map((g) => g.id));
  const sections = groups
    .map((g) => ({ group: g, list: buyable.filter((p) => p.group_id === g.id) }))
    .filter((x) => x.list.length > 0);
  const ungrouped = buyable.filter((p) => !p.group_id || !known.has(p.group_id));

  return (
    <section className="mt-16">
      <h2 className="text-xl font-medium tracking-tight text-center">
        {t(locale, 'products_headline')}
      </h2>
      {sections.map(({ group, list }) => (
        <div key={group.id} className="mt-10">
          <h3 className="text-base font-medium tracking-tight text-center">{group.name}</h3>
          {grid(list)}
        </div>
      ))}
      {ungrouped.length > 0 && <div className={sections.length ? 'mt-10' : 'mt-2'}>{grid(ungrouped)}</div>}
    </section>
  );
}

function ProductCard({ product, locale, vatRegistered }: { product: PublicProduct; locale: Locale; vatRegistered: boolean }) {
  const { basket, catalog, noteRatePct, addProduct, removeProduct, openBasket } = useBasket();
  const currency = product.currency ?? 'EUR';
  const inBasket = basket.productIds.includes(product.id);
  const blocker = addBlocker(catalog, basket, product);
  const iv = product.price_interval ?? 'once';
  const incl = vatRegistered && !!product.price_includes_vat;

  return (
    <div className={`flex flex-col rounded-xl border bg-surface-raised p-6 ${inBasket ? 'border-line-strong' : 'border-line'}`}>
      <h3 className="text-lg font-medium">{product.name}</h3>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums">{money(product.price_cents!, currency)}</span>
        <span className="text-sm text-ink-subtle">
          {iv === 'once' ? t(locale, 'one_off') : t(locale, iv === 'month' ? 'per_month' : 'per_year')}
          {vatRegistered ? ` ${t(locale, incl ? 'incl_vat_suffix' : 'excl_vat_suffix')}` : ''}
        </span>
      </div>
      {incl ? (
        <p className="mt-0.5 text-xs tabular-nums text-ink-subtle">
          {t(locale, 'excl_vat_amount', { price: money(netOf(catalog, product.price_cents!, true), currency) })}
        </p>
      ) : (
        vatRegistered && <VatInclNote formatMoney={(c, cur) => money(c, cur)} netCents={product.price_cents!} ratePct={noteRatePct} currency={currency} locale={locale} className="mt-0.5" />
      )}

      {product.description && <p className="mt-3 text-sm text-ink-subtle leading-relaxed">{product.description}</p>}

      {(product.characteristics?.length ?? 0) > 0 && (
        <ul className="mt-4 space-y-1.5">
          {product.characteristics!.map((ch, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-ink-subtle">
              <Check size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-emerald-600" />
              {ch}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-5">
        {inBasket ? (
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={openBasket} className="text-sm font-medium text-ink">
              ✓ {t(locale, 'basket_in')}
            </button>
            <button type="button" onClick={() => removeProduct(product.id)} className="text-xs text-ink-muted underline underline-offset-2 hover:text-ink">
              {t(locale, 'basket_remove')}
            </button>
          </div>
        ) : blocker ? (
          // A recurring product rides a membership's subscription: without
          // one (or at another interval) it cannot be bought on its own.
          <Button type="button" className="w-full" disabled>
            {t(locale, 'basket_with_membership')}
          </Button>
        ) : (
          <Button type="button" className="w-full" onClick={() => addProduct(product.id)}>
            {t(locale, 'basket_add')}
          </Button>
        )}
      </div>
    </div>
  );
}
