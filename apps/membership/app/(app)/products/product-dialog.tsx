'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import { createProduct, patchProduct } from './actions';
import { SearchSelect } from '@thefibre/shared/ui/search-select';
import { createGrant, deleteGrant } from '../access/actions';
import { GRANT_KINDS, type Grant, type GrantKind as AccessKind } from '../access/types';
import { LINK_KINDS, type LinkKind, type Product, type ProductLink } from './types';

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

// Editable link row — ref stays a free string (a slug, a space id, a URL).
type LinkRow = { kind: LinkKind; ref: string; label: string };

const LINK_KIND_KEYS: Record<LinkKind, UiKey> = {
  thread: 'link_kind_thread',
  meet: 'link_kind_meet',
  circle_space: 'link_kind_circle_space',
  url: 'link_kind_url',
};

const GRANT_KIND_KEYS: Record<AccessKind, UiKey> = {
  circle: 'grant_kind_circle',
  thread: 'grant_kind_thread',
  fibre_seat: 'grant_kind_fibre_seat',
  google_user: 'grant_kind_google_user',
};

// The url placeholder is a URL scheme, not prose — same in every locale.
const REF_PLACEHOLDER_KEYS: Record<Exclude<LinkKind, 'url'>, UiKey> = {
  thread: 'thread_slug_ph',
  meet: 'meet_ref_ph',
  circle_space: 'space_id_ph',
};

