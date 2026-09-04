'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/money';
import { patchProduct } from './actions';
import { ProductDialog } from './product-dialog';
import { LINK_KIND_LABELS, type Product } from './types';

export function ProductsClient({
  products,
  currency,
  threadOptions,
}: {
  products: Product[];
  currency: import("@/lib/workspace-currency").WorkspaceCurrencies;
  threadOptions: { slug: string; title: string }[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Local copy so a drag reorders instantly; props re-sync after refresh.
  const [items, setItems] = useState(products);
  useEffect(() => setItems(products), [products]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const archivedCount = items.filter((p) => p.archived_at).length;
  const visible = showArchived ? items : items.filter((p) => !p.archived_at);

  // Ordering is drag-and-drop, never a number field (Sjoerd, 2026-09-05).
  async function dropOn(target: number) {
    const from = dragIdx;
    setDragIdx(null);
    if (from === null || from === target) return;
    const list = [...visible];
    const [moved] = list.splice(from, 1);
    list.splice(target, 0, moved);
    setItems(showArchived ? list : [...list, ...items.filter((p) => p.archived_at)]);
    await Promise.all(
      list
        .map((p, i) => (p.sort_order === i * 10 ? null : patchProduct(p.id, { sort_order: i * 10 })))
        .filter(Boolean),
    );
    router.refresh();
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">Products</h1>
          <p className="mt-1 text-sm text-ink-muted">
            The things a membership is made of — a Circle space, a Thread, a call series. Bundle
            them into tiers under Tiers.
          </p>
        </div>
        <Button leading={<Plus size={16} strokeWidth={2} />} onClick={() => setCreating(true)}>
          New product
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
          {showArchived ? 'Hide archived' : `Show archived (${archivedCount})`}
        </button>
      )}

      {visible.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-surface-raised border border-line p-8 text-center">
          <p className="text-sm text-ink-muted">
            No products yet. Create the building blocks of your membership here, then include
            them in tiers.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {visible.map((p, i) => (
            <div
              key={p.id}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void dropOn(i)}
              onDragEnd={() => setDragIdx(null)}
              className={dragIdx === i ? 'opacity-50' : ''}
            >
              <ProductCard product={p} onEdit={setEditing} />
            </div>
          ))}
        </div>
      )}

      {creating && <ProductDialog product={null} currency={currency} threadOptions={threadOptions} nextSortOrder={items.length * 10} onClose={() => setCreating(false)} />}
      {editing && <ProductDialog product={editing} currency={currency} threadOptions={threadOptions} nextSortOrder={items.length * 10} onClose={() => setEditing(null)} />}
    </>
  );
}

function ProductCard({ product, onEdit }: { product: Product; onEdit: (p: Product) => void }) {
  const characteristics = product.characteristics ?? [];
  const links = product.links ?? [];
  return (
    <button
      type="button"
      onClick={() => onEdit(product)}
      className="w-full text-left rounded-2xl bg-surface-raised border border-line p-5 hover:bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong"
    >
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold tracking-tight text-ink">{product.name}</span>
          {product.archived_at && (
            <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted">
              Archived
            </span>
          )}
        </div>
        <div className="text-sm shrink-0">
          {product.price_cents != null ? (
            <span className="font-semibold text-ink">
              {money(product.price_cents, product.currency)}
            </span>
          ) : (
            <span className="text-ink-muted">Included in tier</span>
          )}
        </div>
      </div>
      {product.description && (
        <p className="mt-1.5 text-sm text-ink-muted">{product.description}</p>
      )}
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
      {links.length > 0 && (
        <div className="mt-3 text-xs text-ink-muted">
          {links.map((l) => l.label || `${LINK_KIND_LABELS[l.kind]} · ${l.ref}`).join(' · ')}
        </div>
      )}
    </button>
  );
}
