'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, GripVertical, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/money';
import { t, INTL_LOCALES, type Locale, type UiKey } from '@/lib/i18n-ui';
import { grantSummary } from '@/lib/grant-summary';
import { createProductGroup, orderProductGroups, patchProduct, patchProductGroup, type ProductGroup } from './actions';
import { ProductDialog } from './product-dialog';
import type { LinkKind, Product } from './types';

const LINK_KIND_KEYS: Record<LinkKind, UiKey> = {
  thread: 'link_kind_thread',
  meet: 'link_kind_meet',
  circle_space: 'link_kind_circle_space',
  url: 'link_kind_url',
};

/** One sentence per grant, from the one place that decides what a grant
 *  says (lib/grant-summary.ts). */
function accessLine(
  grants: import('../access/types').Grant[],
  locale: Locale,
  teams: import('../access/types').TeamOption[],
): string {
  return grants.map((g) => grantSummary(g, locale, teams)).join(' \u00b7 ');
}

export function ProductsClient({
  products,
  groups: initialGroups,
  vatRegistered = false,
  currency,
  threadOptions,
  teamOptions,
  grants,
  categories,
  categoryLinks,
  locale,
}: {
  products: Product[];
  /** Product groups (2026-10-16), live, in order — organising only. */
  groups: ProductGroup[];
  /** The "Price includes VAT" switch is shown only to a VAT-registered community. */
  vatRegistered?: boolean;
  currency: import("@/lib/workspace-currency").WorkspaceCurrencies;
  threadOptions: { slug: string; title: string }[];
  /** The workspace's teams — a team-calendar grant stores an id and shows a
   *  name, here and in the dialog. */
  teamOptions: import('../access/types').TeamOption[];
  grants: import('../access/types').Grant[];
  /** The workspace's directory vocabulary (slice 1) — live categories only. */
  categories: import('../settings/shared').DirectoryCategory[];
  /** Every product->category link; filtered per product, like grants. */
  categoryLinks: import('./types').ProductCategoryLink[];
  locale: Locale;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Local copies so a drag reorders instantly; props re-sync after refresh.
  const [items, setItems] = useState(products);
  useEffect(() => setItems(products), [products]);
  const [groups, setGroups] = useState(initialGroups);
  useEffect(() => setGroups(initialGroups), [initialGroups]);
  // What is being dragged: a product (into a place, in any group) or a group
  // (to reorder groups). Ordering is drag-and-drop, never a number field
  // (Sjoerd, 2026-09-05).
  const [drag, setDrag] = useState<{ kind: 'product' | 'group'; id: string } | null>(null);
  const [newGroup, setNewGroup] = useState('');
  const [error, setError] = useState<string | null>(null);

  const archivedCount = items.filter((p) => p.archived_at).length;
  const visible = showArchived ? items : items.filter((p) => !p.archived_at);
  const liveGroupIds = new Set(groups.map((g) => g.id));
  /** The products listed under a group (null = not in any). */
  const inGroup = (gid: string | null) =>
    visible.filter((p) => (p.group_id && liveGroupIds.has(p.group_id) ? p.group_id : null) === gid);

  /** Drop the dragged product into group `gid`, before product `beforeId`
   *  (or at the end). Writes only what changed: its group, and the order of
   *  the list it lands in. */
  async function dropProduct(gid: string | null, beforeId: string | null) {
    const d = drag;
    setDrag(null);
    if (!d || d.kind !== 'product' || d.id === beforeId) return;
    const moved = items.find((p) => p.id === d.id);
    if (!moved) return;
    const target = inGroup(gid).filter((p) => p.id !== d.id);
    const at = beforeId ? target.findIndex((p) => p.id === beforeId) : target.length;
    target.splice(at < 0 ? target.length : at, 0, { ...moved, group_id: gid });
    const order = new Map(target.map((p, i) => [p.id, i * 10]));
    setItems((all) => all.map((p) => (order.has(p.id) ? { ...p, group_id: gid, sort_order: order.get(p.id)! } : p)));
    const writes = target
      .map((p) => {
        const before = items.find((x) => x.id === p.id)!;
        const patch: { sort_order?: number; group_id?: string | null } = {};
        if (before.sort_order !== order.get(p.id)) patch.sort_order = order.get(p.id);
        if ((before.group_id ?? null) !== gid) patch.group_id = gid;
        return Object.keys(patch).length ? patchProduct(p.id, patch) : null;
      })
      .filter(Boolean);
    const results = await Promise.all(writes);
    const failed = results.find((r) => r && r.error);
    if (failed?.error) setError(failed.error);
    router.refresh();
  }

  async function dropGroup(beforeId: string) {
    const d = drag;
    setDrag(null);
    if (!d || d.kind !== 'group' || d.id === beforeId) return;
    const list = groups.filter((g) => g.id !== d.id);
    const moved = groups.find((g) => g.id === d.id)!;
    list.splice(list.findIndex((g) => g.id === beforeId), 0, moved);
    setGroups(list);
    const r = await orderProductGroups(list.map((g) => g.id));
    if (r.error) {
      setGroups(groups);
      setError(r.error);
    }
  }

  async function addGroup() {
    const name = newGroup.trim();
    if (!name) return;
    const r = await createProductGroup(name);
    if (r.error || !r.data) return setError(r.error ?? 'could not create the group');
    setGroups((g) => [...g, r.data!]);
    setNewGroup('');
  }

  async function renameGroup(id: string, name: string) {
    const r = await patchProductGroup(id, { name });
    if (r.error) setError(r.error);
    else setGroups((g) => g.map((x) => (x.id === id ? { ...x, name } : x)));
  }

  async function archiveGroup(g: ProductGroup) {
    if (!window.confirm(t(locale, 'pg_archive_confirm', { name: g.name }))) return;
    const r = await patchProductGroup(g.id, { archived: true });
    if (r.error) return setError(r.error);
    setGroups((all) => all.filter((x) => x.id !== g.id));
    setItems((all) => all.map((p) => (p.group_id === g.id ? { ...p, group_id: null } : p)));
    router.refresh();
  }

  const productList = (gid: string | null) => {
    const list = inGroup(gid);
    return (
      <div
        className="space-y-4 min-h-12"
        onDragOver={(e) => drag?.kind === 'product' && e.preventDefault()}
        // Any drop that reaches the LIST (the empty-group placeholder, the gap
        // between cards) appends to this group; a drop on a card stops at the
        // card and lands before it. Checking target === currentTarget here
        // ignored a drop on the placeholder text — an empty group could not
        // be filled (found by e2e/product-groups.spec.ts, 2026-10-16).
        onDrop={(e) => {
          e.preventDefault();
          void dropProduct(gid, null);
        }}
      >
        {list.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-center text-xs text-ink-muted">
            {t(locale, 'pg_drop_here')}
          </p>
        )}
        {list.map((p) => (
          <div
            key={p.id}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              setDrag({ kind: 'product', id: p.id });
            }}
            onDragOver={(e) => drag?.kind === 'product' && e.preventDefault()}
            onDrop={(e) => {
              e.stopPropagation();
              void dropProduct(gid, p.id);
            }}
            onDragEnd={() => setDrag(null)}
            className={drag?.kind === 'product' && drag.id === p.id ? 'opacity-50' : ''}
          >
            <ProductCard product={p} productGrants={grants.filter((g) => g.product_id === p.id)} teamOptions={teamOptions} locale={locale} onEdit={setEditing} />
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">
            {t(locale, 'nav_products')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{t(locale, 'products_blurb')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button leading={<Plus size={16} strokeWidth={2} />} onClick={() => setCreating(true)}>
            {t(locale, 'new_product')}
          </Button>
        </div>
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

      {error && <p className="mt-4 text-sm text-red-700 dark:text-red-400">{error}</p>}

      {visible.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-surface-raised border border-line p-8 text-center">
          <p className="text-sm text-ink-muted">{t(locale, 'products_empty')}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {groups.map((g) => (
            <section
              key={g.id}
              onDragOver={(e) => drag?.kind === 'group' && e.preventDefault()}
              onDrop={() => drag?.kind === 'group' && void dropGroup(g.id)}
              className={drag?.kind === 'group' && drag.id === g.id ? 'opacity-50' : ''}
            >
              <div
                className="mb-3 flex items-center gap-2"
                draggable
                onDragStart={() => setDrag({ kind: 'group', id: g.id })}
                onDragEnd={() => setDrag(null)}
              >
                <GripVertical size={16} className="shrink-0 cursor-grab text-ink-muted" aria-hidden />
                <input
                  defaultValue={g.name}
                  aria-label={t(locale, 'pg_name_ph')}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== g.name) void renameGroup(g.id, v);
                  }}
                  className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-base font-semibold text-ink hover:border-line focus:border-line-strong focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void archiveGroup(g)}
                  aria-label={t(locale, 'pg_archive')}
                  title={t(locale, 'pg_archive')}
                  className="shrink-0 rounded-md p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"
                >
                  <Archive size={15} aria-hidden />
                </button>
              </div>
              {productList(g.id)}
            </section>
          ))}
          <section>
            {groups.length > 0 && (
              <h2 className="mb-3 px-2 text-sm font-medium text-ink-muted">{t(locale, 'pg_ungrouped')}</h2>
            )}
            {productList(null)}
          </section>
        </div>
      )}

      {/* New product group — and what a group is (and is not). */}
      <div className="mt-8 rounded-2xl border border-line bg-surface-raised p-4">
        <div className="flex gap-2">
          <input
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addGroup()}
            placeholder={t(locale, 'pg_name_ph')}
            className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none"
          />
          <Button variant="secondary" leading={<Plus size={16} strokeWidth={2} />} onClick={() => void addGroup()} disabled={!newGroup.trim()}>
            {t(locale, 'pg_new_group')}
          </Button>
        </div>
        <p className="mt-2 text-xs text-ink-muted">{t(locale, 'pg_help')}</p>
      </div>

      {creating && <ProductDialog product={null} currency={currency} threadOptions={threadOptions} teamOptions={teamOptions} grants={[]} categories={categories} productCategoryIds={[]} vatRegistered={vatRegistered} locale={locale} nextSortOrder={items.length * 10} onClose={() => setCreating(false)} />}
      {editing && <ProductDialog product={editing} currency={currency} threadOptions={threadOptions} teamOptions={teamOptions} grants={grants.filter((g) => g.product_id === editing.id)} categories={categories} productCategoryIds={categoryLinks.filter((l) => l.product_id === editing.id).map((l) => l.category_id)} vatRegistered={vatRegistered} locale={locale} nextSortOrder={items.length * 10} onClose={() => setEditing(null)} />}
    </>
  );
}

