'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch, SwitchField } from '@/components/ui/switch';
import { money } from '@/lib/money';
import { createBudgetLine, updateBudgetLine, type BudgetLineInput } from './actions';

export type BudgetLine = {
  id: string;
  label: string;
  category: string | null;
  direction: 'in' | 'out';
  amount_cents: number;
  cadence: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';
  included: boolean;
  starts_on: string | null;
  ends_on: string | null;
  owner_user_id: string | null;
};

export type Member = {
  user_id: string;
  full_name: string | null;
  email: string | null;
};

const INPUT_CLASS =
  'w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';

const CADENCES: BudgetLine['cadence'][] = [
  'weekly',
  'fortnightly',
  'monthly',
  'quarterly',
  'yearly',
];

// Euro string → integer cents; accepts comma decimals.
function parseEuro(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = parseFloat(t);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

// ---------------------------------------------------------------------------
// Header action — "New line".
// ---------------------------------------------------------------------------
export function BudgetActions({ members }: { members: Member[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button leading={<Plus size={16} strokeWidth={2} />} onClick={() => setOpen(true)}>
        New line
      </Button>
      {open && <LineDialog members={members} onClose={() => setOpen(false)} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Grouped list — rows open the edit dialog; the switch toggles `included`
// inline (the sheet's TRUE/FALSE column, but a toggle).
// ---------------------------------------------------------------------------
export function BudgetList({ lines, members }: { lines: BudgetLine[]; members: Member[] }) {
  const [editing, setEditing] = useState<BudgetLine | null>(null);

  if (lines.length === 0) {
    return (
      <div className="mt-10 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center">
        <p className="text-sm text-ink-muted">
          No budget lines yet. Add your recurring income and costs — they expand into the
          projection automatically.
        </p>
      </div>
    );
  }

  const byCategory = new Map<string, BudgetLine[]>();
  for (const l of lines) {
    const key = l.category?.trim() || 'Uncategorised';
    const list = byCategory.get(key) ?? [];
    list.push(l);
    byCategory.set(key, list);
  }

  return (
    <>
      <div className="mt-8 space-y-6">
        {[...byCategory.entries()].map(([category, group]) => (
          <div key={category} className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
            <div className="px-5 py-3 border-b border-line text-sm font-semibold tracking-tight">
              {category}
            </div>
            <div className="divide-y divide-line/60">
              {group.map((l) => (
                <div
                  key={l.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setEditing(l)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setEditing(l);
                    }
                  }}
                  className="px-5 py-3 flex items-center gap-4 cursor-pointer hover:bg-surface-sunken/60 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm truncate ${l.included ? 'text-ink' : 'text-ink-muted line-through'}`}
                    >
                      {l.label}
                    </div>
                    <div className="text-xs text-ink-muted">{l.cadence}</div>
                  </div>
                  <span
                    className={`text-sm font-medium w-28 text-right ${l.direction === 'out' ? 'text-red-600' : 'text-emerald-700'}`}
                  >
                    {l.direction === 'out' ? '−' : '+'}
                    {money(l.amount_cents)}
                  </span>
                  <IncludedSwitch line={l} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <LineDialog line={editing} members={members} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function IncludedSwitch({ line }: { line: BudgetLine }) {
  const router = useRouter();
  const [on, setOn] = useState(line.included);
  const [busy, setBusy] = useState(false);

  async function toggle(v: boolean) {
    setOn(v); // optimistic
    setBusy(true);
    const res = await updateBudgetLine(line.id, { included: v });
    setBusy(false);
    if (res.error) {
      setOn(!v);
      return;
    }
    router.refresh();
  }

  return (
    <span
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className="inline-flex"
    >
      <Switch checked={on} onChange={toggle} disabled={busy} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// New / edit dialog. Delete (archive) left, Cancel · Save right.
// ---------------------------------------------------------------------------
function LineDialog({
  line,
  members,
  onClose,
}: {
  line?: BudgetLine;
  members: Member[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(line?.label ?? '');
  const [category, setCategory] = useState(line?.category ?? '');
  const [direction, setDirection] = useState<'in' | 'out'>(line?.direction ?? 'out');
  const [amount, setAmount] = useState(line ? (line.amount_cents / 100).toFixed(2) : '');
  const [cadence, setCadence] = useState<BudgetLine['cadence']>(line?.cadence ?? 'monthly');
  const [startsOn, setStartsOn] = useState(line?.starts_on ?? '');
  const [endsOn, setEndsOn] = useState(line?.ends_on ?? '');
  const [included, setIncluded] = useState(line?.included ?? true);
  const [ownerId, setOwnerId] = useState(line?.owner_user_id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!label.trim()) {
      setError('Label is required.');
      return;
    }
    const cents = parseEuro(amount);
    if (cents === null) {
      setError('Amount is required — euros, e.g. 1250 or 49,95.');
      return;
    }
    setBusy(true);
    setError(null);
    const payload: BudgetLineInput = {
      label: label.trim(),
      category: category.trim() || null,
      direction,
      amount_cents: cents,
      cadence,
      starts_on: startsOn || null,
      ends_on: endsOn || null,
      included,
      owner_user_id: ownerId || null,
    };
    const res = line ? await updateBudgetLine(line.id, payload) : await createBudgetLine(payload);
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    onClose();
    router.refresh();
  }

  async function doArchive() {
    if (!line) return;
    setBusy(true);
    const res = await updateBudgetLine(line.id, { archived: true });
    if (res.error) {
      setError(res.error);
      setBusy(false);
      setConfirmDelete(false);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={line ? 'Edit budget line' : 'New budget line'}
        size="lg"
        footer={
          <>
            {line && (
              <Button
                type="button"
                variant="danger"
                className="mr-auto"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="budget-line-form" disabled={busy}>
              {busy ? 'Saving…' : line ? 'Save' : 'Create line'}
            </Button>
          </>
        }
      >
        <form id="budget-line-form" onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Label</label>
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Office rent"
              className={INPUT_CLASS}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Housing"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Direction</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'in' | 'out')}
                className={INPUT_CLASS}
              >
                <option value="out">Out (cost)</option>
                <option value="in">In (income)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
                  €
                </span>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  className={`${INPUT_CLASS} pl-7`}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cadence</label>
              <select
                value={cadence}
                onChange={(e) => setCadence(e.target.value as BudgetLine['cadence'])}
                className={INPUT_CLASS}
              >
                {CADENCES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Starts on</label>
              <input
                type="date"
                value={startsOn}
                onChange={(e) => setStartsOn(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ends on</label>
              <input
                type="date"
                value={endsOn}
                onChange={(e) => setEndsOn(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Owner</label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">— nobody —</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name || m.email || m.user_id}
                </option>
              ))}
            </select>
          </div>
          <SwitchField
            label="Included in the projection"
            hint="Toggled-off lines stay here, out of the numbers."
            checked={included}
            onChange={setIncluded}
          />
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </form>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={doArchive}
        title="Archive this budget line?"
        message="It disappears from the budget and the projection. Nothing is hard-deleted."
        confirmLabel="Archive"
        destructive
        pending={busy}
      />
    </>
  );
}
