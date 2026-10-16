'use client';

// Add to your membership, or change it (my.thread → Purchases, P3). On the
// ONE subscription the member already has, so there is one renewal date.
// Every choice is previewed first, and the preview is Stripe's own figure on
// that subscription — what the card will be charged now, or the credit a
// downgrade leaves on the next invoice (lib/membership-change.ts).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@thefibre/shared/ui/dialog';
import { Button } from '@thefibre/shared/ui/button';
import { NOTICE } from '@thefibre/shared/ui/recipes';
import { browserSupabase } from '@/lib/supabase/client';

type Options = {
  interval: 'year' | 'month';
  currency: string;
  current_price_cents: number | null;
  downgrade: 'credit' | 'refund';
  addons: { id: string; name: string; price_cents: number; currency: string; recurring: boolean }[];
  tiers: { id: string; name: string; price_cents: number }[];
};
type Quote = { due_now_cents: number; tax_now_cents: number; then_cents: number; then_tax_cents: number; credit_cents: number; currency: string };
type Choice = { kind: 'addon' | 'tier'; id: string; name: string };

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(cents / 100);

async function api<T>(path: string, body?: unknown): Promise<T> {
  const {
    data: { session },
  } = await browserSupabase().auth.getSession();
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
  const res = await fetch(`${base}/api/v1/membership/portal${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Something went wrong (${res.status}).`);
  return json;
}

export function ChangeMembership({
  memberId,
  community,
  tier,
  renewsOn,
  open,
  onClose,
}: {
  memberId: string;
  community: string;
  tier: string;
  /** The renewal date, already formatted. */
  renewsOn: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<Options | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // One request id per choice: a double click or a retry of the SAME choice
  // replays at Stripe instead of charging twice (the server also refuses a
  // second add with 409).
  const [requestId, setRequestId] = useState('');

  useEffect(() => {
    if (!open) return;
    setOptions(null);
    setChoice(null);
    setQuote(null);
    setError(null);
    setDone(null);
    api<Options>(`/me/options/${memberId}`).then(setOptions, (e: Error) => setError(e.message));
  }, [open, memberId]);

  async function pick(c: Choice) {
    if (busy) return;
    setChoice(c);
    setRequestId(`chg_${crypto.randomUUID().replace(/-/g, '')}`);
    setQuote(null);
    setError(null);
    try {
      setQuote(
        await api<Quote>(
          c.kind === 'addon' ? `/me/addons/${memberId}/preview` : `/me/change/${memberId}/preview`,
          c.kind === 'addon' ? { product_id: c.id } : { tier_id: c.id },
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function confirm() {
    if (!choice || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(choice.kind === 'addon' ? `/me/addons/${memberId}` : `/me/change/${memberId}`, choice.kind === 'addon' ? { product_id: choice.id, request_id: requestId } : { tier_id: choice.id, request_id: requestId });
      setDone(choice.kind === 'addon' ? `${choice.name} is added to your membership.` : `You are now a ${choice.name} member.`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const per = options?.interval === 'month' ? 'month' : 'year';
  // A RADIO per choice (the shared pattern, as in ui/billing-choice): before
  // this a choice was a plain card, and nothing said it could be selected or
  // that selecting it is what enables Confirm (2026-10-16).
  const row = (c: Choice, price: string, note: string) => {
    const on = choice?.id === c.id && choice.kind === c.kind;
    return (
      <li key={`${c.kind}:${c.id}`}>
        <label
          className={`flex w-full cursor-pointer items-start gap-3 px-3 py-2.5 text-left text-sm hover:bg-surface-sunken ${
            on ? 'bg-surface-sunken ring-1 ring-inset ring-line-strong' : ''
          } ${busy ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input type="radio" name="change-choice" checked={on} onChange={() => pick(c)} disabled={busy} className="mt-1 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="text-ink">{c.name}</span>
            <span className="block text-xs text-ink-muted">{note}</span>
          </span>
          <span className="shrink-0 tabular-nums text-ink-subtle">{price}</span>
        </label>
      </li>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add or change"
      description={`${tier} · ${community}`}
      footer={
        done ? (
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={confirm} disabled={!quote || busy}>
              {busy ? 'One moment…' : quote && quote.due_now_cents > 0 ? `Pay ${money(quote.due_now_cents, quote.currency)}` : 'Confirm'}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p className={NOTICE.success}>{done} Your receipt is on its way and appears under Purchases.</p>
      ) : !options ? (
        error ? <p className={NOTICE.error}>{error}</p> : <p className="text-sm text-ink-subtle">Loading…</p>
      ) : (
        <div className="space-y-5">
          {options.addons.length > 0 && (
            <section>
              <h3 className="text-xs font-medium text-ink-muted">Add to your membership</h3>
              <ul className="mt-1.5 divide-y divide-line overflow-hidden rounded-xl border border-line">
                {options.addons.map((a) =>
                  row(
                    { kind: 'addon', id: a.id, name: a.name },
                    money(a.price_cents, a.currency),
                    a.recurring ? `Renews with your membership, per ${per}` : 'One-off',
                  ),
                )}
              </ul>
            </section>
          )}
          {options.tiers.length > 0 && (
            <section>
              <h3 className="text-xs font-medium text-ink-muted">Change your membership</h3>
              <ul className="mt-1.5 divide-y divide-line overflow-hidden rounded-xl border border-line">
                {options.tiers.map((t) =>
                  row(
                    { kind: 'tier', id: t.id, name: t.name },
                    `${money(t.price_cents, options.currency)} / ${per}`,
                    options.current_price_cents !== null && t.price_cents < options.current_price_cents ? 'Less than now' : 'More than now',
                  ),
                )}
              </ul>
            </section>
          )}
          {options.addons.length === 0 && options.tiers.length === 0 && (
            <p className="text-sm text-ink-subtle">There is nothing to add or change to here right now.</p>
          )}
          <p className="text-xs text-ink-muted">Prices are excl. VAT.</p>
          {choice && quote && (
            <div className={NOTICE.info}>
              {quote.due_now_cents > 0 ? (
                <p>
                  You pay <span className="font-medium text-ink">{money(quote.due_now_cents, quote.currency)}</span> now
                  {quote.tax_now_cents > 0 ? ` (incl. ${money(quote.tax_now_cents, quote.currency)} VAT)` : ''}, for the rest
                  of this period, with the card on your membership.
                </p>
              ) : quote.credit_cents > 0 ? (
                <p>
                  Nothing is charged now. The {money(quote.credit_cents, quote.currency)} difference for the rest of this period is{' '}
                  {options.downgrade === 'refund' ? 'refunded to your card' : 'credited against your next invoice'}.
                </p>
              ) : (
                <p>Nothing is charged now.</p>
              )}
              {quote.then_cents > 0 && (
                <p className="mt-1">
                  Then {money(quote.then_cents, quote.currency)}
                  {quote.then_tax_cents > 0 ? ' incl. VAT' : ''} on {renewsOn}, and every {per} after.
                </p>
              )}
            </div>
          )}
          {choice && !quote && !error && <p className="text-sm text-ink-subtle">Working out the price…</p>}
          {error && <p className={NOTICE.error}>{error}</p>}
        </div>
      )}
    </Dialog>
  );
}
