'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/money';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { patchTier } from './actions';
import { TierDialog } from './tier-dialog';
import type { Tier } from './types';
import type { Product } from '../products/types';
import type { WorkspaceCurrencies } from '@/lib/workspace-currency';

export function TiersClient({
  tiers,
  products,
  currency,
  locale,
}: {
  tiers: Tier[];
  products: Product[];
  currency: WorkspaceCurrencies;
  locale: Locale;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Tier | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Local copy so a drag reorders instantly; props re-sync after refresh.
  const [items, setItems] = useState(tiers);
  useEffect(() => setItems(tiers), [tiers]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const archivedCount = items.filter((x) => x.archived_at).length;
  const visible = showArchived ? items : items.filter((x) => !x.archived_at);

  // Ordering is drag-and-drop, never a number field (Sjoerd, 2026-09-05).
  // Drop → splice locally → persist sort_order = index*10 for what moved.
  async function dropOn(target: number) {
    const from = dragIdx;
    setDragIdx(null);
    if (from === null || from === target) return;
    const list = [...visible];
    const [moved] = list.splice(from, 1);
    list.splice(target, 0, moved);
    // Archived items keep their positions; only the visible order persists.
    setItems(showArchived ? list : [...list, ...items.filter((x) => x.archived_at)]);
    await Promise.all(
      list
        .map((x, i) => (x.sort_order === i * 10 ? null : patchTier(x.id, { sort_order: i * 10 })))
        .filter(Boolean),
    );
    router.refresh();
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">
            {t(locale, 'nav_tiers')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{t(locale, 'tiers_blurb')}</p>
        </div>
        <Button leading={<Plus size={16} strokeWidth={2} />} onClick={() => setCreating(true)}>
          {t(locale, 'new_tier')}
        </Button>
      </div>

      {archivedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className={`mt-4 inline-flex items-center rounded-full border px-3 py-1 text-xs transition-colors ${
            showArchived
              ? 'border-ink bg-ink text-ink-inverse'
              : 'border-line text-ink-subtle hover:text-ink'
          }`}
        >
          {showArchived
            ? t(locale, 'hide_archived')
            : t(locale, 'show_archived', { n: archivedCount })}
        </button>
      )}

      {visible.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-surface-raised border border-line p-8 text-center">
          <p className="text-sm text-ink-muted">{t(locale, 'tiers_empty')}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {visible.map((x, i) => (
            <div
              key={x.id}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void dropOn(i)}
              onDragEnd={() => setDragIdx(null)}
              className={dragIdx === i ? 'opacity-50' : ''}
            >
              <TierCard tier={x} locale={locale} onEdit={setEditing} />
            </div>
          ))}
        </div>
      )}

      {creating && (
        <TierDialog tier={null} products={products} currency={currency} locale={locale} nextSortOrder={items.length * 10} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <TierDialog tier={editing} products={products} currency={currency} locale={locale} nextSortOrder={items.length * 10} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function TierCard({
  tier,
  locale,
  onEdit,
}: {
  tier: Tier;
  locale: Locale;
  onEdit: (t: Tier) => void;
}) {
  const characteristics = tier.characteristics ?? [];
  const intl = INTL_LOCALES[locale];
  return (
    <button
      type="button"
      onClick={() => onEdit(tier)}
      className="w-full text-left rounded-2xl bg-surface-raised border border-line p-5 hover:bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong"
    >
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold tracking-tight text-ink">{tier.name}</span>
          {tier.archived_at && (
            <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted">
              {t(locale, 'archived')}
            </span>
          )}
        </div>
        <div className="text-sm text-ink shrink-0">
          {tier.price_cents_year != null && (
            <span className="font-semibold">
              {money(tier.price_cents_year, tier.currency, intl)} {t(locale, 'per_year')}
            </span>
          )}
          {tier.price_cents_month != null && (
            <span className="text-ink-subtle">
              {tier.price_cents_year != null && ' · '}
              {money(tier.price_cents_month, tier.currency, intl)} {t(locale, 'per_month')}
            </span>
          )}
          {tier.price_cents_year == null && tier.price_cents_month == null && (
            <span className="text-ink-muted">{t(locale, 'no_price_set')}</span>
          )}
        </div>
      </div>
      {tier.description && <p className="mt-1.5 text-sm text-ink-muted">{tier.description}</p>}
      {characteristics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {characteristics.map((c, i) => (
            <span
              key={i}
              className="rounded-full bg-surface-sunken border border-line px-2.5 py-0.5 text-xs text-ink-subtle"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 text-xs text-ink-muted">
        {tier.product_ids.length === 1
          ? t(locale, 'one_product_included')
          : t(locale, 'n_products_included', { n: tier.product_ids.length })}
      </div>
    </button>
  );
}
