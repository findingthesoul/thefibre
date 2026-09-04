'use client';

// THE canonical Invoices area — one implementation for the whole family
// (Sjoerd, 2026-09-05: "every setting page, profile page, invoice screen —
// standard platform components; same look, same data, same behaviour").
// Extracted from Meet's copy, which Thread and Membership matched to within
// a dozen lines; the app-bound pieces (server actions, which app's chip is
// default) are injected as props. Pulse still runs its own variant — it
// carries ledger-matching extras; converge it when next touched.
//
// Per app what remains is a thin wrapper: page.tsx (teams + defaultApp) and
// actions.ts ('use server' wrappers over the purchases API — those must
// live in the app because they bake in its session + X-App-ID).

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
import { InvoiceDialog } from './invoice-dialog.js';

// ---------------------------------------------------------------------------
// The ledger row shapes — single source of truth; app actions import these.
// ---------------------------------------------------------------------------

export type PurchaseRow = {
  id: string;
  app: { slug: string; name: string } | { slug: string; name: string }[] | null;
  payer_name: string;
  payer_email: string | null;
  item_label: string;
  item_ref: string;
  organiser_user_id: string | null;
  team_id: string | null;
  amount_cents: number;
  currency: string;
  platform_fee_cents: number;
  vendor_share_cents: number;
  org_share_cents: number;
  method: 'stripe' | 'invoice' | 'free';
  status: 'pending' | 'paid' | 'refunded' | 'failed';
  stripe_invoice_url: string | null;
  billing?: {
    company?: string;
    address?: string;
    postal_code?: string;
    city?: string;
    country?: string;
    tax_no?: string;
  } | null;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
};

export type CurrencyTotals = {
  currency: string;
  paid_cents: number;
  pending_cents: number;
  refunded_cents: number;
  fees_cents: number;
};

export type PurchaseTotals = { count: number; currencies: CurrencyTotals[] };

export type PurchaseList = {
  items: PurchaseRow[];
  next_cursor: string | null;
  totals: PurchaseTotals;
  role: string;
};

export type ListPurchasesArgs = {
  scope: 'me' | 'team' | 'workspace';
  teamId: string | null;
  q?: string | undefined;
  app?: string | undefined;
  cursor?: string | null | undefined;
};

type ListResult = { ok: true; data: PurchaseList } | { ok: false; error: string };
type OpResult = { ok: boolean; error?: string };

/** The app-bound half: 'use server' actions, injected by each app's thin
 *  wrapper. Server-action references cross the client boundary fine. */
export type InvoiceActions = {
  listPurchases: (args: ListPurchasesArgs) => Promise<ListResult>;
  resendInvoice: (id: string) => Promise<OpResult>;
  refundPurchase: (id: string) => Promise<OpResult>;
  markPurchasePaid: (id: string) => Promise<OpResult>;
  sendPaymentLink: (id: string) => Promise<OpResult>;
  emailInvoice: (id: string, to: string) => Promise<OpResult>;
};

// ---------------------------------------------------------------------------

// PostgREST joins come back object-or-array — normalise.
function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  refunded: 'bg-surface-sunken text-ink-muted ring-line',
  failed: 'bg-red-50 text-red-700 ring-red-200',
};

function fmt(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'EUR' }).format(
    cents / 100,
  );
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

type Scope = 'me' | 'team' | 'workspace';

// Every app that writes the ledger. One list — an app that adds itself to
// recordPurchase's union adds itself here, and every Invoices page in the
// family grows the chip at once.
const DEFAULT_APP_OPTIONS: { key: string; label: string }[] = [
  { key: 'all', label: 'All apps' },
  { key: 'fibre-meet', label: 'Meet' },
  { key: 'the-thread', label: 'Thread' },
  { key: 'fibre-pulse', label: 'Pulse' },
  { key: 'membership', label: 'Membership' },
];

// Self-contained ghost/secondary buttons — the area must not depend on any
// app's component folder (the whole point of living here).
function GhostBtn({
  children,
  onClick,
  disabled,
  leading,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  leading?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-ink-subtle hover:text-ink hover:bg-surface-sunken disabled:opacity-50 transition-colors"
    >
      {leading}
      {children}
    </button>
  );
}

