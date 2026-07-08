'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { createReservationRule, deleteReservationRule, updateReservationRule } from './actions';
import { ERROR_CLS, INPUT_CLS, type Account, type Rule } from './shared';

export function ReservationsCard({ rules, accounts }: { rules: Rule[]; accounts: Account[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Rule | 'new' | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const reserveAccounts = accounts.filter((a) => a.kind === 'reserve');

  async function toggleIncluded(rule: Rule, included: boolean) {
    setRowError(null);
    const res = await updateReservationRule(rule.id, { included });
    if (res.error) {
      setRowError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight">Reservations</span>
        <Button
          size="sm"
          variant="secondary"
          leading={<Plus size={14} strokeWidth={2} />}
          onClick={() => setEditing('new')}
        >
          Add rule
        </Button>
      </div>
      {rules.length === 0 ? (
        <div className="px-5 py-4 text-sm text-ink-muted">
          No reservation rules yet. Solidarity Fund, VAT reserve, buffer — all user-defined
          percentage rules; none are built in.
        </div>
      ) : (
        <div className="divide-y divide-line/60">
          {rules.map((r) => (
            <div key={r.id} className="px-5 py-3 flex items-center gap-4">
              <button
                type="button"
                onClick={() => setEditing(r)}
                className={`flex-1 text-left text-sm hover:underline ${
                  r.included ? 'text-ink' : 'text-ink-muted line-through'
                }`}
              >
                {r.label}
              </button>
              <span className="text-xs text-ink-muted">{String(r.basis).replace('_', ' ')}</span>
              <span className="text-sm font-medium w-14 text-right">{Number(r.percentage)}%</span>
              <Switch checked={r.included} onChange={(v) => toggleIncluded(r, v)} />
            </div>
          ))}
        </div>
      )}
      {rowError && (
        <div className="px-5 pb-3">
          <div className={ERROR_CLS}>{rowError}</div>
        </div>
      )}
      {editing && (
        <RuleDialog
          rule={editing === 'new' ? null : editing}
          reserveAccounts={reserveAccounts}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function RuleDialog({
  rule,
  reserveAccounts,
  onClose,
}: {
  rule: Rule | null;
  reserveAccounts: Account[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(rule?.label ?? '');
  const [percentage, setPercentage] = useState(rule ? String(Number(rule.percentage)) : '');
  const [basis, setBasis] = useState<'revenue' | 'net_revenue'>(
    rule?.basis === 'net_revenue' ? 'net_revenue' : 'revenue',
  );
  const [targetAccountId, setTargetAccountId] = useState(rule?.target_account_id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!label.trim()) {
      setError('Label is required.');
      return;
    }
    const pct = parseFloat(percentage.trim().replace(',', '.'));
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      setError('Percentage must be between 0 and 100.');
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      label: label.trim(),
      percentage: pct,
      basis,
      target_account_id: targetAccountId || null,
    };
    const res = rule
      ? await updateReservationRule(rule.id, payload)
      : await createReservationRule(payload);
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    onClose();
    router.refresh();
  }

  async function remove() {
    if (!rule) return;
    setBusy(true);
    setError(null);
    const res = await deleteReservationRule(rule.id);
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
      title={rule ? 'Edit reservation rule' : 'New reservation rule'}
      footer={
        <>
          {rule && (
            <Button type="button" variant="danger" className="mr-auto" onClick={remove} disabled={busy}>
              Delete
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="rule-form" disabled={busy}>
            {busy ? 'Saving…' : rule ? 'Save' : 'Add rule'}
          </Button>
        </>
      }
    >
      <form id="rule-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Label</label>
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. VAT reserve"
            className={INPUT_CLS}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Percentage</label>
            <input
              inputMode="decimal"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              placeholder="e.g. 21"
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Basis</label>
            <select
              value={basis}
              onChange={(e) => setBasis(e.target.value as 'revenue' | 'net_revenue')}
              className={INPUT_CLS}
            >
              <option value="revenue">Revenue</option>
              <option value="net_revenue">Net revenue</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Target account</label>
          <select
            value={targetAccountId}
            onChange={(e) => setTargetAccountId(e.target.value)}
            className={INPUT_CLS}
          >
            <option value="">None</option>
            {reserveAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-muted">
            Optional — a reserve account the reserved amount conceptually flows into.
          </p>
        </div>
        {error && <div className={ERROR_CLS}>{error}</div>}
      </form>
    </Dialog>
  );
}
