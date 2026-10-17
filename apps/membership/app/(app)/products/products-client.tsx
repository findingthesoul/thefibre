'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, CalendarDays, CircleDot, GripVertical, Link2, Mail, Pencil, Plus, Spline, UserCheck, Video } from 'lucide-react';
import type { ReactNode } from 'react';
import { ActionsMenu } from '@thefibre/shared/ui/actions-menu';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/money';
import { PILL, PILL_TONE, ROW_LIST } from '@thefibre/shared/ui/recipes';
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
  tierOptions = [],
  tierLinks = [],
  tierIncludedLinks = [],
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
  tierOptions?: { id: string; name: string }[];
  tierLinks?: { tier_id: string; product_id: string }[];
  tierIncludedLinks?: { tier_id: string; product_id: string }[];
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
  const [addingGroup, setAddingGroup] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
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

  // Busy while the group is being made (2026-10-17 audit): the button showed
  // nothing until the server answered, and a second click made a second
  // group with the same name.
  const [creatingGroup, setCreatingGroup] = useState(false);
  async function addGroup() {
    const name = newGroup.trim();
    if (!name || creatingGroup) return;
    setCreatingGroup(true);
    try {
      const r = await createProductGroup(name);
      if (r.error || !r.data) return setError(r.error ?? 'could not create the group');
      setGroups((g) => [...g, r.data!]);
      setNewGroup('');
      setAddingGroup(false);
    } finally {
      setCreatingGroup(false);
    }
  }

  // The new name shows at once and goes back only if the save fails (it used
  // to flash back to the old name until the server answered, which read as
  // a rename that had not taken).
  async function renameGroup(id: string, name: string) {
    const before = groups;
    setGroups((g) => g.map((x) => (x.id === id ? { ...x, name } : x)));
    const r = await patchProductGroup(id, { name });
    if (r.error) {
      setGroups(before);
      setError(r.error);
    }
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
        className="min-h-12"
        onDragOver={(e) => drag?.kind === 'product' && e.preventDefault()}
        // Any drop that reaches the LIST (the empty-group placeholder, the gap
        // between rows) appends to this group; a drop on a row stops at the
        // row and lands before it. Checking target === currentTarget here
        // ignored a drop on the placeholder text — an empty group could not
        // be filled (found by e2e/product-groups.spec.ts, 2026-10-16).
        onDrop={(e) => {
          e.preventDefault();
          void dropProduct(gid, null);
        }}
      >
        {list.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-center text-xs text-ink-muted">
            {t(locale, 'pg_drop_here')}
          </p>
        ) : (
          // One ROW per product (2026-10-16, Sjoerd: denser). The shared row
          // list: edge to edge on a phone, a card from sm.
          <ul className={ROW_LIST}>
            {list.map((p) => (
              <li
                key={p.id}
                data-product={p.name}
                onDragOver={(e) => drag?.kind === 'product' && e.preventDefault()}
                onDrop={(e) => {
                  e.stopPropagation();
                  void dropProduct(gid, p.id);
                }}
                className={`flex items-stretch ${drag?.kind === 'product' && drag.id === p.id ? 'opacity-50' : ''}`}
              >
                {/* The handle is its OWN target: only it starts a drag, and a
                    click on the row never does — nor does a drag open the
                    dialog (coordinator, 2026-10-16). */}
                <span
                  draggable
                  role="button"
                  tabIndex={-1}
                  aria-label={t(locale, 'pg_move', { name: p.name })}
                  title={t(locale, 'pg_move', { name: p.name })}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    const row = (e.currentTarget as HTMLElement).closest('li');
                    if (row) e.dataTransfer.setDragImage(row, 16, 16);
                    setDrag({ kind: 'product', id: p.id });
                  }}
                  onDragEnd={() => setDrag(null)}
                  className="flex shrink-0 cursor-grab items-center pl-2 pr-1 text-ink-muted hover:text-ink sm:pl-3"
                >
                  <GripVertical size={16} aria-hidden />
                </span>
                <ProductRow
                  product={p}
                  productGrants={grants.filter((g) => g.product_id === p.id)}
                  teamOptions={teamOptions}
                  offeredWith={tierLinks.filter((l) => l.product_id === p.id).map((l) => tierOptions.find((x) => x.id === l.tier_id)?.name).filter((n): n is string => !!n)}
                  includedIn={tierIncludedLinks.filter((l) => l.product_id === p.id).map((l) => tierOptions.find((x) => x.id === l.tier_id)?.name).filter((n): n is string => !!n)}
                  vatRegistered={vatRegistered}
                  locale={locale}
                  onEdit={setEditing}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">
            {t(locale, 'nav_products')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{t(locale, 'products_blurb')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" className="whitespace-nowrap" leading={<Plus size={16} strokeWidth={2} />} onClick={() => setAddingGroup((v) => !v)}>
            {t(locale, 'pg_new_group')}
          </Button>
          <Button className="whitespace-nowrap" leading={<Plus size={16} strokeWidth={2} />} onClick={() => setCreating(true)}>
            {t(locale, 'new_product')}
          </Button>
        </div>
      </div>

      {/* New product group — one field, and what a group is (and is not). */}
      {addingGroup && (
        <div className="mt-4 rounded-2xl border border-line bg-surface-raised p-4">
          <div className="flex gap-2">
            <input
              autoFocus
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void addGroup();
                if (e.key === 'Escape') setAddingGroup(false);
              }}
              placeholder={t(locale, 'pg_name_ph')}
              className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none"
            />
            <Button variant="secondary" onClick={() => void addGroup()} disabled={!newGroup.trim()} pending={creatingGroup}>
              {t(locale, 'pg_new_group')}
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">{t(locale, 'pg_help')}</p>
        </div>
      )}

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
              data-group={g.name}
              onDragOver={(e) => drag?.kind === 'group' && e.preventDefault()}
              onDrop={() => drag?.kind === 'group' && void dropGroup(g.id)}
              className={drag?.kind === 'group' && drag.id === g.id ? 'opacity-50' : ''}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  draggable
                  role="button"
                  tabIndex={-1}
                  aria-label={t(locale, 'pg_move', { name: g.name })}
                  title={t(locale, 'pg_move', { name: g.name })}
                  onDragStart={() => setDrag({ kind: 'group', id: g.id })}
                  onDragEnd={() => setDrag(null)}
                  className="shrink-0 cursor-grab text-ink-muted hover:text-ink"
                >
                  <GripVertical size={16} aria-hidden />
                </span>
                <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-ink-muted">{t(locale, 'pg_label')}</span>
                {renaming === g.id ? (
                  <input
                    autoFocus
                    defaultValue={g.name}
                    aria-label={t(locale, 'pg_name_ph')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      setRenaming(null);
                      if (v && v !== g.name) void renameGroup(g.id, v);
                    }}
                    className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-base font-semibold text-ink focus:border-line-strong focus:outline-none"
                  />
                ) : (
                  <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{g.name}</h2>
                )}
                <ActionsMenu
                  label={t(locale, 'pg_options')}
                  items={[
                    { label: t(locale, 'pg_rename'), icon: <Pencil size={14} aria-hidden />, onSelect: () => setRenaming(g.id) },
                    { label: t(locale, 'pg_archive'), icon: <Archive size={14} aria-hidden />, onSelect: () => archiveGroup(g), destructive: true },
                  ]}
                />
              </div>
              {productList(g.id)}
            </section>
          ))}
          <section>
            {groups.length > 0 && (
              <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">{t(locale, 'pg_ungrouped')}</h2>
            )}
            {productList(null)}
          </section>
        </div>
      )}

      {creating && <ProductDialog product={null} currency={currency} threadOptions={threadOptions} teamOptions={teamOptions} grants={[]} categories={categories} productCategoryIds={[]} tierOptions={tierOptions} productTierIds={[]} vatRegistered={vatRegistered} locale={locale} nextSortOrder={items.length * 10} onClose={() => setCreating(false)} />}
      {editing && <ProductDialog product={editing} currency={currency} threadOptions={threadOptions} teamOptions={teamOptions} grants={grants.filter((g) => g.product_id === editing.id)} categories={categories} productCategoryIds={categoryLinks.filter((l) => l.product_id === editing.id).map((l) => l.category_id)} tierOptions={tierOptions} productTierIds={tierLinks.filter((l) => l.product_id === editing.id).map((l) => l.tier_id)} vatRegistered={vatRegistered} locale={locale} nextSortOrder={items.length * 10} onClose={() => setEditing(null)} />}
    </>
  );
}