export function InvoicesArea({
  teams,
  defaultApp = 'all',
  appOptions = DEFAULT_APP_OPTIONS,
  actions,
}: {
  teams: { id: string; name: string }[];
  /** Which app's sales to show first — the current app, typically. */
  defaultApp?: string;
  appOptions?: { key: string; label: string }[];
  actions: InvoiceActions;
}) {
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
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (cursor?: string | null) => {
      const r = await actions.listPurchases({
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
    [scope, teamId, q, app, actions],
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

  async function run(action: (id: string) => Promise<OpResult>, row: PurchaseRow, okMsg: string) {
    setBusy(true);
    setNotice(null);
    const r = await action(row.id);
    setBusy(false);
    if (!r.ok) {
      setNotice(r.error ?? 'That did not work — try again.');
      return;
    }
    setNotice(okMsg);
    // Refresh in place.
    const d = await load();
    if (d) {
      setData(d);
      setItems(d.items);
      setDetail((prev) => (prev ? (d.items.find((i) => i.id === prev.id) ?? null) : null));
    }
  }

  const scopes: { key: Scope; label: string; Icon: typeof User; disabled?: boolean }[] = [
    { key: 'me', label: 'Me', Icon: User },
    { key: 'team', label: 'Team', Icon: Users, disabled: teams.length === 0 },
    { key: 'workspace', label: 'Workspace', Icon: Building2, disabled: data ? !isAdmin : false },
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
                  ? 'Workspace-wide invoices need an Admin role'
                  : undefined
              }
              onClick={() => setScope(key)}
              className={`inline-flex items-center justify-center gap-1.5 px-4 ${
                disabled
                  ? 'text-ink-muted opacity-50 cursor-not-allowed'
                  : scope === key
                    ? 'bg-ink text-ink-inverse font-medium'
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
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}

        <div className="inline-flex items-center gap-1">
          {appOptions.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setApp(o.key)}
              className={`text-xs px-2.5 py-1 rounded-full ring-1 transition-colors ${
                app === o.key
                  ? 'ring-ink bg-ink text-ink-inverse font-medium'
                  : 'ring-line bg-surface-raised text-ink-subtle hover:text-ink'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            defaultValue=""
            onChange={(e) => onSearchInput(e.target.value)}
            placeholder="Search payer, email or item…"
            className="w-full h-9 rounded-md border border-line bg-surface-raised pl-9 pr-3 text-sm focus:border-line-strong focus:outline-none placeholder:text-ink-muted"
          />
        </div>
      </div>

      {/* Totals — one row per currency, never summed across (review #12). */}
      {data && (
        <div className="mt-4 space-y-1">
          {data.totals.currencies.map((t) => (
            <div key={t.currency} className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              {data.totals.currencies.length > 1 && (
                <span className="text-xs font-medium text-ink-muted w-8">{t.currency}</span>
              )}
              <span>
                <span className="text-ink-muted">Paid</span>{' '}
                <span className="font-medium tabular-nums">{fmt(t.paid_cents, t.currency)}</span>
              </span>
              <span>
                <span className="text-ink-muted">Pending</span>{' '}
                <span className="font-medium tabular-nums">{fmt(t.pending_cents, t.currency)}</span>
              </span>
              <span>
                <span className="text-ink-muted">Refunded</span>{' '}
                <span className="font-medium tabular-nums">
                  {fmt(t.refunded_cents, t.currency)}
                </span>
              </span>
              <span>
                <span className="text-ink-muted">Platform fees</span>{' '}
                <span className="font-medium tabular-nums">{fmt(t.fees_cents, t.currency)}</span>
              </span>
            </div>
          ))}
          <div className="text-xs text-ink-muted">
            {data.totals.count} purchase{data.totals.count === 1 ? '' : 's'}
            {data.totals.count >= 2000 ? ' (first 2000)' : ''}
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
            <div
              key={i}
              className="h-12 rounded-lg border border-line bg-surface-sunken/50 animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-ink-muted text-center">No purchases in this view yet.</p>
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
                    <div className="text-sm font-medium truncate">
                      {row.payer_name || row.payer_email}
                    </div>
                    <div className="text-xs text-ink-subtle mt-0.5 truncate">
                      {row.item_label}
                      {rowApp?.name ? ` · ${rowApp.name}` : ''}
                    </div>
                  </div>
                  <span className="text-xs text-ink-muted shrink-0">{fmtDate(row.created_at)}</span>
                  <span className="text-sm font-medium tabular-nums shrink-0">
                    {fmt(row.amount_cents, row.currency)}
                  </span>
                  <span className="text-[11px] text-ink-muted shrink-0 w-14">
                    {row.method === 'invoice'
                      ? 'Invoice'
                      : row.method === 'free'
                        ? 'Free (code)'
                        : 'Card'}
                  </span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full ring-1 capitalize shrink-0 ${
                      STATUS_STYLES[row.status] ?? STATUS_STYLES.pending
                    }`}
                  >
                    {row.status}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {data?.next_cursor && (
        <div className="mt-3">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            className="rounded-md border border-line bg-surface-raised px-3 py-1.5 text-sm text-ink-subtle hover:text-ink hover:bg-surface-sunken disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}

      {/* Detail dialog — THE canonical invoice viewer; management actions
          stay injected app-side semantics but render here identically. */}
      {detail && (
        <InvoiceDialog
          purchase={detail}
          open
          onClose={() => setDetail(null)}
          pdfHref={`/invoices/${detail.id}/pdf`}
          onEmail={async (to) => {
            const r = await actions.emailInvoice(detail.id, to);
            return r.ok ? null : (r.error ?? 'could not send');
          }}
          actions={
            <>
              {detail.status === 'paid' && (
                <GhostBtn
                  leading={<RotateCcw size={14} />}
                  disabled={busy}
                  onClick={() => setConfirmRefund(detail)}
                >
                  Reimburse
                </GhostBtn>
              )}
              {detail.method === 'invoice' && detail.status === 'pending' && (
                <>
                  <GhostBtn
                    leading={<BadgeEuro size={14} />}
                    disabled={busy}
                    onClick={() => void run(actions.markPurchasePaid, detail, 'Marked as paid.')}
                  >
                    Mark paid
                  </GhostBtn>
                  <GhostBtn
                    leading={<Link2 size={14} />}
                    disabled={busy}
                    onClick={() =>
                      void run(actions.sendPaymentLink, detail, 'Payment link sent to the payer.')
                    }
                  >
                    Send payment link
                  </GhostBtn>
                </>
              )}
              {detail.stripe_invoice_url && (
                <GhostBtn
                  leading={<Mail size={14} />}
                  disabled={busy}
                  onClick={() => void run(actions.resendInvoice, detail, 'Invoice sent to the payer.')}
                >
                  Resend invoice
                </GhostBtn>
              )}
            </>
          }
        >
          {(detail.platform_fee_cents > 0 ||
            detail.vendor_share_cents > 0 ||
            detail.org_share_cents > 0) && (
            <div className="text-ink-subtle">
              Split: fee {fmt(detail.platform_fee_cents, detail.currency)} · organiser{' '}
              {fmt(detail.vendor_share_cents, detail.currency)} · workspace{' '}
              {fmt(detail.org_share_cents, detail.currency)}
            </div>
          )}
          {detail.refunded_at && (
            <div className="mt-1 text-ink-subtle">Refunded {fmtDate(detail.refunded_at)}</div>
          )}
          {notice && <p className="mt-1 text-ink-subtle">{notice}</p>}
        </InvoiceDialog>
      )}

      {/* Refund confirm — self-contained (the dialog contract's small form). */}
      {confirmRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => !busy && setConfirmRefund(null)}
          />
          <div className="relative w-full max-w-sm rounded-xl bg-surface-raised border border-line shadow-xl p-5">
            <h2 className="text-base font-semibold text-ink">Reimburse this purchase?</h2>
            <p className="mt-2 text-sm text-ink-subtle">
              {`${confirmRefund.payer_name || confirmRefund.payer_email} gets ${fmt(
                confirmRefund.amount_cents,
                confirmRefund.currency,
              )} back in full${
                confirmRefund.method === 'stripe'
                  ? ' via Stripe (the platform fee is returned too)'
                  : ' — recorded here; the money moves outside Stripe'
              }. There is no partial refund.`}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmRefund(null)}
                className="rounded-md px-3 py-1.5 text-sm text-ink-subtle hover:text-ink hover:bg-surface-sunken disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const row = confirmRefund;
                  setConfirmRefund(null);
                  if (row) void run(actions.refundPurchase, row, 'Reimbursed in full.');
                }}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? 'Working…' : 'Reimburse'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
