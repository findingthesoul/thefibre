'use client';

// Pricing tab in thread settings — thethread-v3 model (Sjoerd 2026-07-02):
// a LIST of ticket prices and a LIST of discount codes, each row opening a
// popup editor. The panel is self-sufficient: it loads both lists via
// server actions on mount (the caller stays a dumb layout).
// Checkout + coupon redemption go live with the payments phase.

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Ticket, TicketPercent, Gift, CreditCard } from 'lucide-react';
import {
  listTickets,
  listCoupons,
  createCoupon,
  updateThread,
  getPayoutInfo,
  type TicketRow,
  type CouponRow,
} from '../actions';
import type { ThreadRow } from '@/lib/thread-types';
import { TicketDialog } from './ticket-dialog';
import { CouponDialog, type ScopedCouponRow } from './coupon-dialog';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/page';

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' };

function fmtPrice(cents: number, currency: string): string {
  if (!cents) return 'Free';
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function Chip({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${
        muted
          ? 'border-line text-ink-muted bg-surface'
          : 'border-line bg-surface-sunken text-ink-subtle'
      }`}
    >
      {children}
    </span>
  );
}

type DialogState =
  | { kind: 'ticket'; ticket: TicketRow | null }
  | { kind: 'coupon'; coupon: CouponRow | null }
  | null;

export function PricingPanel({
  thread,
  onSaved: onPanelSaved,
}: {
  thread: ThreadRow;
  /** Called after the footer Save completes — the dialog closes on it. */
  onSaved?: () => void;
}) {
  const router = useRouter();
  // The shared dialog footer submits this panel by form id; in Paid mode
  // that runs the payout save (registered below), in Free mode it just
  // confirms — tickets and codes save through their own popups.
  const payoutSubmitRef = useRef<(() => void) | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  // Free/Paid stays a toggle (Sjoerd): Paid reveals the ticket + code lists.
  const [mode, setMode] = useState<'free' | 'paid' | null>(null);
  // Seed one default discount code the first time the user flips to Paid
  // with an empty coupon list — once per mount, never over existing codes.
  const seededDefaultCode = useRef(false);

  function choosePaid() {
    setMode('paid');
    if (seededDefaultCode.current || loading || coupons.length > 0) return;
    seededDefaultCode.current = true;
    void (async () => {
      await createCoupon(thread.id, {
        code: 'EARLYBIRD',
        name: 'Early bird',
        type: 'percentage',
        discount_percentage: 10,
        is_active: true,
      });
      void reload();
    })();
  }

  const reload = useCallback(async () => {
    const [t, c] = await Promise.all([listTickets(thread.id), listCoupons(thread.id)]);
    if (t.ok) setTickets(t.items);
    if (c.ok) setCoupons(c.items);
    setLoadError(!t.ok ? t.error : !c.ok ? c.error : null);
    setLoading(false);
    setMode((m) => m ?? ((t.ok && t.items.length > 0) ? 'paid' : 'free'));
  }, [thread.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function onSaved() {
    setDialog(null);
    void reload();
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {/* Hidden sibling form — the shared dialog footer submits it by id.
          NOT a wrapper: the ticket/coupon popups render their own forms in
          this subtree and nesting forms breaks submit semantics. */}
      <form
        id="thread-pricing-form"
        className="hidden"
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === 'paid' && payoutSubmitRef.current) payoutSubmitRef.current();
          else onPanelSaved?.();
        }}
      />
      {/* ── Free / Paid toggle ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setMode('free')}
          className={`text-left rounded-lg border p-3.5 transition-colors ${
            mode === 'free'
              ? 'border-ink bg-surface-sunken'
              : 'border-line bg-surface hover:bg-surface-sunken'
          }`}
        >
          <div className="flex items-center gap-2">
            <Gift size={15} strokeWidth={1.75} className="text-ink-subtle" />
            <span className="text-sm font-medium">Free</span>
          </div>
          <p className="mt-1 text-xs text-ink-subtle leading-relaxed">
            Anyone can enrol without paying.
          </p>
        </button>
        <button
          type="button"
          onClick={choosePaid}
          className={`text-left rounded-lg border p-3.5 transition-colors ${
            mode === 'paid'
              ? 'border-ink bg-surface-sunken'
              : 'border-line bg-surface hover:bg-surface-sunken'
          }`}
        >
          <div className="flex items-center gap-2">
            <CreditCard size={15} strokeWidth={1.75} className="text-ink-subtle" />
            <span className="text-sm font-medium">Paid</span>
          </div>
          <p className="mt-1 text-xs text-ink-subtle leading-relaxed">
            Tickets and discount codes; checkout lands with the payments phase.
          </p>
        </button>
      </div>

      {mode === 'paid' && (
      <>
      {/* ── Tickets ───────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between">
          <SectionLabel>Tickets</SectionLabel>
          <Button
            variant="secondary"
            size="sm"
            leading={<Plus size={14} />}
            onClick={() => setDialog({ kind: 'ticket', ticket: null })}
          >
            Add ticket
          </Button>
        </div>
        {loading ? (
          <LoadingRows />
        ) : tickets.length === 0 ? (
          <p className="mt-3 text-sm text-ink-subtle">
            No tickets yet — free enrolment. Add one to charge.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface-raised">
            {tickets.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setDialog({ kind: 'ticket', ticket: t })}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-sunken transition-colors"
                >
                  <Ticket size={16} strokeWidth={1.75} className="text-ink-muted shrink-0" />
                  <span className={`text-sm font-medium ${t.is_active ? '' : 'text-ink-muted'}`}>
                    {t.name}
                  </span>
                  <span className="text-sm text-ink-subtle tabular-nums">
                    {fmtPrice(t.price_cents, t.price_currency)}
                  </span>
                  <span className="ml-auto flex items-center gap-1.5">
                    {t.quantity_limit != null && <Chip>{t.quantity_limit} max</Chip>}
                    {t.available_until && <Chip>until {fmtDate(t.available_until)}</Chip>}
                    {!t.is_active && <Chip muted>Inactive</Chip>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Discount codes ────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between">
          <SectionLabel>Discount codes</SectionLabel>
          <Button
            variant="secondary"
            size="sm"
            leading={<Plus size={14} />}
            onClick={() => setDialog({ kind: 'coupon', coupon: null })}
          >
            Add code
          </Button>
        </div>
        {loading ? (
          <LoadingRows />
        ) : coupons.length === 0 ? (
          <p className="mt-3 text-sm text-ink-subtle">
            No codes yet. Add one for early birds, scholarships or partners.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface-raised">
            {coupons.map((c) => {
              const expired = c.expires_at ? new Date(c.expires_at) < new Date() : false;
              const dim = !c.is_active || expired;
              const scopedTicket = tickets.find(
                (t) => t.id === (c as ScopedCouponRow).ticket_id,
              );
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setDialog({ kind: 'coupon', coupon: c })}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-sunken transition-colors"
                  >
                    <TicketPercent
                      size={16}
                      strokeWidth={1.75}
                      className="text-ink-muted shrink-0"
                    />
                    <span className={`text-sm font-mono ${dim ? 'text-ink-muted' : ''}`}>
                      {c.code}
                    </span>
                    <span className="text-sm text-ink-subtle">{couponSummary(c)}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {scopedTicket && <Chip muted>{scopedTicket.name} only</Chip>}
                      {c.usage_limit != null && (
                        <Chip>
                          {c.used_count}/{c.usage_limit}
                        </Chip>
                      )}
                      {c.is_early_bird && (
                        <Chip>
                          Early bird
                          {c.early_bird_deadline ? ` · ${fmtDate(c.early_bird_deadline)}` : ''}
                        </Chip>
                      )}
                      {expired && <Chip muted>Expired</Chip>}
                      {!c.is_active && <Chip muted>Inactive</Chip>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {loadError && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {loadError}
        </p>
      )}

      </>
      )}

      {/* ── Payment options (inheritance: account → thread → ticket) ── */}
      {mode === 'paid' && (
        <PaymentMethodsSection thread={thread} />
      )}

      {/* ── Payout ────────────────────────────────────────────────── */}
      {mode === 'paid' && (
        <PayoutSection
          thread={thread}
          onSaved={onPanelSaved}
          registerSubmit={(fn) => {
            payoutSubmitRef.current = fn;
          }}
        />
      )}

      <p className="text-xs text-ink-muted">
        Checkout + coupon redemption go live with the payments phase.
      </p>

      {dialog?.kind === 'ticket' && (
        <TicketDialog
          threadId={thread.id}
          ticket={dialog.ticket}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
        />
      )}
      {dialog?.kind === 'coupon' && (
        <CouponDialog
          threadId={thread.id}
          coupon={dialog.coupon}
          tickets={tickets}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

function couponSummary(c: CouponRow): string {
  if (c.type === 'percentage') return `${c.discount_percentage ?? 0}%`;
  if (c.type === 'amount') return `€${((c.discount_amount_cents ?? 0) / 100).toFixed(2)} off`;
  return 'Free';
}

function LoadingRows() {
  return (
    <div className="mt-3 space-y-2" aria-busy="true">
      {[0, 1].map((i) => (
        <div key={i} className="h-11 rounded-lg border border-line bg-surface-sunken/50 animate-pulse" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payout destination — kept from the previous panel, its own small save.
// ---------------------------------------------------------------------------

function PayoutSection({
  thread,
  onSaved,
  registerSubmit,
}: {
  thread: ThreadRow;
  onSaved?: () => void;
  /** Hands the save function up so the panel's form submit can call it. */
  registerSubmit?: (fn: () => void) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [connected, setConnected] = useState<{ workspace: boolean; personal: boolean } | null>(
    null,
  );
  // Default per the rule: team/workspace-shared → workspace; personal thread
  // → personal when connected, else workspace. Always one of the two.
  const [dest, setDest] = useState<'workspace' | 'personal'>(
    thread.payment_destination ?? (thread.team_id ? 'workspace' : 'personal'),
  );

  useEffect(() => {
    void (async () => {
      const info = await getPayoutInfo();
      if (info.ok) {
        setConnected({ workspace: info.workspace_connected, personal: info.personal_connected });
        // If the current default isn't connected but the other is, flip.
        if (!thread.payment_destination) {
          if (thread.team_id) setDest('workspace');
          else setDest(info.personal_connected || !info.workspace_connected ? 'personal' : 'workspace');
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function save() {
    setError(null);
    setSaved(false);
    // Nothing connected → nothing to persist; still confirm so the dialog closes.
    if (!connected || (!connected.workspace && !connected.personal)) {
      onSaved?.();
      return;
    }
    startTransition(async () => {
      const r = await updateThread(thread.id, { payment_destination: dest });
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
      onSaved?.();
    });
  }

  // Let the panel's form submit trigger this section's save.
  useEffect(() => {
    registerSubmit?.(save);
  });

  const opt = (value: 'workspace' | 'personal', label: string, isConnected: boolean) => (
    <button
      type="button"
      disabled={!isConnected}
      onClick={() => setDest(value)}
      title={isConnected ? undefined : 'No Stripe account connected yet'}
      className={`flex-1 text-left rounded-lg border p-3.5 transition-colors ${
        !isConnected
          ? 'border-line bg-surface opacity-40 cursor-not-allowed'
          : dest === value
            ? 'border-ink bg-surface-sunken'
            : 'border-line bg-surface hover:bg-surface-sunken'
      }`}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-0.5 text-xs text-ink-subtle">
        {isConnected ? 'Stripe connected' : 'Not connected — Settings → Payments'}
      </div>
    </button>
  );

  return (
    <section>
      <SectionLabel>Payout</SectionLabel>
      <div className="mt-3 flex gap-3">
        {opt('workspace', 'Workspace account', connected?.workspace ?? false)}
        {opt('personal', 'My personal account', connected?.personal ?? false)}
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3">
        {(pending || saved) && (
          <span className="text-sm text-ink-subtle">{pending ? 'Saving…' : 'Saved.'}</span>
        )}
        {connected && !connected.workspace && !connected.personal && (
          <span className="text-xs text-ink-muted">
            Connect a Stripe account first (payments phase).
          </span>
        )}
      </div>
    </section>
  );
}

// Thread-level payment options. Null = inherit the account default set in
// Settings → Payments; custom overrides here; tickets can override again.
function PaymentMethodsSection({ thread }: { thread: ThreadRow }) {
  const router = useRouter();
  const [custom, setCustom] = useState<boolean>(!!thread.payment_methods?.length);
  const [stripeOn, setStripeOn] = useState(thread.payment_methods?.includes('stripe') ?? true);
  const [invoiceOn, setInvoiceOn] = useState(thread.payment_methods?.includes('invoice') ?? false);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  function persist(next: ('stripe' | 'invoice')[] | null) {
    setNote(null);
    startTransition(async () => {
      const r = await updateThread(thread.id, { payment_methods: next });
      setNote(r.ok ? 'Saved.' : r.error);
      router.refresh();
    });
  }

  return (
    <section>
      <SectionLabel>Payment options</SectionLabel>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-ink-subtle cursor-pointer">
          <input
            type="radio"
            name="pm-mode"
            checked={!custom}
            onChange={() => {
              setCustom(false);
              persist(null);
            }}
          />
          Inherit from my account settings
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-ink-subtle cursor-pointer">
          <input
            type="radio"
            name="pm-mode"
            checked={custom}
            onChange={() => {
              setCustom(true);
              persist([
                ...(stripeOn ? (['stripe'] as const) : []),
                ...(invoiceOn ? (['invoice'] as const) : []),
              ]);
            }}
          />
          Custom for this thread
        </label>
        {custom && (
          <span className="inline-flex items-center gap-4">
            <label className="inline-flex items-center gap-1.5 text-sm text-ink-subtle cursor-pointer">
              <input
                type="checkbox"
                checked={stripeOn}
                disabled={pending}
                onChange={(e) => {
                  setStripeOn(e.target.checked);
                  const next = [
                    ...(e.target.checked ? (['stripe'] as const) : []),
                    ...(invoiceOn ? (['invoice'] as const) : []),
                  ];
                  if (next.length) persist(next);
                }}
              />
              Pay online
            </label>
            <label className="inline-flex items-center gap-1.5 text-sm text-ink-subtle cursor-pointer">
              <input
                type="checkbox"
                checked={invoiceOn}
                disabled={pending}
                onChange={(e) => {
                  setInvoiceOn(e.target.checked);
                  const next = [
                    ...(stripeOn ? (['stripe'] as const) : []),
                    ...(e.target.checked ? (['invoice'] as const) : []),
                  ];
                  if (next.length) persist(next);
                }}
              />
              Pay per invoice
            </label>
          </span>
        )}
        {note && <span className="text-xs text-ink-muted">{note}</span>}
      </div>
      <p className="mt-1.5 text-xs text-ink-muted">
        Tickets can override these again in their own popup.
      </p>
    </section>
  );
}
