'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { createReservationRule, deleteReservationRule, updateReservationRule } from './actions';
import { t, type Locale } from '@/lib/i18n-ui';
import { ERROR_CLS, INPUT_CLS, type Account, type Rule } from './shared';

export function ReservationsCard({
  rules,
  accounts,
  locale,
}: {
  rules: Rule[];
  accounts: Account[];
  locale: Locale;
}) {
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
        <span className="text-sm font-semibold tracking-tight">{t(locale, 'reservations')}</span>
        <Button
          size="sm"
          variant="secondary"
          leading={<Plus size={14} strokeWidth={2} />}
          onClick={() => setEditing('new')}
        >
          {t(locale, 'add_rule')}
        </Button>
      </div>
      {/* This card manages the WORKSPACE cashflow's rules only — scoped
          rules live with their tab (like accounts). */}
      <div className="px-5 pt-3 text-xs text-ink-muted">{t(locale, 'ws_rules_note')}</div>
      {rules.length === 0 ? (
        <div className="px-5 py-4 text-sm text-ink-muted">{t(locale, 'no_rules_yet')}</div>
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
              <span className="text-xs text-ink-muted">
                {r.basis === 'net_revenue'
                  ? t(locale, 'net_revenue')
                  : r.basis === 'revenue'
                    ? t(locale, 'revenue')
                    : String(r.basis).replace('_', ' ')}
              </span>
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
          locale={locale}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function RuleDialog({
  rule,
  reserveAccounts,
  locale,
  onClose,
}: {
  rule: Rule | null;
  reserveAccounts: Account[];
  locale: Locale;
  onClose: () => void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(rule?.label ?? '');
  const [percentage, setPercentage] = useState(rule ? String(Number(rule.percentage)) : '');
  const [basis, setBasis] = useState<'revenue' | 'net_revenue'>(
    rule?.basis === 'net_revenue' ? 'net_revenue' : 'revenue',
  );
  // No target set + exactly one reserve account in the workspace → default
  // to it (the virtual-growth gap: reserved money that lands nowhere never
  // shows up in the projected reserve balances).
  const [targetAccountId, setTargetAccountId] = useState(
    rule?.target_account_id ?? (reserveAccounts.length === 1 ? reserveAccounts[0].id : ''),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!label.trim()) {
      setError(t(locale, 'label_required'));
      return;
    }
    const pct = parseFloat(percentage.trim().replace(',', '.'));
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      setError(t(locale, 'pct_range_error'));
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
      title={rule ? t(locale, 'edit_rule') : t(locale, 'new_rule')}
      footer={
        <>
          {rule && (
            <Button type="button" variant="danger" className="mr-auto" onClick={remove} disabled={busy}>
              {t(locale, 'delete')}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="rule-form" disabled={busy}>
            {busy ? t(locale, 'saving') : rule ? t(locale, 'save') : t(locale, 'add_rule')}
          </Button>
        </>
      }
    >
      <form id="rule-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'label')}</label>
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t(locale, 'eg_vat_reserve')}
            className={INPUT_CLS}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t(locale, 'percentage')}</label>
            <input
              inputMode="decimal"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              placeholder={t(locale, 'eg_21')}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t(locale, 'basis')}</label>
            <select
              value={basis}
              onChange={(e) => setBasis(e.target.value as 'revenue' | 'net_revenue')}
              className={INPUT_CLS}
            >
              <option value="revenue">{t(locale, 'revenue')}</option>
              <option value="net_revenue">{t(locale, 'net_revenue')}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'target_account')}</label>
          <select
            value={targetAccountId}
            onChange={(e) => setTargetAccountId(e.target.value)}
            className={INPUT_CLS}
          >
            <option value="">{t(locale, 'none')}</option>
            {reserveAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-muted">{t(locale, 'target_account_hint')}</p>
        </div>
        {error && <div className={ERROR_CLS}>{error}</div>}
      </form>
    </Dialog>
  );
}
