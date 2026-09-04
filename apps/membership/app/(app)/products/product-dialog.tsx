'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createProduct, patchProduct } from './actions';
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
  nextSortOrder,
  onClose,
}: {
  product: Product | null; // null = new
  currency: import('@/lib/workspace-currency').WorkspaceCurrencies;
  /** The workspace's threads — thread-kind links pick a slug, never type one. */
  threadOptions: { slug: string; title: string }[];
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
                  <select
                    value={l.ref}
                    onChange={(e) => setLink(i, { ref: e.target.value })}
                    className={INPUT}
                  >
                    <option value="">Pick a thread…</option>
                    {threadOptions.map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.title}
                      </option>
                    ))}
                    {l.ref && !threadOptions.some((t) => t.slug === l.ref) && (
                      <option value={l.ref}>{l.ref}</option>
                    )}
                  </select>
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
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </Dialog>
  );
}
