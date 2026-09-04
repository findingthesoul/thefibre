'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createProduct, patchProduct } from './actions';
import { SearchSelect } from '@thefibre/shared/ui/search-select';
import { createGrant, deleteGrant } from '../access/actions';
import { GRANT_KIND_LABELS, type Grant, type GrantKind as AccessKind } from '../access/types';
import { LINK_KINDS, LINK_KIND_LABELS, type LinkKind, type Product, type ProductLink } from './types';

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

const REF_PLACEHOLDERS: Record<LinkKind, string> = {
  thread: 'Thread slug',
  meet: 'Meet ref',
  circle_space: 'Space ID',
  url: 'https://…',
};

export function ProductDialog({
  product,
  currency: workspaceCurrency,
  threadOptions,
  grants,
  nextSortOrder,
  onClose,
}: {
  product: Product | null; // null = new
  currency: import('@/lib/workspace-currency').WorkspaceCurrencies;
  /** The workspace's threads — thread-kind links pick a slug, never type one. */
  threadOptions: { slug: string; title: string }[];
  /** Access carried by THIS product (the product is the promise — 2026-09-05). */
  grants: Grant[];
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
    if (accessKind !== 'fibre_seat' && !accessRef.trim()) {
      setError(accessKind === 'circle' ? 'Space ID is required.' : 'Thread slug is required.');
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
            : { thread_slug: accessRef.trim() },
    });
    setAccessBusy(false);
    if (r.error || !r.data) {
      setError(r.error ?? 'could not add access');
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
    if (g.kind === 'circle') return `Circle space ${g.config?.space_id ?? ''}`;
    if (g.kind === 'fibre_seat') return `Fibre seat (${g.config?.role ?? 'organiser'})`;
    return `Thread ${g.config?.thread_slug ?? ''}`;
  }

  function setLink(i: number, patch: Partial<LinkRow>) {
    setLinks((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    // Link rows without a ref used to be dropped SILENTLY on save — which
    // read as "my links don't save" (caught live 2026-09-05: PATCH 200,
    // links []). The user added the row on purpose; an empty middle field
    // now stops the save and says exactly what's missing.
    if (links.some((l) => !l.ref.trim())) {
      setError(
        'A link row is missing its middle field — the slug, ID or URL it points at. Fill it in or remove the row (trash icon).',
      );
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
      title={product ? 'Edit product' : 'New product'}
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
              {product.archived_at ? 'Unarchive' : confirmArchive ? 'Really archive?' : 'Archive'}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Community space"
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
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Price ({currency})</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              placeholder="Leave empty when included in a tier"
              className={`${INPUT} max-w-[14rem]`}
            />
          </div>
          {currencyOptions.length > 1 && (
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={`${INPUT} max-w-[7rem]`}
              aria-label="Currency"
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
          <label className="block text-sm font-medium mb-1">Characteristics</label>
          <textarea
            value={characteristics}
            onChange={(e) => setCharacteristics(e.target.value)}
            rows={3}
            placeholder={'One per line, e.g.\nWeekly office hours\nRecordings archive'}
            className={INPUT}
          />
          <p className="mt-1.5 text-xs text-ink-muted">
            One per line — shown as bullet points on the join page.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Links</label>
          {links.length === 0 && (
            <p className="mb-2 text-sm text-ink-muted">
              What this product points at — a Thread, a Meet, a Circle space or a plain URL.
            </p>
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
                      {LINK_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                {l.kind === 'thread' && threadOptions.length > 0 ? (
                  <SearchSelect
                    value={l.ref}
                    onChange={(ref) => setLink(i, { ref })}
                    options={[
                      ...threadOptions.map((t) => ({ value: t.slug, label: t.title, hint: t.slug })),
                      ...(l.ref && !threadOptions.some((t) => t.slug === l.ref)
                        ? [{ value: l.ref, label: l.ref }]
                        : []),
                    ]}
                    placeholder="Pick a thread…"
                    className="w-full"
                  />
                ) : (
                  <input
                    value={l.ref}
                    onChange={(e) => setLink(i, { ref: e.target.value })}
                    placeholder={REF_PLACEHOLDERS[l.kind]}
                    className={INPUT}
                  />
                )}
                <input
                  value={l.label}
                  onChange={(e) => setLink(i, { label: e.target.value })}
                  placeholder="Label (optional)"
                  className={INPUT}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove link"
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
            Add link
          </Button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Access</label>
          <p className="mb-2 text-sm text-ink-muted">
            What this product actually unlocks — synced automatically as members join and lapse.
            A tier that includes this product grants all of it.
          </p>
          {!product ? (
            <p className="text-sm text-ink-muted">Save the product first, then add access.</p>
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
                        aria-label="Remove access"
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
                  {(Object.keys(GRANT_KIND_LABELS) as AccessKind[]).map((k) => (
                    <option key={k} value={k}>
                      {GRANT_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                {accessKind === 'fibre_seat' ? (
                  <select
                    value={accessRole}
                    onChange={(e) => setAccessRole(e.target.value as 'organiser' | 'admin')}
                    className={INPUT}
                  >
                    <option value="organiser">Organiser seat</option>
                    <option value="admin">Admin seat</option>
                  </select>
                ) : (
                  <input
                    value={accessRef}
                    onChange={(e) => setAccessRef(e.target.value)}
                    placeholder={accessKind === 'circle' ? 'Space ID' : 'Thread slug'}
                    className={INPUT}
                  />
                )}
                <Button type="button" variant="secondary" size="sm" disabled={accessBusy} onClick={() => void addAccess()}>
                  {accessBusy ? '…' : 'Add access'}
                </Button>
              </div>
              {accessKind === 'fibre_seat' && (
                <p className="mt-1.5 text-xs text-amber-700">
                  Fibre seats are billed on your workspace subscription — each member this
                  activates adds a seat.
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
