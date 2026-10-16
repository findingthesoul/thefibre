'use client';

// ADD TO YOUR MEMBERSHIP, on the public page (Sjoerd, 2026-10-16, on
// production soul.com: "Once logged in, you can select them"). A signed-in
// MEMBER adds a members-only product to the membership they already have —
// through the same P3 routes my.thread uses (options → preview → add): the
// charge is Stripe's prorated figure on their own subscription, never a new
// subscription and never a second rule. Anonymous visitors see nothing here;
// the card keeps saying "With a membership".

import { useEffect, useState } from 'react';
import { Dialog } from '@thefibre/shared/ui/dialog';
import { Button } from '@thefibre/shared/ui/button';
import { NOTICE } from '@thefibre/shared/ui/recipes';
import { browserSupabase } from '@/lib/supabase/client';

const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

type Addon = { id: string; name: string; price_cents: number; currency: string; recurring: boolean };
type MemberAddons = { memberId: string; interval: 'year' | 'month'; addons: Addon[] };
type Quote = { due_now_cents: number; tax_now_cents: number; then_cents: number; then_tax_cents: number; currency: string };

async function token(): Promise<string | null> {
  try {
    return (await browserSupabase().auth.getSession()).data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function portal<T>(path: string, body?: unknown): Promise<T> {
  const t = await token();
  const res = await fetch(`${base}/api/v1/membership/portal${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${t ?? ''}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw Object.assign(new Error(json.error ?? `Something went wrong (${res.status}).`), { status: res.status });
  return json;
}

// One lookup per page, shared by every card.
const cache = new Map<string, Promise<MemberAddons | null>>();
function memberAddonsFor(slug: string): Promise<MemberAddons | null> {
  if (!cache.has(slug)) {
    cache.set(
      slug,
      (async () => {
        if (!(await token())) return null;
        try {
          const m = await portal<{ member_id: string; can_add: boolean }>(`/me/member-in/${encodeURIComponent(slug)}`);
          if (!m.can_add) return null;
          const o = await portal<{ interval: 'year' | 'month'; addons: Addon[] }>(`/me/options/${m.member_id}`);
          return { memberId: m.member_id, interval: o.interval, addons: o.addons };
        } catch {
          return null; // not signed in, not a member here, or managed by the community
        }
      })(),
    );
  }
  return cache.get(slug)!;
}

/** The member's add-on for this product, if they may add it. */
export function useMemberAddon(slug: string, productId: string): { memberId: string; addon: Addon; interval: 'year' | 'month' } | null {
  const [state, setState] = useState<{ memberId: string; addon: Addon; interval: 'year' | 'month' } | null>(null);
  useEffect(() => {
    let live = true;
    void memberAddonsFor(slug).then((m) => {
      const addon = m?.addons.find((a) => a.id === productId);
      if (live && m && addon) setState({ memberId: m.memberId, addon, interval: m.interval });
    });
    return () => {
      live = false;
    };
  }, [slug, productId]);
  return state;
}

const money = (cents: number, currency: string) => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(cents / 100);

export function AddToMembership({ memberId, addon, interval }: { memberId: string; addon: Addon; interval: 'year' | 'month' }) {
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [requestId] = useState(() => `maddon_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`);

  async function start() {
    setOpen(true);
    setError(null);
    setQuote(null);
    try {
      setQuote(await portal<Quote>(`/me/addons/${memberId}/preview`, { product_id: addon.id }));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await portal(`/me/addons/${memberId}`, { product_id: addon.id, request_id: requestId });
      setDone(true);
      cache.clear();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const per = interval === 'month' ? 'month' : 'year';
  return (
    <>
      <Button type="button" className="w-full" onClick={start}>
        Add to your membership
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Add ${addon.name}`}
        description="To the membership you already have — on the same card and renewal date."
        footer={
          done ? (
            <Button type="button" onClick={() => setOpen(false)}>
              Close
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
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
          <p className={NOTICE.success}>{addon.name} is added to your membership. Your receipt is on its way and appears under Purchases in my.thread.</p>
        ) : quote ? (
          <p className="text-sm text-ink">
            {quote.due_now_cents > 0 ? (
              <>
                <span className="font-medium">{money(quote.due_now_cents, quote.currency)}</span> now
                {quote.tax_now_cents > 0 ? ` (incl. ${money(quote.tax_now_cents, quote.currency)} VAT)` : ''}
                {addon.recurring ? ', for the rest of your current period' : ''}.
              </>
            ) : (
              <>Nothing to pay now.</>
            )}
            {addon.recurring && quote.then_cents > 0 && (
              <>
                {' '}Then {money(quote.then_cents, quote.currency)} per {per}
                {quote.then_tax_cents > 0 ? ` (incl. ${money(quote.then_tax_cents, quote.currency)} VAT)` : ''} with your membership.
              </>
            )}
          </p>
        ) : !error ? (
          <p className="text-sm text-ink-muted">Working out the price…</p>
        ) : null}
        {error && <p className={`mt-3 ${NOTICE.error}`}>{error}</p>}
      </Dialog>
    </>
  );
}
