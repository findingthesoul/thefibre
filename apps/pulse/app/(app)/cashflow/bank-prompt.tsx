'use client';

// The bank-balances popup (Sjoerd 2026-07-09: "a popup msg with bank data
// opens (checkbox: open every first visit per day)" + "not a row" — the
// popup is THE editing surface for balances; the grid rows are display-only).
// Two ways in: auto on the FIRST visit of the calendar day per tab
// (localStorage remembers last-shown date + the opt-out flag), and on demand
// from the BANK section header's "Update balances" affordance.
//
// CreateBankDialog: the empty-tab affordance — a small popup (name prefilled
// '<Tab> bank', bank/reserve toggle) that creates the tab's virtual account.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createAccount, recordSnapshots } from '../accounts/actions';
import { toastError } from './toast';
import { t, type Locale } from '@/lib/i18n-ui';
import type { CashflowScope, PulseAccount } from './types';

const STORE_PREFIX = 'thefibre.pulse.bank-prompt:';

type Stored = { last?: string; enabled?: boolean };

function todayLocalIso(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local tz
}

function loadStored(scopeKey: string): Stored {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORE_PREFIX + scopeKey) ?? '{}') as Stored;
  } catch {
    return {};
  }
}

function saveStored(scopeKey: string, patch: Stored): void {
  if (typeof window === 'undefined') return;
  try {
    const next = { ...loadStored(scopeKey), ...patch };
    window.localStorage.setItem(STORE_PREFIX + scopeKey, JSON.stringify(next));
  } catch {
    /* storage unavailable — the prompt just doesn't remember */
  }
}