/** Who may have it, by THE rule (2026-10-16): a renewing product is sold on
 *  its own only when opened (sold_without_membership); a one-off when it is
 *  purchasable. Anything else comes with a membership. */
function soldAlone(p: Product): boolean {
  const recurring = (p.price_interval ?? 'once') !== 'once';
  return recurring ? !!p.purchasable && !!p.sold_without_membership : !!p.purchasable;
}

const GRANT_ICON: Record<import('../access/types').GrantKind, ReactNode> = {
  circle: <CircleDot size={14} aria-hidden />,
  thread: <Spline size={14} aria-hidden />,
  team_calendar: <CalendarDays size={14} aria-hidden />,
  fibre_seat: <UserCheck size={14} aria-hidden />,
  google_user: <Mail size={14} aria-hidden />,
};
const LINK_ICON: Record<LinkKind, ReactNode> = {
  thread: <Spline size={14} aria-hidden />,
  meet: <Video size={14} aria-hidden />,
  circle_space: <CircleDot size={14} aria-hidden />,
  url: <Link2 size={14} aria-hidden />,
};
/** How many things a row names before "+N more". The full list stays one
 *  click away in the dialog (and in the tooltip on a desktop). */
const UNLOCKS_SHOWN = 4;
const TRAITS_SHOWN = 3;

