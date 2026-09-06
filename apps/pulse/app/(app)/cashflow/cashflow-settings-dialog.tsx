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
import { useEffect } from 'react';
import { CreateBankDialog } from './bank-prompt';
import { ReservationRuleDialog } from './reservation-rule-dialog';
import { money } from '@/lib/money';
import { deleteReservationRule } from '../settings/actions';
import {
  getCashflowGrants,
  setCashflowGrant,
  type CashflowGrant,
} from './actions';
import { t, type Locale } from '@/lib/i18n-ui';
import type { CashflowScope, MemberOption, PulseAccount, Projection } from './types';
import { appUrl } from '@thefibre/shared';

// Display host for the invite hint — staging shows staging (env-driven).
const FIBRE_HOST = new URL(appUrl('fibre-platform', { NEXT_PUBLIC_FIBRE_URL: process.env.NEXT_PUBLIC_FIBRE_URL })).host;

type Rule = NonNullable<Projection['reservation_rules']>[number];

export function CashflowSettingsDialog({
  tabName,
  scope,
  scopeTeamId,
  currentUserId,
  accounts,
  rules,
  members,
  locale,
  onUpdateBalances,
  onClose,
}: {
  locale: Locale;
  tabName: string;
  scope: CashflowScope;
  scopeTeamId: string | null;
  currentUserId: string | null;
  accounts: PulseAccount[];
  rules: Rule[];
  members: MemberOption[];
  onUpdateBalances: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [creatingBank, setCreatingBank] = useState<'bank' | 'reserve' | null>(null);
  const [addingRule, setAddingRule] = useState(false);
  const [busyRule, setBusyRule] = useState<string | null>(null);
  // Workspace-tab sharing: user_id → level.
  const [grants, setGrants] = useState<Record<string, 'read' | 'write'>>({});
  const [grantsLoaded, setGrantsLoaded] = useState(false);
  const [busyGrant, setBusyGrant] = useState<string | null>(null);

  useEffect(() => {
    if (scope !== 'workspace') return;
    getCashflowGrants().then((r) => {
      if (r.data) {
        const m: Record<string, 'read' | 'write'> = {};
        for (const g of r.data.items) m[g.user_id] = g.level;
        setGrants(m);
      }
      setGrantsLoaded(true);
    });
  }, [scope]);

  async function changeGrant(userId: string, level: 'read' | 'write' | 'none') {
    setBusyGrant(userId);
    const res = await setCashflowGrant(userId, level);
    setBusyGrant(null);
    if (res.error) return;
    setGrants((g) => {
      const next = { ...g };
      if (level === 'none') delete next[userId];
      else next[userId] = level;
      return next;
    });
    router.refresh();
  }

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
      title={t(locale, 'cashflow_settings_title', { tab: tabName })}
      size="lg"
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          {t(locale, 'done')}
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Banks & reserves */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t(locale, 'banks_reserves')}
            </h3>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                leading={<RefreshCw size={13} strokeWidth={2} />}
                onClick={onUpdateBalances}
              >
                {t(locale, 'update_balances')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                leading={<Plus size={13} strokeWidth={2} />}
                onClick={() => setCreatingBank('bank')}
              >
                {t(locale, 'bank')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                leading={<Plus size={13} strokeWidth={2} />}
                onClick={() => setCreatingBank('reserve')}
              >
                {t(locale, 'reserve')}
              </Button>
            </div>
          </div>
          {accounts.length === 0 ? (
            <p className="rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink-muted">
              {t(locale, 'no_accounts_tab')}
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
                      {t(locale, 'reserve_lc')}
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
              {t(locale, 'reservations')}
            </h3>
            <Button
              size="sm"
              variant="secondary"
              leading={<Plus size={13} strokeWidth={2} />}
              onClick={() => setAddingRule(true)}
            >
              {t(locale, 'rule')}
            </Button>
          </div>
          {rules.length === 0 ? (
            <p className="rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink-muted">
              {t(locale, 'no_rules_tab')}
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
                    title={t(locale, 'remove_rule_title')}
                    className="shrink-0 rounded p-1 text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:opacity-50"
                  >
                    <X size={13} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sharing — Workspace tab only: grant members read / read-write
            without making them admins. */}
        {scope === 'workspace' && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t(locale, 'sharing')}
            </h3>
            <p className="mb-2 text-sm text-ink-muted">{t(locale, 'sharing_desc')}</p>
            {!grantsLoaded ? (
              <p className="rounded-md bg-surface-sunken px-3 py-2 text-sm text-ink-muted">
                {t(locale, 'loading')}
              </p>
            ) : (
              <div className="divide-y divide-line/60 rounded-lg ring-1 ring-line">
                {members
                  .filter((m) => m.user_id !== currentUserId)
                  .map((m) => (
                    <div key={m.user_id} className="flex items-center gap-3 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">
                        {m.full_name ?? m.email ?? m.user_id}
                      </span>
                      <select
                        value={grants[m.user_id] ?? 'none'}
                        disabled={busyGrant === m.user_id}
                        onChange={(e) =>
                          changeGrant(m.user_id, e.target.value as 'read' | 'write' | 'none')
                        }
                        className="h-8 rounded-md border border-line bg-surface-raised px-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
                      >
                        <option value="none">{t(locale, 'no_access')}</option>
                        <option value="read">{t(locale, 'read')}</option>
                        <option value="write">{t(locale, 'read_write')}</option>
                      </select>
                    </div>
                  ))}
                {members.filter((m) => m.user_id !== currentUserId).length === 0 && (
                  <p className="px-3 py-2 text-sm text-ink-muted">
                    {t(locale, 'no_members_invite', { host: FIBRE_HOST })}
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Planner-wide */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t(locale, 'more')}
          </h3>
          <p className="text-sm text-ink-muted">
            {t(locale, 'planner_wide_before')}{' '}
            <Link href="/settings/planner" className="underline underline-offset-2 hover:text-ink">
              {t(locale, 'settings_planner_link')}
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
          locale={locale}
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
          locale={locale}
          onClose={() => setAddingRule(false)}
        />
      )}
    </Dialog>
  );
}