function ProductCard({
  product,
  productGrants,
  teamOptions,
  locale,
  onEdit,
}: {
  product: Product;
  productGrants: import('../access/types').Grant[];
  teamOptions: import('../access/types').TeamOption[];
  locale: Locale;
  onEdit: (p: Product) => void;
}) {
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
          {product.purchasable && (
            <span className="rounded-full border border-emerald-300/60 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
              {t(locale, 'buyable')}
            </span>
          )}
          {product.archived_at && (
            <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted">
              {t(locale, 'archived')}
            </span>
          )}
        </div>
        <div className="text-sm shrink-0">
          {product.price_cents != null ? (
            <span className="font-semibold text-ink">
              {money(product.price_cents, product.currency, INTL_LOCALES[locale])}
            </span>
          ) : (
            <span className="text-ink-muted">{t(locale, 'included_in_tier')}</span>
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
      {productGrants.length > 0 && (
        <div className="mt-2 text-xs text-emerald-800 dark:text-emerald-300">
          {t(locale, 'unlocks_prefix', { list: accessLine(productGrants, locale, teamOptions) })}
        </div>
      )}
      {links.length > 0 && (
        <div className="mt-3 text-xs text-ink-muted">
          {links.map((l) => l.label || `${t(locale, LINK_KIND_KEYS[l.kind])} · ${l.ref}`).join(' · ')}
        </div>
      )}
    </button>
  );
}
