'use client';

// Per-cashflow settings (Sjoerd 2026-07-10: "a setting button per cashflow,
// where you can do settings like bank account, reserves, VAT etc"). A gear on
// the tab bar opens this for the ACTIVE tab: its banks & reserves, its
// reservation rules, and a pointer to the planner-wide settings. Everything
// here is scoped to the tab (workspace / me / a team) via the reused
// CreateBankDialog + ReservationRuleDialog, which stamp the scope on create.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Landmark, PiggyBank, Plus, RefreshCw, Percent, X } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreateBankDialog } from './bank-prompt';
import { ReservationRuleDialog } from './reservation-rule-dialog';
import { money } from '@/lib/money';
import { deleteReservationRule } from '../settings/actions';
import type { CashflowScope, PulseAccount, Projection } from './types';

type Rule = NonNullable<Projection['reservation_rules']>[number];

export function CashflowSettingsDialog({
  tabName,
  scope,
  scopeTeamId,
  currentUserId,
  accounts,
  rules,
  onUpdateBalances,
  onClose,
}: {
  tabName: string;
  scope: CashflowScope;
  scopeTeamId: string | null;
  currentUserId: string | null;
  accounts: PulseAccount[];
  rules: Rule[];
  onUpdateBalances: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [creatingBank, setCreatingBank] = useState<'bank' | 'reserve' | null>(null);
  const [addingRule, setAddingRule] = useState(false);
  const [busyRule, setBusyRule] = useState<string | null>(null);

  const banks = accounts.filter((a) => a.kind === 'bank');
  const reserves = accounts.filter((a) => a.kind === 'reserve');

  async function removeRule(id: string) {
    setBusyRule(id);
    await deleteReservationRule(id);
    setBusyRule(null);
    router.refresh();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${tabName} · cashflow settings`}
      size="lg"
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Banks & reserves */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Banks &amp; reserves
            </h3>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                leading={<RefreshCw size={13} strokeWidth={2} />}
                onClick={onUpdateBalances}
              >
                Update balances
              </Button>
              <Button
                size="sm"
                variant="secondary"
                leading={<Plus size={13} strokeWidth={2} />}
                onClick={() => setCreatingBank('bank')}
              >
                Bank
              </Button>
              <Button
                size="sm"
                variant="secondary"
                leading={<Plus size={13} strokeWidth={2} />}
                onClick={() => setCreatingBank('reserve')}
              >
                Reserve
              </Button>
            </div>
          </div>
          {accounts.length === 0 ? (
            <p className="rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink-muted">
              No accounts in this cashflow yet — add a bank to anchor its projection.
            </p>
          ) : (
            <div className="divide-y divide-line/60 rounded-lg ring-1 ring-line">
              {[...banks, ...reserves].map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="text-ink-muted">
                    {a.kind === 'reserve' ? (
                      <PiggyBank size={15} strokeWidth={1.75} />
                    ) : (
                      <Landmark size={15} strokeWidth={1.75} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{a.name}</span>
                  {a.kind === 'reserve' && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500">
                      reserve
                    </span>
                  )}
                  <span className="shrink-0 text-sm font-medium tabular-nums text-ink">
                    {a.latest_snapshot ? money(a.latest_snapshot.balance_cents) : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Reservations */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Reservations
            </h3>
            <Button
              size="sm"
              variant="secondary"
              leading={<Plus size={13} strokeWidth={2} />}
              onClick={() => setAddingRule(true)}
            >
              Rule
            </Button>
          </div>
          {rules.length === 0 ? (
            <p className="rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink-muted">
              No reservation rules in this cashflow. A rule sets aside a % of income into a
              reserve bucket.
            </p>
          ) : (
            <div className="divide-y divide-line/60 rounded-lg ring-1 ring-line">
              {rules.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2">
                  <Percent size={13} strokeWidth={1.75} className="text-ink-muted" />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{r.label}</span>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-ink-subtle">
                    {Number(r.percentage)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRule(r.id)}
                    disabled={busyRule === r.id}
                    title="Remove this reservation rule"
                    className="shrink-0 rounded p-1 text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-50"
                  >
                    <X size={13} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Planner-wide */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            More
          </h3>
          <p className="text-sm text-ink-muted">
            VAT tariffs, time rhythm and invoicing are planner-wide —{' '}
            <Link href="/settings/planner" className="underline underline-offset-2 hover:text-ink">
              Settings → Planner
            </Link>
            .
          </p>
        </section>
      </div>

      {creatingBank && (
        <CreateBankDialog
          tabName={tabName}
          scope={scope}
          scopeTeamId={scopeTeamId}
          currentUserId={currentUserId}
          initialKind={creatingBank}
          onClose={() => setCreatingBank(null)}
        />
      )}
      {addingRule && (
        <ReservationRuleDialog
          tabName={tabName}
          scope={scope}
          scopeTeamId={scopeTeamId}
          currentUserId={currentUserId}
          reserveAccounts={reserves}
          onClose={() => setAddingRule(false)}
        />
      )}
    </Dialog>
  );
}