// Euro string → integer cents. Accepts comma decimals ("1234,56").
function parseEuro(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = parseFloat(t);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

function centsToInput(cents: number | null): string {
  return cents == null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

export function BankPrompt({
  accounts,
  scopeKey,
  open,
  locale,
  onClose,
}: {
  locale: Locale;
  // The active tab's accounts (banks + reserves) — the auto prompt only
  // fires when there is at least one.
  accounts: PulseAccount[];
  scopeKey: string; // 'me' | 'team:<id>' | 'workspace'
  // On-demand opening (the BANK header's "Update balances").
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [autoOpen, setAutoOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [everyDay, setEveryDay] = useState(true);
  const [busy, setBusy] = useState(false);

  const isOpen = open || autoOpen;

  function resetValues() {
    setValues(
      Object.fromEntries(
        accounts.map((a) => [a.id, centsToInput(a.latest_snapshot?.balance_cents ?? null)]),
      ),
    );
    setEveryDay(loadStored(scopeKey).enabled !== false);
  }

  // First visit of the calendar day, per tab — checked after mount (the
  // server render can't read localStorage).
  useEffect(() => {
    if (accounts.length === 0) return;
    const stored = loadStored(scopeKey);
    if (stored.enabled === false) return;
    const today = todayLocalIso();
    if (stored.last === today) return;
    saveStored(scopeKey, { last: today }); // shown = counted, even if dismissed
    resetValues();
    setAutoOpen(true);
    // Deliberately keyed on the tab only — a refresh mid-day must not reopen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  // On-demand open: reload the inputs from the latest snapshots.
  useEffect(() => {
    if (open) resetValues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    saveStored(scopeKey, { enabled: everyDay });
    setAutoOpen(false);
    onClose();
  }

  async function save() {
    // Only balances that parse AND differ from the latest snapshot become
    // new (append-only) snapshots dated today.
    const entries = accounts.flatMap((a) => {
      const cents = parseEuro(values[a.id] ?? '');
      if (cents == null || cents === (a.latest_snapshot?.balance_cents ?? null)) return [];
      return [{ account_id: a.id, name: a.name, balance_cents: cents }];
    });
    saveStored(scopeKey, { enabled: everyDay });
    if (entries.length === 0) {
      setAutoOpen(false);
      onClose();
      return;
    }
    setBusy(true);
    const res = await recordSnapshots(todayLocalIso(), entries);
    setBusy(false);
    if (res.error) {
      toastError(t(locale, 'balances_error', { error: res.error }));
      return;
    }
    setAutoOpen(false);
    onClose();
    router.refresh();
  }

  if (!isOpen || accounts.length === 0) return null;

  return (
    <Dialog
      open
      onClose={close}
      title={t(locale, 'bank_prompt_title')}
      description={t(locale, 'bank_prompt_desc')}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={close} disabled={busy}>
            {t(locale, 'not_now')}
          </Button>
          <Button type="button" onClick={() => void save()} disabled={busy}>
            {busy ? t(locale, 'saving') : t(locale, 'save_balances')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {accounts.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
              <span className="truncate" title={a.name}>
                {a.name}
              </span>
              {a.kind === 'reserve' && (
                <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500">
                  {t(locale, 'reserve_lc')}
                </span>
              )}
            </span>
            <input
              value={values[a.id] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [a.id]: e.target.value }))}
              inputMode="decimal"
              placeholder="0,00"
              aria-label={t(locale, 'balance_for_aria', { name: a.name })}
              className="w-32 rounded-md border border-line bg-white px-2 py-1.5 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-neutral-300"
            />
          </div>
        ))}
        <label className="mt-4 flex items-center gap-2 border-t border-line/60 pt-3 text-xs text-ink-subtle">
          <input
            type="checkbox"
            checked={everyDay}
            onChange={(e) => setEveryDay(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-line"
          />
          {t(locale, 'open_first_visit')}
        </label>
      </div>
    </Dialog>
  );
}

// The empty-tab affordance (Sjoerd: "This cashflow has no bank yet") — a
// small popup, name prefilled '<Tab name> bank', bank/reserve toggle. The
// account is created in the ACTIVE tab's scope (me / team / workspace); the
// API's RLS decides who may.
export function CreateBankDialog({
  tabName,
  scope,
  scopeTeamId,
  currentUserId,
  initialKind,
  locale,
  onClose,
}: {
  tabName: string;
  scope: CashflowScope;
  scopeTeamId: string | null;
  currentUserId: string | null;
  initialKind: 'bank' | 'reserve';
  locale: Locale;
  onClose: () => void;
}) {
  const router = useRouter();
  const bankDefault = t(locale, 'tab_bank_name', { tab: tabName });
  const reserveDefault = t(locale, 'tab_reserve_name', { tab: tabName });
  const [name, setName] = useState(initialKind === 'reserve' ? reserveDefault : bankDefault);
  const [kind, setKind] = useState<'bank' | 'reserve'>(initialKind);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    const n = name.trim();
    if (!n) {
      setError(t(locale, 'give_account_name'));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createAccount({
      name: n,
      kind,
      // Scope per tab: personal / team / workspace (null/null).
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
      title={kind === 'reserve' ? t(locale, 'new_reserve') : t(locale, 'create_bank')}
      description={t(locale, 'create_bank_desc', { tab: tabName })}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="create-bank-form" disabled={busy}>
            {busy ? t(locale, 'creating') : t(locale, 'create')}
          </Button>
        </>
      }
    >
      <form id="create-bank-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">{t(locale, 'name')}</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t(locale, 'kind')}</label>
          <div className="inline-flex rounded-lg ring-1 ring-line bg-surface-raised p-0.5">
            {(
              [
                ['bank', t(locale, 'bank')],
                ['reserve', t(locale, 'reserve')],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  // Follow the default name along as long as it's untouched.
                  setName((cur) => {
                    const defaults = [bankDefault, reserveDefault];
                    return defaults.includes(cur.trim())
                      ? key === 'reserve'
                        ? reserveDefault
                        : bankDefault
                      : cur;
                  });
                  setKind(key);
                }}
                aria-pressed={kind === key}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  kind === key ? 'bg-ink text-ink-inverse' : 'text-ink-subtle hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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
