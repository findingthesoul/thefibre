'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
  onClose,
}: {
  tier: Tier | null; // null = new
  products: Product[];
  currency: import('@/lib/workspace-currency').WorkspaceCurrencies;
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
  const [sortOrder, setSortOrder] = useState(String(tier?.sort_order ?? 0));
  const [productIds, setProductIds] = useState<Set<string>>(new Set(tier?.product_ids ?? []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  // Dialog lists live products, plus any archived ones this tier still links
  // (so an old link stays visible and un-checkable).
  const selectable = products.filter((p) => !p.archived_at || productIds.has(p.id));

  function toggleProduct(id: string) {
    setProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
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
      sort_order: parseInt(sortOrder, 10) || 0,
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
        setError(res.error ?? 'unknown error');
        setBusy(false);
        return;
      }
      tierId = res.data.id;
    }

    // Included products save as a second call — the tier row must exist first.
    const linkRes = await setTierProducts(tierId, [...productIds]);
    if (linkRes.error) {
      setError(`Tier saved, but products failed: ${linkRes.error}`);
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
      title={tier ? 'Edit tier' : 'New tier'}
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
              {tier.archived_at ? 'Unarchive' : confirmArchive ? 'Really archive?' : 'Archive'}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="tier-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="tier-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Supporter"
            className={INPUT}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Optional"
            className={INPUT}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Yearly price ({currency})</label>
            <input
              value={priceYear}
              onChange={(e) => setPriceYear(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 120"
              className={INPUT}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Monthly price ({currency})</label>
            <input
              value={priceMonth}
              onChange={(e) => setPriceMonth(e.target.value)}
              inputMode="decimal"
              placeholder="Optional"
              className={INPUT}
            />
          </div>
        </div>
        {currencyOptions.length > 1 && (
          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
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
            <p className="mt-1.5 text-xs text-ink-muted">
              The workspace&apos;s currencies — manage the list in Settings.
            </p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Characteristics</label>
          <textarea
            value={characteristics}
            onChange={(e) => setCharacteristics(e.target.value)}
            rows={4}
            placeholder={'One per line, e.g.\nMonthly community calls\nMember directory'}
            className={INPUT}
          />
          <p className="mt-1.5 text-xs text-ink-muted">
            One per line — shown as bullet points on the join page.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Included products</label>
          {selectable.length === 0 ? (
            <p className="text-sm text-ink-muted">No products yet — create them under Products.</p>
          ) : (
            <div className="rounded-md border border-line divide-y divide-line/60 max-h-52 overflow-y-auto">
              {selectable.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-surface-sunken"
                >
                  <input
                    type="checkbox"
                    checked={productIds.has(p.id)}
                    onChange={() => toggleProduct(p.id)}
                    className="accent-current"
                  />
                  <span className="text-ink">{p.name}</span>
                  {p.archived_at && <span className="text-xs text-ink-muted">(archived)</span>}
                </label>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Sort order</label>
          <input
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            inputMode="numeric"
            className={`${INPUT} max-w-[8rem]`}
          />
          <p className="mt-1.5 text-xs text-ink-muted">Lower numbers list first.</p>
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