function ProductRow({
  product,
  productGrants,
  teamOptions,
  offeredWith = [],
  includedIn = [],
  vatRegistered = false,
  locale,
  onEdit,
}: {
  product: Product;
  productGrants: import('../access/types').Grant[];
  teamOptions: import('../access/types').TeamOption[];
  /** Tiers that offer it as an optional extra. */
  offeredWith?: string[];
  /** Tiers that include it. */
  includedIn?: string[];
  vatRegistered?: boolean;
  locale: Locale;
  onEdit: (p: Product) => void;
}) {
  const interval = product.price_interval ?? 'once';
  const characteristics = product.characteristics ?? [];
  const links = product.links ?? [];
  // What it unlocks, grants and links in one line: an icon and a short label
  // each, the full sentence in the tooltip.
  const unlocks: { key: string; icon: ReactNode; short: string; full: string }[] = [
    ...productGrants.map((g) => ({
      key: `g-${g.id}`,
      icon: GRANT_ICON[g.kind],
      short: t(locale, `grant_kind_${g.kind}` as UiKey),
      full: grantSummary(g, locale, teamOptions),
    })),
    ...links.map((l, i) => ({
      key: `l-${i}`,
      icon: LINK_ICON[l.kind],
      short: l.label || t(locale, LINK_KIND_KEYS[l.kind]),
      full: l.label || `${t(locale, LINK_KIND_KEYS[l.kind])} · ${l.ref}`,
    })),
  ];
  const shown = unlocks.slice(0, UNLOCKS_SHOWN);
  const rest = unlocks.slice(UNLOCKS_SHOWN);
  // The "what it is" line, the same shape on every row: description, then
  // the characteristics, one line.
  const traits = characteristics.slice(0, TRAITS_SHOWN);
  const moreTraits = characteristics.length - traits.length;
  const about = [product.description, ...traits].filter(Boolean).join(' · ');
  const aboutFull = [product.description, ...characteristics].filter(Boolean).join(' · ');
  const price =
    product.price_cents != null ? (
      <span className="text-ink">
        <span className="font-semibold">{money(product.price_cents, product.currency, INTL_LOCALES[locale])}</span>
        {/* The unit and the VAT basis, so "€2,000" says what it is. */}
        <span className="text-ink-muted">
          {' '}
          {t(locale, interval === 'year' ? 'price_per_year' : interval === 'month' ? 'price_per_month' : interval === 'week' ? 'price_per_week' : 'price_one_off')}
          {vatRegistered ? ` · ${t(locale, product.price_includes_vat ? 'price_incl_vat' : 'price_excl_vat')}` : ''}
        </span>
      </span>
    ) : (
      <span className="text-ink-muted">{t(locale, 'included_in_tier')}</span>
    );
  return (
    <button
      type="button"
      onClick={() => onEdit(product)}
      className="min-w-0 flex-1 py-3 pl-1 pr-4 text-left hover:bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-strong sm:pr-5"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="truncate text-sm font-semibold text-ink">{product.name}</span>
          {/* What the rule says, not "Buyable" (which stopped meaning one
              thing on 2026-10-16). */}
          <span className={`${PILL} ${soldAlone(product) ? PILL_TONE.positive : PILL_TONE.neutral}`}>
            {t(locale, soldAlone(product) ? 'product_badge_sold_alone' : 'product_badge_members_only')}
          </span>
          {offeredWith.length > 0 && (
            <span className={`${PILL} ${PILL_TONE.neutral}`}>{t(locale, 'product_badge_addon_for', { tiers: offeredWith.join(', ') })}</span>
          )}
          {includedIn.length > 0 && (
            <span className={`${PILL} ${PILL_TONE.neutral}`}>{t(locale, 'product_badge_included_in', { tiers: includedIn.join(', ') })}</span>
          )}
          {product.archived_at && <span className={`${PILL} ${PILL_TONE.neutral}`}>{t(locale, 'archived')}</span>}
        </div>
        <div className="shrink-0 text-sm">{price}</div>
      </div>
      {about && (
        <p className="mt-1 truncate text-xs text-ink-muted" title={aboutFull}>
          {about}
          {moreTraits > 0 ? ` · +${moreTraits}` : ''}
        </p>
      )}
      {unlocks.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-subtle" aria-label={t(locale, 'unlocks_label')}>
          {shown.map((u) => (
            <span key={u.key} className="inline-flex items-center gap-1" title={u.full}>
              {u.icon}
              <span className="hidden sm:inline">{u.short}</span>
              <span className="sr-only sm:hidden">{u.full}</span>
            </span>
          ))}
          {rest.length > 0 && (
            <span className="text-ink-muted" title={rest.map((u) => u.full).join('\n')}>
              {t(locale, 'unlocks_more', { n: rest.length })}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
