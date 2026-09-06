'use client';

// The Invoices area (proposal §2.2): every purchase across the Fibre apps,
// scoped Me / Team / Workspace (workspace = admin-or-above), searchable,
// with the row functions: open invoice, resend invoice, reimburse, mark
// paid. Detail dialog follows the Fibre bottom-bar contract.
//
// Copied from The Thread's invoices lane (the established pattern). Pulse
// twist: "Mark paid" opens a small dialog asking for the paid date and the
// bank account the money landed on (Sjoerd: "when mark as paid, you need to
// connect a bank account and a date") — the API snapshots the balance and
// settles the matching plan line.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BadgeEuro,
  Link2,
  Mail,
  RotateCcw,
  Search,
  User,
  Users,
  Building2,
} from 'lucide-react';
import {
  listPurchases,
  resendInvoice,
  refundPurchase,
  markPurchasePaid,
  emailInvoice,
  sendPaymentLink,
  type PurchaseList,
  type PurchaseRow,
} from './actions';
import { InvoiceDialog } from '@thefibre/shared/ui/invoice-dialog';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';

/** PostgREST join normalizer: object-or-array → object. */
function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

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

// Which cashflow chip does this account carry? (Same rule as the Accounts
// page — null there means "no chip", here the group is named Workspace.)
function cashflowLabel(
  locale: Locale,
  a: Pick<InvoiceAccount, 'team_id' | 'owner_user_id'>,
  teams: CashflowTeam[],
  myUserId: string | null,
): string {
  if (a.owner_user_id)
    return a.owner_user_id === myUserId ? t(locale, 'me') : t(locale, 'personal');
  if (a.team_id)
    return teams.find((row) => row.team_id === a.team_id)?.name ?? t(locale, 'team');
  return t(locale, 'workspace');
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  refunded: 'bg-surface-sunken text-ink-muted ring-line',
  failed: 'bg-red-50 text-red-700 ring-red-200',
};

function fmt(intlLocale: string, cents: number, currency: string): string {
  return new Intl.NumberFormat(intlLocale, { style: 'currency', currency: currency || 'EUR' }).format(
    cents / 100,
  );
}

function fmtDate(intlLocale: string, iso: string): string {
  return new Intl.DateTimeFormat(intlLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function todayLocalIso(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local tz
}

type Scope = 'me' | 'team' | 'workspace';

// App names are product names — only "All apps" localizes.
const APP_OPTIONS = [
  { key: 'all', label: null },
  { key: 'fibre-pulse', label: 'Pulse' },
  { key: 'fibre-meet', label: 'Meet' },
  { key: 'the-thread', label: 'Thread' },
] as const;

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-line bg-surface-sunken p-5 text-sm text-ink-subtle">
      {children}
    </div>
  );
}