export function ProductDialog({
  product,
  currency: workspaceCurrency,
  threadOptions,
  grants,
  locale,
  nextSortOrder,
  onClose,
}: {
  product: Product | null; // null = new
  currency: import('@/lib/workspace-currency').WorkspaceCurrencies;
  /** The workspace's threads — thread-kind links pick a slug, never type one. */
  threadOptions: { slug: string; title: string }[];
  /** Access carried by THIS product (the product is the promise — 2026-09-05). */
  grants: Grant[];
  locale: Locale;
  /** Where a NEW product lands: the end of the list. Reordering is drag-and-drop on the list itself. */
  nextSortOrder: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? '');
  const [currency, setCurrency] = useState(product?.currency ?? workspaceCurrency.default_currency);
  const currencyOptions = [...new Set([...workspaceCurrency.currencies, currency])];
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(centsToEuro(product?.price_cents ?? null));
  const [purchasable, setPurchasable] = useState(product?.purchasable ?? false);
  const [characteristics, setCharacteristics] = useState(
    (product?.characteristics ?? []).join('\n'),
  );
  const [links, setLinks] = useState<LinkRow[]>(
    (product?.links ?? []).map((l) => ({ kind: l.kind, ref: l.ref, label: l.label ?? '' })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  // Access rows are saved IMMEDIATELY via the grants API (they need the
  // product row to exist) — optimistic local list, refresh on close.
  const [access, setAccess] = useState<Grant[]>(grants);
  const [accessKind, setAccessKind] = useState<AccessKind>('circle');
  const [accessRef, setAccessRef] = useState('');
  const [accessRole, setAccessRole] = useState<'organiser' | 'admin'>('organiser');
  const [accessBusy, setAccessBusy] = useState(false);

  async function addAccess() {
    if (!product) return;
    if (accessKind !== 'fibre_seat' && accessKind !== 'google_user' && !accessRef.trim()) {
      setError(
        accessKind === 'circle' ? t(locale, 'space_id_required') : t(locale, 'thread_slug_required'),
      );
      return;
    }
    setAccessBusy(true);
    setError(null);
    const r = await createGrant({
      product_id: product.id,
      kind: accessKind,
      config:
        accessKind === 'circle'
          ? { space_id: accessRef.trim() }
          : accessKind === 'fibre_seat'
            ? { role: accessRole }
            : accessKind === 'google_user'
              ? {}
              : { thread_slug: accessRef.trim() },
    });
    setAccessBusy(false);
    if (r.error || !r.data) {
      setError(r.error ?? t(locale, 'could_not_add_access'));
      return;
    }
    setAccess((prev) => [
      ...prev,
      {
        id: r.data!.id,
        tier_id: null,
        product_id: product.id,
        kind: accessKind,
        config:
          accessKind === 'circle'
            ? { space_id: accessRef.trim() }
            : accessKind === 'fibre_seat'
              ? { role: accessRole }
              : accessKind === 'google_user'
                ? {}
                : { thread_slug: accessRef.trim() },
        created_at: new Date().toISOString(),
        tier: null,
        product: { name: product.name },
      },
    ]);
    setAccessRef('');
    router.refresh();
  }

  async function removeAccess(id: string) {
    setAccessBusy(true);
    const r = await deleteGrant(id);
    setAccessBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setAccess((prev) => prev.filter((g) => g.id !== id));
    router.refresh();
  }

  function accessSummary(g: Grant): string {
    if (g.kind === 'circle')
      return t(locale, 'circle_space_target', { ref: String(g.config?.space_id ?? '') });
    if (g.kind === 'fibre_seat')
      return t(locale, 'fibre_seat_target', { role: String(g.config?.role ?? 'organiser') });
    if (g.kind === 'google_user') return t(locale, 'google_account_target');
    return t(locale, 'thread_target', { ref: String(g.config?.thread_slug ?? '') });
  }

  function setLink(i: number, patch: Partial<LinkRow>) {
    setLinks((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!name.trim()) {
      setError(t(locale, 'name_required'));
      return;
    }
    // Link rows without a ref used to be dropped SILENTLY on save — which
    // read as "my links don't save" (caught live 2026-09-05: PATCH 200,
    // links []). The user added the row on purpose; an empty middle field
    // now stops the save and says exactly what's missing.
    if (links.some((l) => !l.ref.trim())) {
      setError(t(locale, 'link_row_missing_ref'));
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
      price_cents: euroToCents(price),
      purchasable,
      links: links
        .filter((l) => l.ref.trim())
        .map((l): ProductLink => ({
          kind: l.kind,
          ref: l.ref.trim(),
          ...(l.label.trim() ? { label: l.label.trim() } : {}),
        })),
      // Existing products keep their position; a new one joins at the end.
      sort_order: product ? (product.sort_order ?? 0) : nextSortOrder,
    };
    const res = product ? await patchProduct(product.id, input) : await createProduct(input);
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    onClose();
    router.refresh();
  }

  async function handleArchive() {
    if (!product) return;
    const unarchiving = Boolean(product.archived_at);
    if (!unarchiving && !confirmArchive) {
      setConfirmArchive(true);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await patchProduct(product.id, { archived: !unarchiving });
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
      title={product ? t(locale, 'edit_product') : t(locale, 'new_product')}
      size="lg"
      footer={
        <>
          {product && (
            <Button
              type="button"
              variant="danger"
              className="mr-auto"
              disabled={busy}
              onClick={handleArchive}
            >
              {product.archived_at
                ? t(locale, 'unarchive')
                : confirmArchive
                  ? t(locale, 'really_archive_q')
                  : t(locale, 'archive')}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="product-form" disabled={busy}>
            {busy ? t(locale, 'saving') : t(locale, 'save')}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'name')}</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(locale, 'product_name_ph')}
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
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t(locale, 'price_with_currency', { currency })}
            </label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              placeholder={t(locale, 'price_included_ph')}
              className={`${INPUT} max-w-[14rem]`}
            />
          </div>
          {currencyOptions.length > 1 && (
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={`${INPUT} max-w-[7rem]`}
              aria-label={t(locale, 'currency')}
            >
              {currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={purchasable}
              onChange={(e) => setPurchasable(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">{t(locale, 'purchasable_label')}</span>
              <span className="block text-xs text-ink-muted mt-0.5">
                {t(locale, 'purchasable_hint')}
              </span>
            </span>
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'characteristics')}</label>
          <textarea
            value={characteristics}
            onChange={(e) => setCharacteristics(e.target.value)}
            rows={3}
            placeholder={t(locale, 'product_characteristics_ph')}
            className={INPUT}
          />
          <p className="mt-1.5 text-xs text-ink-muted">{t(locale, 'characteristics_hint')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'links')}</label>
          {links.length === 0 && (
            <p className="mb-2 text-sm text-ink-muted">{t(locale, 'links_blurb')}</p>
          )}
          <div className="space-y-2">
            {links.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={l.kind}
                  onChange={(e) => setLink(i, { kind: e.target.value as LinkKind })}
                  // NOT the shared INPUT class: its w-full beat the w-36 and
                  // the select swallowed the whole row, pushing the ref +
                  // label fields out of the dialog — the true root cause of
                  // "my links don't save" (the field to fill was invisible).
                  className="w-36 shrink-0 rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
                >
                  {LINK_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(locale, LINK_KIND_KEYS[k])}
                    </option>
                  ))}
                </select>
                {l.kind === 'thread' && threadOptions.length > 0 ? (
                  <SearchSelect
                    value={l.ref}
                    onChange={(ref) => setLink(i, { ref })}
                    options={[
                      ...threadOptions.map((x) => ({ value: x.slug, label: x.title, hint: x.slug })),
                      ...(l.ref && !threadOptions.some((x) => x.slug === l.ref)
                        ? [{ value: l.ref, label: l.ref }]
                        : []),
                    ]}
                    placeholder={t(locale, 'pick_thread_ph')}
                    className="w-full"
                  />
                ) : (
                  <input
                    value={l.ref}
                    onChange={(e) => setLink(i, { ref: e.target.value })}
                    placeholder={l.kind === 'url' ? 'https://…' : t(locale, REF_PLACEHOLDER_KEYS[l.kind])}
                    className={INPUT}
                  />
                )}
                <input
                  value={l.label}
                  onChange={(e) => setLink(i, { label: e.target.value })}
                  placeholder={t(locale, 'label_optional_ph')}
                  className={INPUT}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t(locale, 'remove_link')}
                  onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Trash2 size={16} strokeWidth={1.75} />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => setLinks((prev) => [...prev, { kind: 'url', ref: '', label: '' }])}
          >
            {t(locale, 'add_link')}
          </Button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'access_label')}</label>
          <p className="mb-2 text-sm text-ink-muted">{t(locale, 'product_access_blurb')}</p>
          {!product ? (
            <p className="text-sm text-ink-muted">{t(locale, 'save_product_first')}</p>
          ) : (
            <>
              {access.length > 0 && (
                <ul className="mb-2 rounded-md border border-line divide-y divide-line/60">
                  {access.map((g) => (
                    <li key={g.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-ink">{accessSummary(g)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t(locale, 'remove_access')}
                        disabled={accessBusy}
                        onClick={() => void removeAccess(g.id)}
                      >
                        <Trash2 size={16} strokeWidth={1.75} />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-2">
                <select
                  value={accessKind}
                  onChange={(e) => setAccessKind(e.target.value as AccessKind)}
                  className="w-36 shrink-0 rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
                >
                  {GRANT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(locale, GRANT_KIND_KEYS[k])}
                    </option>
                  ))}
                </select>
                {accessKind === 'fibre_seat' ? (
                  <select
                    value={accessRole}
                    onChange={(e) => setAccessRole(e.target.value as 'organiser' | 'admin')}
                    className={INPUT}
                  >
                    <option value="organiser">{t(locale, 'organiser_seat')}</option>
                    <option value="admin">{t(locale, 'admin_seat')}</option>
                  </select>
                ) : (
                  <input
                    value={accessRef}
                    onChange={(e) => setAccessRef(e.target.value)}
                    placeholder={
                      accessKind === 'circle' ? t(locale, 'space_id_ph') : t(locale, 'thread_slug_ph')
                    }
                    className={INPUT}
                  />
                )}
                <Button type="button" variant="secondary" size="sm" disabled={accessBusy} onClick={() => void addAccess()}>
                  {accessBusy ? '…' : t(locale, 'add_access')}
                </Button>
              </div>
              {accessKind === 'fibre_seat' && (
                <p className="mt-1.5 text-xs text-amber-700">
                  {t(locale, 'fibre_seat_billing_warning')}
                </p>
              )}
            </>
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
