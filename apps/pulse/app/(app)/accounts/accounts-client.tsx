'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw } from 'lucide-react';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/money';
import { archiveAccount, createAccount, recordSnapshots, updateAccount } from './actions';

export type Account = {
  id: string;
  name: string;
  kind: 'bank' | 'reserve';
  parent_account_id: string | null;
  sync_mode: 'manual' | 'auto';
  latest_snapshot: { balance_cents: number; as_of_date: string } | null;
};

const INPUT_CLASS =
  'w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';

// Euro string → integer cents. Accepts comma decimals ("1.234,56" style is
// NOT parsed — plain "1234,56" or "1234.56").
function parseEuro(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = parseFloat(t);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function todayLocalIso(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local tz
}

// ---------------------------------------------------------------------------
// Header actions — "Update balances" (primary, the Monday ritual) + "New
// account".
// ---------------------------------------------------------------------------
export function AccountsActions({ accounts }: { accounts: Account[] }) {
  const [dialog, setDialog] = useState<'new' | 'balances' | null>(null);
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        leading={<Plus size={16} strokeWidth={2} />}
        onClick={() => setDialog('new')}
      >
        New account
      </Button>
      <Button
        leading={<RefreshCw size={16} strokeWidth={2} />}
        onClick={() => setDialog('balances')}
        disabled={accounts.length === 0}
      >
        Update balances
      </Button>
      {dialog === 'new' && <AccountDialog accounts={accounts} onClose={() => setDialog(null)} />}
      {dialog === 'balances' && (
        <UpdateBalancesDialog accounts={accounts} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account groups — same cards as before, rows now open the edit dialog.
// ---------------------------------------------------------------------------
export function AccountsList({ accounts }: { accounts: Account[] }) {
  const [editing, setEditing] = useState<Account | null>(null);
  const banks = accounts.filter((a) => a.kind === 'bank');
  const reserves = accounts.filter((a) => a.kind === 'reserve');

  if (accounts.length === 0) {
    return (
      <div className="mt-10 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center">
        <p className="text-sm text-ink-muted">
          No accounts yet. Add your bank accounts first, then reserves earmarked inside them.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <AccountGroup title="Bank accounts" items={banks} onSelect={setEditing} />
        <AccountGroup title="Reserves" items={reserves} onSelect={setEditing} />
      </div>
      {editing && (
        <AccountDialog accounts={accounts} account={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function AccountGroup({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: Account[];
  onSelect: (a: Account) => void;
}) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
      <div className="px-5 py-3 border-b border-line text-sm font-semibold tracking-tight">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="px-5 py-3 text-sm text-ink-muted">None yet.</div>
      ) : (
        <div className="divide-y divide-line/60">
          {items.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelect(a)}
              className="w-full text-left px-5 py-3 flex items-center gap-4 hover:bg-surface-sunken/60 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink truncate">{a.name}</div>
                <div className="text-xs text-ink-muted">
                  {a.latest_snapshot ? `as of ${a.latest_snapshot.as_of_date}` : 'no balance yet'}
                  {a.sync_mode === 'auto' ? ' · auto' : ''}
                </div>
              </div>
              <span className="text-sm font-medium text-ink">
                {a.latest_snapshot ? money(a.latest_snapshot.balance_cents) : '—'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New / edit account dialog. Delete (archive) sits left, per the Fibre
// dialog bottom-bar contract.
// ---------------------------------------------------------------------------
function AccountDialog({
  accounts,
  account,
  onClose,
}: {
  accounts: Account[];
  account?: Account;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(account?.name ?? '');
  const [kind, setKind] = useState<'bank' | 'reserve'>(account?.kind ?? 'bank');
  const [parentId, setParentId] = useState(account?.parent_account_id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const banks = accounts.filter((a) => a.kind === 'bank' && a.id !== account?.id);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      name: name.trim(),
      kind,
      parent_account_id: kind === 'reserve' && parentId ? parentId : null,
    };
    const res = account
      ? await updateAccount(account.id, payload)
      : await createAccount(payload);
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    onClose();
    router.refresh();
  }

  async function doArchive() {
    if (!account) return;
    setBusy(true);
    const res = await archiveAccount(account.id);
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
        title={account ? 'Edit account' : 'New account'}
        footer={
          <>
            {account && (
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
            <Button type="submit" form="account-form" disabled={busy}>
              {busy ? 'Saving…' : account ? 'Save' : 'Create account'}
            </Button>
          </>
        }
      >
        <form id="account-form" onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rabobank current"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kind</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as 'bank' | 'reserve')}
              className={INPUT_CLASS}
            >
              <option value="bank">Bank account</option>
              <option value="reserve">Reserve</option>
            </select>
            <p className="mt-1.5 text-xs text-ink-muted">
              Reserves are earmarked money — in the bank, not yours to spend.
            </p>
          </div>
          {kind === 'reserve' && (
            <div>
              <label className="block text-sm font-medium mb-1">Held in bank account</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">— none —</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
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
        title="Archive this account?"
        message="The account disappears from lists and the projection. Its balance history is kept."
        confirmLabel="Archive"
        destructive
        pending={busy}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Update balances — the 60-second Monday ritual. Every account, one euro
// input each, banks first. Only touched rows are saved.
// ---------------------------------------------------------------------------
function UpdateBalancesDialog({
  accounts,
  onClose,
}: {
  accounts: Account[];
  onClose: () => void;
}) {
  const router = useRouter();
  const banks = accounts.filter((a) => a.kind === 'bank');
  const reserves = accounts.filter((a) => a.kind === 'reserve');
  const ordered = [...banks, ...reserves];

  const [asOf, setAsOf] = useState(todayLocalIso());
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const a of accounts) {
      v[a.id] = a.latest_snapshot ? centsToInput(a.latest_snapshot.balance_cents) : '';
    }
    return v;
  });
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setValue(id: string, s: string) {
    setValues((prev) => ({ ...prev, [id]: s }));
    setDirty((prev) => new Set(prev).add(id));
  }

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!asOf) {
      setError('Pick an as-of date.');
      return;
    }
    const entries: { account_id: string; name: string; balance_cents: number }[] = [];
    for (const a of ordered) {
      if (!dirty.has(a.id)) continue; // untouched — skip
      const raw = values[a.id] ?? '';
      if (!raw.trim()) continue; // cleared/empty — skip
      const cents = parseEuro(raw);
      if (cents === null) {
        setError(`${a.name}: "${raw}" is not a valid amount.`);
        return;
      }
      entries.push({ account_id: a.id, name: a.name, balance_cents: cents });
    }
    if (entries.length === 0) {
      setError('Nothing to save — change at least one balance first.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await recordSnapshots(asOf, entries);
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
      title="Update balances"
      description="Type what the bank says. Only rows you touch are saved."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="balances-form" disabled={busy}>
            {busy ? 'Saving…' : 'Save balances'}
          </Button>
        </>
      }
    >
      <form id="balances-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">As of</label>
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        {banks.length > 0 && <BalanceGroup title="Bank accounts" items={banks} values={values} onChange={setValue} />}
        {reserves.length > 0 && (
          <BalanceGroup title="Reserves" items={reserves} values={values} onChange={setValue} />
        )}
        <p className="text-xs text-ink-muted">
          Balances are recorded as snapshots; history is kept.
        </p>
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </Dialog>
  );
}

function BalanceGroup({
  title,
  items,
  values,
  onChange,
}: {
  title: string;
  items: Account[];
  values: Record<string, string>;
  onChange: (id: string, s: string) => void;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
        {title}
      </div>
      <div className="space-y-2">
        {items.map((a) => (
          <div key={a.id} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-ink truncate">{a.name}</div>
              <div className="text-xs text-ink-muted">
                {a.latest_snapshot ? `last: ${a.latest_snapshot.as_of_date}` : 'no balance yet'}
              </div>
            </div>
            <div className="relative w-36">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
                €
              </span>
              <input
                inputMode="decimal"
                value={values[a.id] ?? ''}
                onChange={(e) => onChange(a.id, e.target.value)}
                placeholder="0,00"
                className={`${INPUT_CLASS} pl-7 text-right`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
