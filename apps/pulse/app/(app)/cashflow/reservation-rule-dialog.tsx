'use client';

// Per-cashflow reservation rule (Sjoerd 2026-07-09: reservations are per
// cashflow, like accounts). Opened from the RESERVATIONS section header's
// small "+" — the rule is created in the ACTIVE tab's scope (me / team /
// workspace) via the settings createReservationRule action; the target
// bucket options are THIS tab's reserve accounts. The workspace-level list
// stays manageable in Settings → Planner.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createReservationRule } from '../settings/actions';
import type { CashflowScope, PulseAccount } from './types';

const INPUT_CLS =
  'w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';
const ERROR_CLS =
  'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700';

export function ReservationRuleDialog({
  tabName,
  scope,
  scopeTeamId,
  currentUserId,
  reserveAccounts,
  onClose,
}: {
  tabName: string;
  scope: CashflowScope;
  scopeTeamId: string | null;
  currentUserId: string | null;
  // The active tab's reserve accounts — the rule's target bucket options.
  reserveAccounts: PulseAccount[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState('');
  const [percentage, setPercentage] = useState('');
  const [basis, setBasis] = useState<'revenue' | 'net_revenue'>('revenue');
  // Exactly one reserve in this tab → default to it (same rule as Settings:
  // reserved money that lands nowhere never shows in the projected reserves).
  const [targetAccountId, setTargetAccountId] = useState(
    reserveAccounts.length === 1 ? reserveAccounts[0].id : '',
  );
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
    const res = await createReservationRule({
      label: label.trim(),
      percentage: pct,
      basis,
      target_account_id: targetAccountId || null,
      // Scope per tab, like accounts: personal / team / workspace (null/null).
      team_id: scope === 'team' ? scopeTeamId : null,
      owner_user_id: scope === 'me' ? currentUserId : null,
    });
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
      title="New reservation rule"
      description={`A percentage of every period's income, set aside in the ${tabName} cashflow.`}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="cashflow-rule-form" disabled={busy}>
            {busy ? 'Saving…' : 'Add rule'}
          </Button>
        </>
      }
    >
      <form id="cashflow-rule-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Label</label>
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
            <label className="mb-1 block text-sm font-medium">Percentage</label>
            <input
              inputMode="decimal"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              placeholder="e.g. 21"
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Basis</label>
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
          <label className="mb-1 block text-sm font-medium">Target account</label>
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
            Optional — one of this cashflow&apos;s reserve accounts the reserved amount
            conceptually flows into.
          </p>
        </div>
        {error && <div className={ERROR_CLS}>{error}</div>}
      </form>
    </Dialog>
  );
}
