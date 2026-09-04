'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/money';
import { TierDialog } from './tier-dialog';
import type { Tier } from './types';
import type { Product } from '../products/types';
import type { WorkspaceCurrencies } from '@/lib/workspace-currency';

export function TiersClient({
  tiers,
  products,
  currency,
}: {
  tiers: Tier[];
  products: Product[];
  currency: WorkspaceCurrencies;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Tier | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const archivedCount = tiers.filter((t) => t.archived_at).length;
  const visible = showArchived ? tiers : tiers.filter((t) => !t.archived_at);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">Tiers</h1>
          <p className="mt-1 text-sm text-ink-muted">
            The membership levels your community can join at. Each tier bundles products and
            unlocks access (see Access).
          </p>
        </div>
        <Button leading={<Plus size={16} strokeWidth={2} />} onClick={() => setCreating(true)}>
          New tier
        </Button>
      </div>

      {archivedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className={`mt-4 inline-flex items-center rounded-full border px-3 py-1 text-xs transition-colors ${
            showArchived
              ? 'border-line-strong bg-surface-sunken text-ink'
              : 'border-line text-ink-subtle hover:text-ink'
          }`}
        >
          {showArchived ? 'Hide archived' : `Show archived (${archivedCount})`}
        </button>
      )}

      {visible.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-surface-raised border border-line p-8 text-center">
          <p className="text-sm text-ink-muted">
            No tiers yet. Create your first tier — e.g. Supporter, Member, Patron — and set what
            each one costs per year.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {visible.map((t) => (
            <TierCard key={t.id} tier={t} onEdit={setEditing} />
          ))}
        </div>
      )}

      {creating && (
        <TierDialog tier={null} products={products} currency={currency} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <TierDialog tier={editing} products={products} currency={currency} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function TierCard({ tier, onEdit }: { tier: Tier; onEdit: (t: Tier) => void }) {
  const characteristics = tier.characteristics ?? [];
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
              Archived
            </span>
          )}
        </div>
        <div className="text-sm text-ink shrink-0">
          {tier.price_cents_year != null && (
            <span className="font-semibold">
              {money(tier.price_cents_year, tier.currency)} / year
            </span>
          )}
          {tier.price_cents_month != null && (
            <span className="text-ink-subtle">
              {tier.price_cents_year != null && ' · '}
              {money(tier.price_cents_month, tier.currency)} / month
            </span>
          )}
          {tier.price_cents_year == null && tier.price_cents_month == null && (
            <span className="text-ink-muted">No price set</span>
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
          ? '1 product included'
          : `${tier.product_ids.length} products included`}
      </div>
    </button>
  );
}
