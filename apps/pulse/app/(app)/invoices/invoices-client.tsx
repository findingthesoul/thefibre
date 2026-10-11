'use client';

// Pulse's Invoices — THE shared area, plus the one thing that is Pulse's own.
//
// This file was 659 lines and began "Copied from The Thread's invoices lane".
// It had already drifted: the same ledger, the same rows, a different screen.
// Sjoerd, on the platform's own invoices: *"same ledger = single point of
// truth, but the UI is a fork."*
//
// What was genuinely Pulse's, and is kept, is the mark-paid: before an
// invoice can be settled Pulse needs the date the money arrived and which
// bank account it landed on (Sjoerd: *"when mark as paid, you need to connect
// a bank account and a date"*), because the API snapshots the balance and
// settles the matching plan line. Nothing else in the fork was different on
// purpose.
//
// So the shared area keeps the list, the search, the scopes, the app chips
// and the detail dialog, and this file injects `renderMarkPaid`. Widening the
// shared `markPurchasePaid` with a date and an account would have put Pulse's
// bank accounts into every other app's contract.

import { useState } from 'react';
import { InvoicesArea, type PurchaseRow } from '@thefibre/shared/ui/invoices';
import {
  listPurchases,
  resendInvoice,
  refundPurchase,
  markPurchasePaid,
  emailInvoice,
  sendPaymentLink,
} from './actions';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';

// Pulse account, trimmed to what the mark-paid dialog needs. Cashflow scope:
// both null = Workspace; owner_user_id = personal ("Me"); team_id = that
// team's cashflow (mirrors the Accounts page).
export type InvoiceAccount = {
  id: string;
  name: string;
  kind: 'bank' | 'reserve';
  team_id: string | null;
  owner_user_id: string | null;
};

// Involved team, already flattened by the server component.
export type CashflowTeam = { team_id: string; name: string };

function cashflowLabel(
  locale: Locale,
  a: Pick<InvoiceAccount, 'team_id' | 'owner_user_id'>,
  teams: CashflowTeam[],
  myUserId: string | null,
): string {
  if (a.owner_user_id)
    return a.owner_user_id === myUserId ? t(locale, 'me') : t(locale, 'personal');
  if (a.team_id) return teams.find((row) => row.team_id === a.team_id)?.name ?? t(locale, 'team');
  return t(locale, 'workspace');
}

function todayLocalIso(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local tz
}

// App names are product names — only "All apps" localizes.
const APP_OPTIONS = (locale: Locale) => [
  { key: 'all', label: t(locale, 'all_apps') },
  { key: 'fibre-pulse', label: 'Pulse' },
  { key: 'fibre-meet', label: 'Meet' },
  { key: 'the-thread', label: 'Thread' },
];

export function InvoicesClient({
  teams,
  defaultApp = 'fibre-pulse',
  accounts,
  cashflowTeams,
  myUserId,
  locale,
}: {
  teams: { id: string; name: string }[];
  defaultApp?: string;
  accounts: InvoiceAccount[];
  cashflowTeams: CashflowTeam[];
  myUserId: string | null;
  locale: Locale;
}) {
  return (
    <InvoicesArea
      teams={teams}
      defaultApp={defaultApp}
      appOptions={APP_OPTIONS(locale)}
      actions={{
        listPurchases,
        resendInvoice,
        refundPurchase,
        emailInvoice,
        sendPaymentLink,
        // markPurchasePaid is deliberately absent: Pulse cannot settle an
        // invoice from an id alone, and renderMarkPaid below is the flow that
        // can. Passing both would leave two ways to do one thing.
      }}
      renderMarkPaid={(row, done) => (
        <MarkPaidDialog
          row={row}
          done={done}
          accounts={accounts}
          cashflowTeams={cashflowTeams}
          myUserId={myUserId}
          locale={locale}
        />
      )}
    />
  );
}

/**
 * The date the money arrived, and the account it arrived on.
 *
 * The account is OPTIONAL — "don't record" is a real answer. An invoice can
 * be paid in a way Pulse is not tracking, and forcing a bank account would
 * make the honest choice impossible and the dishonest one easy.
 */
function MarkPaidDialog({
  row,
  done,
  accounts,
  cashflowTeams,
  myUserId,
  locale,
}: {
  row: PurchaseRow;
  done: (refresh?: boolean) => void;
  accounts: InvoiceAccount[];
  cashflowTeams: CashflowTeam[];
  myUserId: string | null;
  locale: Locale;
}) {
  const [paidDate, setPaidDate] = useState(todayLocalIso());
  const [paidAccountId, setPaidAccountId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const intl = INTL_LOCALES[locale];
  const amount = new Intl.NumberFormat(intl, {
    style: 'currency',
    currency: row.currency || 'EUR',
  }).format((row.amount_cents ?? 0) / 100);

  // Grouped by cashflow: Workspace first, Me second, then the team
  // cashflows, then other people's personal accounts.
  const accountGroups = (() => {
    const groups = new Map<string, InvoiceAccount[]>();
    for (const a of accounts) {
      const label = cashflowLabel(locale, a, cashflowTeams, myUserId);
      const list = groups.get(label) ?? [];
      list.push(a);
      groups.set(label, list);
    }
    const rank = (label: string) =>
      label === t(locale, 'workspace')
        ? 0
        : label === t(locale, 'me')
          ? 1
          : label === t(locale, 'personal')
            ? 3
            : 2;
    return [...groups.entries()].sort(
      (a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]),
    );
  })();

  function save() {
    setErr(null);
    setBusy(true);
    void markPurchasePaid(row.id, {
      paid_date: paidDate,
      account_id: paidAccountId || undefined,
    })
      .then((r) => {
        if (r && 'error' in r && r.error) {
          setErr(String(r.error));
          setBusy(false);
          return;
        }
        // true: the row changed, so the list behind this reloads.
        done(true);
      })
      .catch((e: unknown) => {
        setErr(e instanceof Error ? e.message : String(e));
        setBusy(false);
      });
  }

  return (
    <Dialog
      open
      onClose={() => done(false)}
      title={t(locale, 'mark_paid_title')}
      description={`${row.payer_name || row.payer_email} · ${amount}`}
      size="sm"
      footer={
        <>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => done(false)}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="button" disabled={busy} onClick={save}>
            {busy ? t(locale, 'working') : t(locale, 'mark_paid')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <DateField
          label={t(locale, 'paid_date')}
          name="paid_date"
          defaultValue={paidDate}
          required
          onValueChange={(v) => setPaidDate(v || todayLocalIso())}
        />
        <div>
          <label className="block text-sm text-ink-subtle mb-1" htmlFor="paid-account">
            {t(locale, 'received_on_account')}
          </label>
          <select
            id="paid-account"
            value={paidAccountId}
            onChange={(e) => setPaidAccountId(e.target.value)}
            className="w-full h-9 rounded-md border border-line bg-surface-raised px-2.5 text-sm focus:border-line-strong focus:outline-none"
          >
            <option value="">{t(locale, 'dont_record')}</option>
            {accountGroups.map(([label, list]) => (
              <optgroup key={label} label={label}>
                {list.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-ink-muted">{t(locale, 'mark_paid_hint')}</p>
        </div>
        {err && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {err}
          </p>
        )}
      </div>
    </Dialog>
  );
}