export function InvoicesClient({
  teams,
  defaultApp = 'all',
  accounts,
  cashflowTeams,
  myUserId,
  locale,
}: {
  teams: { id: string; name: string }[];
  /** Which app's sales to show first — the current app, typically. */
  defaultApp?: string;
  /** Every Pulse account the user can see — the mark-paid "received on" options. */
  accounts: InvoiceAccount[];
  /** Involved teams — names for the cashflow group labels. */
  cashflowTeams: CashflowTeam[];
  myUserId: string | null;
  locale: Locale;
}) {
  const intl = INTL_LOCALES[locale];
  const [scope, setScope] = useState<Scope>('me');
  const [app, setApp] = useState<string>(defaultApp);
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
  const [q, setQ] = useState('');
  const [data, setData] = useState<PurchaseList | null>(null);
  const [items, setItems] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PurchaseRow | null>(null);
  const [confirmRefund, setConfirmRefund] = useState<PurchaseRow | null>(null);
  const [markPaid, setMarkPaid] = useState<PurchaseRow | null>(null);
  const [paidDate, setPaidDate] = useState(todayLocalIso());
  const [paidAccountId, setPaidAccountId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (cursor?: string | null) => {
      const r = await listPurchases({
        scope,
        teamId: scope === 'team' ? teamId : null,
        q: q.trim() || undefined,
        app: app === 'all' ? undefined : app,
        cursor,
      });
      if (!r.ok) {
        setError(r.error);
        return null;
      }
      setError(null);
      return r.data;
    },
    [scope, teamId, q, app],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const d = await load();
      if (cancelled) return;
      if (d) {
        setData(d);
        setItems(d.items);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const isAdmin = data?.role === 'admin' || data?.role === 'super_admin';

  function onSearchInput(v: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setQ(v), 300);
  }

  async function loadMore() {
    if (!data?.next_cursor) return;
    setLoadingMore(true);
    const d = await load(data.next_cursor);
    if (d) {
      setData(d);
      setItems((prev) => [...prev, ...d.items]);
    }
    setLoadingMore(false);
  }

  async function run(
    action: (id: string) => Promise<{ ok: boolean } | { ok: false; error: string }>,
    row: PurchaseRow,
    okMsg: string,
  ) {
    setBusy(true);
    setNotice(null);
    const r = await action(row.id);
    setBusy(false);
    if (!r.ok) {
      setNotice((r as { error: string }).error);
      return;
    }
    setNotice(okMsg);
    // Refresh in place.
    const d = await load();
    if (d) {
      setData(d);
      setItems(d.items);
      setDetail((prev) => (prev ? d.items.find((i) => i.id === prev.id) ?? null : null));
    }
  }

  function openMarkPaid(row: PurchaseRow) {
    setPaidDate(todayLocalIso());
    setPaidAccountId('');
    setMarkPaid(row);
  }

  // The mark-paid options, grouped by cashflow: Workspace first, Me second,
  // then the team cashflows, then other people's personal accounts.
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

  const scopes: { key: Scope; label: string; Icon: typeof User; disabled?: boolean }[] = [
    { key: 'me', label: t(locale, 'me'), Icon: User },
    { key: 'team', label: t(locale, 'team'), Icon: Users, disabled: teams.length === 0 },
    {
      key: 'workspace',
      label: t(locale, 'workspace'),
      Icon: Building2,
      disabled: data ? !isAdmin : false,
    },
  ];

  return (
    <div className="mt-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid grid-cols-3 rounded-md border border-line overflow-hidden h-[36px] text-sm">
          {scopes.map(({ key, label, Icon, disabled }) => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              title={
                key === 'workspace' && disabled
                  ? t(locale, 'ws_invoices_admin_title')
                  : undefined
              }
              onClick={() => setScope(key)}
              className={`inline-flex items-center justify-center gap-1.5 px-4 ${
                disabled
                  ? 'text-ink-muted opacity-50 cursor-not-allowed'
                  : scope === key
                    ? 'bg-surface-sunken text-ink font-medium'
                    : 'bg-surface text-ink-subtle hover:text-ink hover:bg-surface-sunken'
              }`}
            >
              <Icon size={14} strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>

        {scope === 'team' && teams.length > 0 && (
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="h-9 rounded-md border border-line bg-surface-raised px-2.5 text-sm focus:border-line-strong focus:outline-none"
          >
            {teams.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        )}

        <div className="inline-flex items-center gap-1">
          {APP_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setApp(o.key)}
              className={`text-xs px-2.5 py-1 rounded-full ring-1 transition-colors ${
                app === o.key
                  ? 'ring-line-strong bg-surface-sunken text-ink font-medium'
                  : 'ring-line bg-surface-raised text-ink-subtle hover:text-ink'
              }`}
            >
              {o.label ?? t(locale, 'all_apps')}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            defaultValue=""
            onChange={(e) => onSearchInput(e.target.value)}
            placeholder={t(locale, 'search_purchases_ph')}
            className="w-full h-9 rounded-md border border-line bg-surface-raised pl-9 pr-3 text-sm focus:border-line-strong focus:outline-none placeholder:text-ink-muted"
          />
        </div>
      </div>

      {/* Totals — one row per currency, never summed across (review #12). */}
      {data && (
        <div className="mt-4 space-y-1">
          {data.totals.currencies.map((tot) => (
            <div key={tot.currency} className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              {data.totals.currencies.length > 1 && (
                <span className="text-xs font-medium text-ink-muted w-8">{tot.currency}</span>
              )}
              <span>
                <span className="text-ink-muted">{t(locale, 'paid')}</span>{' '}
                <span className="font-medium tabular-nums">
                  {fmt(intl, tot.paid_cents, tot.currency)}
                </span>
              </span>
              <span>
                <span className="text-ink-muted">{t(locale, 'pending')}</span>{' '}
                <span className="font-medium tabular-nums">
                  {fmt(intl, tot.pending_cents, tot.currency)}
                </span>
              </span>
              <span>
                <span className="text-ink-muted">{t(locale, 'refunded')}</span>{' '}
                <span className="font-medium tabular-nums">
                  {fmt(intl, tot.refunded_cents, tot.currency)}
                </span>
              </span>
              <span>
                <span className="text-ink-muted">{t(locale, 'platform_fees')}</span>{' '}
                <span className="font-medium tabular-nums">
                  {fmt(intl, tot.fees_cents, tot.currency)}
                </span>
              </span>
            </div>
          ))}
          <div className="text-xs text-ink-muted">
            {data.totals.count === 1
              ? t(locale, 'purchase_count_one')
              : t(locale, 'purchase_count_many', { n: data.totals.count })}
            {data.totals.count >= 2000 ? t(locale, 'first_2000') : ''}
          </div>
        </div>
      )}

      {notice && <p className="mt-3 text-xs text-ink-subtle">{notice}</p>}
      {error && (
        <p className="mt-4 text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* List */}
      {loading ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-lg border border-line bg-surface-sunken/50 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState>{t(locale, 'no_purchases')}</EmptyState>
      ) : (
        <ul className="mt-4 divide-y divide-line border border-line rounded-lg bg-surface-raised">
          {items.map((row) => {
            const rowApp = one(row.app);
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setDetail(row)}
                  className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-surface-sunken/60 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{row.payer_name || row.payer_email}</div>
                    <div className="text-xs text-ink-subtle mt-0.5 truncate">
                      {row.item_label}
                      {rowApp?.name ? ` · ${rowApp.name}` : ''}
                    </div>
                  </div>
                  <span className="text-xs text-ink-muted shrink-0">
                    {fmtDate(intl, row.created_at)}
                  </span>
                  <span className="text-sm font-medium tabular-nums shrink-0">
                    {fmt(intl, row.amount_cents, row.currency)}
                  </span>
                  <span className="text-[11px] text-ink-muted shrink-0 w-14">
                    {row.method === 'invoice'
                      ? t(locale, 'method_invoice')
                      : row.method === 'free'
                        ? t(locale, 'method_free')
                        : t(locale, 'method_card')}
                  </span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full ring-1 capitalize shrink-0 ${
                      STATUS_STYLES[row.status] ?? STATUS_STYLES.pending
                    }`}
                  >
                    {row.status === 'pending'
                      ? t(locale, 'status_pending')
                      : row.status === 'paid'
                        ? t(locale, 'status_paid')
                        : row.status === 'refunded'
                          ? t(locale, 'status_refunded')
                          : row.status === 'failed'
                            ? t(locale, 'status_failed')
                            : row.status}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {data?.next_cursor && (
        <div className="mt-3">
          <Button variant="secondary" size="sm" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? t(locale, 'loading') : t(locale, 'load_more')}
          </Button>
        </div>
      )}

      {/* Detail dialog — THE canonical invoice viewer (shared); management
          actions stay app-side in its action bar (build-plan 1f). */}
      {detail && (
        <InvoiceDialog
          purchase={detail}
          open
          onClose={() => setDetail(null)}
          pdfHref={`/invoices/${detail.id}/pdf`}
          onEmail={async (to) => {
            const r = await emailInvoice(detail.id, to);
            return r.ok ? null : r.error;
          }}
          actions={
            <>
              {detail.status === 'paid' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leading={<RotateCcw size={14} />}
                  disabled={busy}
                  onClick={() => setConfirmRefund(detail)}
                >
                  {t(locale, 'reimburse')}
                </Button>
              )}
              {detail.method === 'invoice' && detail.status === 'pending' && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    leading={<BadgeEuro size={14} />}
                    disabled={busy}
                    onClick={() => openMarkPaid(detail)}
                  >
                    {t(locale, 'mark_paid')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    leading={<Link2 size={14} />}
                    disabled={busy}
                    onClick={() =>
                      void run(sendPaymentLink, detail, t(locale, 'link_sent_notice'))
                    }
                  >
                    {t(locale, 'send_payment_link')}
                  </Button>
                </>
              )}
              {detail.stripe_invoice_url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leading={<Mail size={14} />}
                  disabled={busy}
                  onClick={() => void run(resendInvoice, detail, t(locale, 'invoice_sent_notice'))}
                >
                  {t(locale, 'resend_invoice')}
                </Button>
              )}
            </>
          }
        >
          {(detail.platform_fee_cents > 0 ||
            detail.vendor_share_cents > 0 ||
            detail.org_share_cents > 0) && (
            <div className="text-ink-subtle">
              {t(locale, 'split_line', {
                fee: fmt(intl, detail.platform_fee_cents, detail.currency),
                org: fmt(intl, detail.vendor_share_cents, detail.currency),
                ws: fmt(intl, detail.org_share_cents, detail.currency),
              })}
            </div>
          )}
          {detail.refunded_at && (
            <div className="mt-1 text-ink-subtle">
              {t(locale, 'refunded_on', { d: fmtDate(intl, detail.refunded_at) })}
            </div>
          )}
          {notice && <p className="mt-1 text-ink-subtle">{notice}</p>}
        </InvoiceDialog>
      )}

      {/* Mark paid — date + receiving account (Sjoerd 2026-07-10). */}
      {markPaid && (
        <Dialog
          open
          onClose={() => setMarkPaid(null)}
          title={t(locale, 'mark_paid_title')}
          description={`${markPaid.payer_name || markPaid.payer_email} · ${fmt(
            intl,
            markPaid.amount_cents,
            markPaid.currency,
          )}`}
          size="sm"
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setMarkPaid(null)}
              >
                {t(locale, 'cancel')}
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  const row = markPaid;
                  if (!row) return;
                  void run(
                    (id) =>
                      markPurchasePaid(id, {
                        paid_date: paidDate,
                        account_id: paidAccountId || undefined,
                      }),
                    row,
                    t(locale, 'marked_paid_notice'),
                  ).then(() => setMarkPaid(null));
                }}
              >
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
          </div>
        </Dialog>
      )}

      <ConfirmDialog
        open={!!confirmRefund}
        onCancel={() => setConfirmRefund(null)}
        onConfirm={() => {
          const row = confirmRefund;
          setConfirmRefund(null);
          if (row) void run(refundPurchase, row, t(locale, 'reimbursed_notice'));
        }}
        title={t(locale, 'reimburse_q')}
        message={
          confirmRefund
            ? t(locale, 'reimburse_msg', {
                payer: confirmRefund.payer_name || confirmRefund.payer_email || '',
                amount: fmt(intl, confirmRefund.amount_cents, confirmRefund.currency),
                via:
                  confirmRefund.method === 'stripe'
                    ? t(locale, 'reimburse_via_stripe')
                    : t(locale, 'reimburse_via_outside'),
              })
            : ''
        }
        confirmLabel={t(locale, 'reimburse')}
        destructive
        pending={busy}
      />
    </div>
  );
}

