'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createOffering, updateOffering } from './actions';
import { money } from '@/lib/money';
import {
  centsToEuroInput,
  ERROR_CLS,
  INPUT_CLS,
  parseEuroToCents,
  type Offering,
} from './shared';

export function OfferingsCard({
  offerings,
  currency,
}: {
  offerings: Offering[];
  currency: string;
}) {
  const [editing, setEditing] = useState<Offering | 'new' | null>(null);

  return (
    <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight">Offerings</span>
        <Button
          size="sm"
          variant="secondary"
          leading={<Plus size={14} strokeWidth={2} />}
          onClick={() => setEditing('new')}
        >
          New offering
        </Button>
      </div>
      {offerings.length === 0 ? (
        <div className="px-5 py-4 text-sm text-ink-muted">
          Nothing here yet. Offerings are what the workspace sells — programmes, retainers,
          workshops. Commitments link to them so the pipeline stays legible.
        </div>
      ) : (
        <div className="divide-y divide-line/60">
          {offerings.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setEditing(o)}
              className="w-full px-5 py-3 flex items-center gap-4 text-left hover:bg-surface-sunken/50"
            >
              <span className="flex-1 text-sm text-ink">{o.name}</span>
              {o.category && <span className="text-xs text-ink-muted">{o.category}</span>}
              <span className="text-sm font-medium w-24 text-right">
                {o.default_amount_cents !== null ? money(o.default_amount_cents, currency) : '—'}
              </span>
            </button>
          ))}
        </div>
      )}
      {editing && (
        <OfferingDialog
          offering={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function OfferingDialog({
  offering,
  onClose,
}: {
  offering: Offering | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(offering?.name ?? '');
  const [category, setCategory] = useState(offering?.category ?? '');
  const [amount, setAmount] = useState(centsToEuroInput(offering?.default_amount_cents));
  const [notes, setNotes] = useState(offering?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const cents = parseEuroToCents(amount);
    if (cents !== null && Number.isNaN(cents)) {
      setError('Default amount must be a number (e.g. 1250.50).');
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      name: name.trim(),
      category: category.trim() || null,
      default_amount_cents: cents,
      notes: notes.trim() || null,
    };
    const res = offering
      ? await updateOffering(offering.id, payload)
      : await createOffering(payload);
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    onClose();
    router.refresh();
  }

  async function archive() {
    if (!offering) return;
    setBusy(true);
    setError(null);
    const res = await updateOffering(offering.id, { archived: true });
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={offering ? 'Edit offering' : 'New offering'}
      footer={
        <>
          {offering && (
            <Button
              type="button"
              variant="danger"
              className="mr-auto"
              onClick={archive}
              disabled={busy}
            >
              Delete
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="offering-form" disabled={busy}>
            {busy ? 'Saving…' : offering ? 'Save' : 'Create offering'}
          </Button>
        </>
      }
    >
      <form id="offering-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Leadership programme"
            className={INPUT_CLS}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Training"
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Default amount (&euro;)</label>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Optional, e.g. 1250.50"
              className={INPUT_CLS}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional"
            className={INPUT_CLS}
          />
        </div>
        {error && <div className={ERROR_CLS}>{error}</div>}
      </form>
    </Dialog>
  );
}
