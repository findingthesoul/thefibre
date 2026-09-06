'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n-ui';
import { createTier, patchTier, setTierProducts } from './actions';
import type { Tier } from './types';
import type { Product } from '../products/types';

const INPUT =
  'w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';

// Prices are entered in euros, stored in cents. Comma decimals welcome (nl).
function euroToCents(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
function centsToEuro(c: number | null): string {
  return c == null ? '' : String(c / 100);
}

export function TierDialog({
  tier,
  products,
  currency: workspaceCurrency,
  locale,
  nextSortOrder,
  onClose,
}: {
  tier: Tier | null; // null = new
  products: Product[];
  currency: import('@/lib/workspace-currency').WorkspaceCurrencies;
  locale: Locale;
  /** Where a NEW tier lands: the end of the list. Reordering is drag-and-drop on the list itself. */
  nextSortOrder: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(tier?.name ?? '');
  const [currency, setCurrency] = useState(tier?.currency ?? workspaceCurrency.default_currency);
  // A tier priced before the workspace list shrank keeps its currency —
  // offer it in the select so editing doesn't silently re-price.
  const currencyOptions = [...new Set([...workspaceCurrency.currencies, currency])];
  const [description, setDescription] = useState(tier?.description ?? '');
  const [priceYear, setPriceYear] = useState(centsToEuro(tier?.price_cents_year ?? null));
  const [priceMonth, setPriceMonth] = useState(centsToEuro(tier?.price_cents_month ?? null));
  const [characteristics, setCharacteristics] = useState((tier?.characteristics ?? []).join('\n'));
  const [productIds, setProductIds] = useState<Set<string>>(new Set(tier?.product_ids ?? []));
  // Optional add-ons (2026-09-06): offered as tick-boxes on the join page —
  // a product is Off, Included, or Optional, never two at once.
  const [optionalIds, setOptionalIds] = useState<Set<string>>(new Set(tier?.optional_product_ids ?? []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  // Dialog lists live products, plus any archived ones this tier still links
  // (so an old link stays visible and un-checkable).
  const selectable = products.filter(
    (p) => !p.archived_at || productIds.has(p.id) || optionalIds.has(p.id),
  );

  function setProductState(id: string, state: 'off' | 'included' | 'optional') {
    setProductIds((prev) => {
      const next = new Set(prev);
      if (state === 'included') next.add(id);
      else next.delete(id);
      return next;
    });
    setOptionalIds((prev) => {
      const next = new Set(prev);
      if (state === 'optional') next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!name.trim()) {
      setError(t(locale, 'name_required'));
      return;
    }
    setBusy(true);
    setError(null);
    const input = {
      name: name.trim(),
      currency,
      description: description.trim() || null,
      characteristics: characteristics
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
      price_cents_year: euroToCents(priceYear),
      price_cents_month: euroToCents(priceMonth),
      // Existing tiers keep their position; a new one joins at the end.
      sort_order: tier ? (tier.sort_order ?? 0) : nextSortOrder,
    };

    let tierId = tier?.id ?? null;
    if (tierId) {
      const res = await patchTier(tierId, input);
      if (res.error) {
        setError(res.error);
        setBusy(false);
        return;
      }
    } else {
      const res = await createTier(input);
      if (res.error || !res.data) {
        setError(res.error ?? t(locale, 'unknown_error'));
        setBusy(false);
        return;
      }
      tierId = res.data.id;
    }

    // Included products save as a second call — the tier row must exist first.
    const linkRes = await setTierProducts(tierId, [...productIds], [...optionalIds]);
    if (linkRes.error) {
      setError(t(locale, 'tier_saved_products_failed', { error: linkRes.error }));
      setBusy(false);
      return;
    }
    onClose();
    router.refresh();
  }

  async function handleArchive() {
    if (!tier) return;
    const unarchiving = Boolean(tier.archived_at);
    if (!unarchiving && !confirmArchive) {
      setConfirmArchive(true);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await patchTier(tier.id, { archived: !unarchiving });
    if (res.error) {
      setError(res.error);
      setBusy(false);
      setConfirmArchive(false);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={tier ? t(locale, 'edit_tier') : t(locale, 'new_tier')}
      size="lg"
      footer={
        <>
          {tier && (
            <Button
              type="button"
              variant="danger"
              className="mr-auto"
              disabled={busy}
              onClick={handleArchive}
            >
              {tier.archived_at
                ? t(locale, 'unarchive')
                : confirmArchive
                  ? t(locale, 'really_archive_q')
                  : t(locale, 'archive')}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="tier-form" disabled={busy}>
            {busy ? t(locale, 'saving') : t(locale, 'save')}
          </Button>
        </>
      }
    >
      <form id="tier-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'name')}</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(locale, 'tier_name_ph')}
            className={INPUT}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'description')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder={t(locale, 'optional_ph')}
            className={INPUT}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t(locale, 'yearly_price', { currency })}
            </label>
            <input
              value={priceYear}
              onChange={(e) => setPriceYear(e.target.value)}
              inputMode="decimal"
              placeholder={t(locale, 'price_year_ph')}
              className={INPUT}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {t(locale, 'monthly_price', { currency })}
            </label>
            <input
              value={priceMonth}
              onChange={(e) => setPriceMonth(e.target.value)}
              inputMode="decimal"
              placeholder={t(locale, 'optional_ph')}
              className={INPUT}
            />
          </div>
        </div>
        {currencyOptions.length > 1 && (
          <div>
            <label className="block text-sm font-medium mb-1">{t(locale, 'currency')}</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={`${INPUT} max-w-[10rem]`}
            >
              {currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-ink-muted">{t(locale, 'currency_hint')}</p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'characteristics')}</label>
          <textarea
            value={characteristics}
            onChange={(e) => setCharacteristics(e.target.value)}
            rows={4}
            placeholder={t(locale, 'tier_characteristics_ph')}
            className={INPUT}
          />
          <p className="mt-1.5 text-xs text-ink-muted">{t(locale, 'characteristics_hint')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'included_products')}</label>
          {selectable.length === 0 ? (
            <p className="text-sm text-ink-muted">{t(locale, 'no_products_create_first')}</p>
          ) : (
            <div className="rounded-md border border-line divide-y divide-line/60 max-h-52 overflow-y-auto">
              {selectable.map((p) => {
                const state = productIds.has(p.id)
                  ? 'included'
                  : optionalIds.has(p.id)
                    ? 'optional'
                    : 'off';
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2.5 px-3 py-2 text-sm hover:bg-surface-sunken"
                  >
                    <span className="text-ink">
                      {p.name}
                      {p.archived_at && (
                        <span className="ml-1.5 text-xs text-ink-muted">
                          {t(locale, 'archived_suffix')}
                        </span>
                      )}
                    </span>
                    <span className="flex rounded-md border border-line overflow-hidden text-xs">
                      {(['off', 'included', 'optional'] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setProductState(p.id, v)}
                          className={`px-2.5 py-1 ${
                            state === v
                              ? 'bg-ink text-surface'
                              : 'text-ink-subtle hover:text-ink'
                          }`}
                        >
                          {v === 'off'
                            ? t(locale, 'state_off')
                            : v === 'included'
                              ? t(locale, 'state_included')
                              : t(locale, 'state_optional')}
                        </button>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </Dialog>
  );
}
