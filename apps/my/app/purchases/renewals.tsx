'use client';

// Your memberships, and what renews (my.thread → Purchases, P1). Stop or
// resume the renewal HERE, in The Fibre — Sjoerd, 2026-10-15: "Manage payment
// should not go to Stripe." The figure is Stripe's own preview of the next
// invoice, so it is what will actually be charged: net, VAT, total.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@thefibre/shared/ui/dialog';
import { Button } from '@thefibre/shared/ui/button';
import { browserSupabase } from '@/lib/supabase/client';
import type { MyProductSubscription, MyRenewal } from '@/lib/portal-api';
import { ChangeMembership } from './change-membership';
import { CardLine } from './card-change';

const day = (iso: string, lastDay = false) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(
    new Date(Date.parse(iso) - (lastDay ? 1000 : 0)),
  );
const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(cents / 100);

export function Renewals({ items }: { items: MyRenewal[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-ink">Your memberships</h2>
      <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {items.map((r) => (
          <RenewalRow key={r.member_id} r={r} />
        ))}
      </ul>
    </section>
  );
}

function RenewalRow({ r }: { r: MyRenewal }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<'stop' | 'resume' | null>(null);
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(stop: boolean) {
    setBusy(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await browserSupabase().auth.getSession();
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
      const res = await fetch(`${base}/api/v1/membership/portal/me/renewals/${r.member_id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stop }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `Could not change the renewal (${res.status}).`);
      }
      setConfirm(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const n = r.next_invoice;
  return (
    <li className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm text-ink">{r.community}</div>
          <div className="text-xs text-ink-muted">{r.tier}</div>
        </div>
        {!r.managed_by_community && !r.unavailable && r.renews_at && (
          <div className="flex shrink-0 gap-1">
            {/* Adding or changing needs a renewing membership: a stopped one
                is resumed first (the API says so too). */}
            {!r.stops_at_period_end && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setChanging(true)}>
                Add or change
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirm(r.stops_at_period_end ? 'resume' : 'stop')}
            >
              {r.stops_at_period_end ? 'Resume renewal' : 'Stop renewal'}
            </Button>
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-subtle">
        {r.managed_by_community
          ? 'This membership is managed directly by the community.'
          : r.unavailable
            ? 'The renewal could not be read just now.'
            : r.stops_at_period_end && r.renews_at
              ? `Does not renew. Active until ${day(r.renews_at, true)}.`
              : r.renews_at && n
                ? `Renews on ${day(r.renews_at)} at ${money(n.total, n.currency)}${n.tax > 0 ? ` incl. VAT (${money(n.subtotal, n.currency)} + VAT ${money(n.tax, n.currency)})` : ''}.`
                : r.renews_at
                  ? `Renews on ${day(r.renews_at)}.`
                  : ''}
      </p>
      {/* The card renewals are charged to — changed here, not on Stripe (P4). */}
      {!r.managed_by_community && !r.unavailable && r.renews_at && !r.stops_at_period_end && <CardLine memberId={r.member_id} />}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      {r.renews_at && (
        <ChangeMembership
          memberId={r.member_id}
          community={r.community}
          tier={r.tier}
          renewsOn={day(r.renews_at)}
          open={changing}
          onClose={() => setChanging(false)}
        />
      )}
      <ConfirmDialog
        open={confirm !== null}
        onCancel={() => setConfirm(null)}
        onConfirm={() => change(confirm === 'stop')}
        pending={busy}
        title={confirm === 'stop' ? 'Stop the renewal?' : 'Resume the renewal?'}
        message={
          confirm === 'stop'
            ? `Your ${r.tier} membership of ${r.community} stays active until ${r.renews_at ? day(r.renews_at, true) : 'the end of this period'}, and nothing more is charged. You can resume it until then.`
            : `Your ${r.tier} membership of ${r.community} will renew on ${r.renews_at ? day(r.renews_at) : 'its renewal date'} again.`
        }
        confirmLabel={confirm === 'stop' ? 'Stop renewal' : 'Resume renewal'}
        destructive={confirm === 'stop'}
      />
    </li>
  );
}

/** Products subscribed to on their own (2026-10-16): stop or resume each, the
 *  same way as a membership — here, never on Stripe. The card change follows
 *  when P4's publishable key exists. */
export function ProductRenewals({ items }: { items: MyProductSubscription[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-ink">Your subscriptions</h2>
      <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {items.map((r) => (
          <ProductRenewalRow key={r.subscription_id} r={r} />
        ))}
      </ul>
    </section>
  );
}

function ProductRenewalRow({ r }: { r: MyProductSubscription }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<'stop' | 'resume' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const what = r.products.join(', ') || 'this subscription';

  async function change(stop: boolean) {
    setBusy(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await browserSupabase().auth.getSession();
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
      const res = await fetch(`${base}/api/v1/membership/portal/me/product-renewals/${encodeURIComponent(r.subscription_id)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stop }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `Could not change the renewal (${res.status}).`);
      }
      setConfirm(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const n = r.next_invoice;
  return (
    <li className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm text-ink">{what}</div>
          <div className="text-xs text-ink-muted">{r.community}</div>
        </div>
        {!r.unavailable && r.renews_at && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm(r.stops_at_period_end ? 'resume' : 'stop')}>
            {r.stops_at_period_end ? 'Resume renewal' : 'Stop renewal'}
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-subtle">
        {r.unavailable
          ? 'The renewal could not be read just now.'
          : r.stops_at_period_end && r.renews_at
            ? `Does not renew. Yours until ${day(r.renews_at, true)}.`
            : r.renews_at && n
              ? `Renews on ${day(r.renews_at)} at ${money(n.total, n.currency)}${n.tax > 0 ? ` incl. VAT (${money(n.subtotal, n.currency)} + VAT ${money(n.tax, n.currency)})` : ''}.`
              : r.renews_at
                ? `Renews on ${day(r.renews_at)}.`
                : ''}
      </p>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      <ConfirmDialog
        open={confirm !== null}
        onCancel={() => setConfirm(null)}
        onConfirm={() => change(confirm === 'stop')}
        pending={busy}
        title={confirm === 'stop' ? 'Stop the renewal?' : 'Resume the renewal?'}
        message={
          confirm === 'stop'
            ? `${what} from ${r.community} stays yours until ${r.renews_at ? day(r.renews_at, true) : 'the end of this period'}, and nothing more is charged. You can resume it until then.`
            : `${what} from ${r.community} will renew on ${r.renews_at ? day(r.renews_at) : 'its renewal date'} again.`
        }
        confirmLabel={confirm === 'stop' ? 'Stop renewal' : 'Resume renewal'}
        destructive={confirm === 'stop'}
      />
    </li>
  );
}
