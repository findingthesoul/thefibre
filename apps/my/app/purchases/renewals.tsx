'use client';

// Your memberships, and what renews (my.thread → Purchases, P1). Stop or
// resume the renewal HERE, in The Fibre — Sjoerd, 2026-10-15: "Manage payment
// should not go to Stripe." The figure is Stripe's own preview of the next
// invoice, so it is what will actually be charged: net, VAT, total.
//
// ONE QUIET PLACE TO STOP (Sjoerd, 2026-10-17: "make the stop renewal not so
// easily visible at every possible spot. It needs to be clear, but people do
// not need to be nudged to click on it whenever they can."). This page is
// the only place that stops a renewal. The row states the fact and ends in
// a small text link, "Manage renewal", which opens a window with the fact
// and the Stop button; Stop then asks once more (the confirm). Two
// deliberate steps, never a button in a list. Once stopped, "Resume
// renewal" is a plain link on the row: undoing should be easy. "Add or
// change" stays a button, because that is the action we want found.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog, Dialog } from '@thefibre/shared/ui/dialog';
import { Button } from '@thefibre/shared/ui/button';
import { browserSupabase } from '@/lib/supabase/client';
import type { MyProductSubscription, MyRenewal } from '@/lib/portal-api';
import { ChangeMembership } from './change-membership';
import { CardLine } from './card-change';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import type { Locale } from '@thefibre/shared/i18n';
import { t } from '@/lib/i18n';
import { friendlyError } from '@/lib/errors';
import { PortalCallError } from '@/lib/membership-portal-client';
import { intlTag, money as fmtMoney } from '@/lib/format';

// In the reader's language; English is en-GB, as these always were.
const dayIn = (locale: Locale) => (iso: string, lastDay = false) =>
  new Intl.DateTimeFormat(intlTag(locale), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(
    new Date(Date.parse(iso) - (lastDay ? 1000 : 0)),
  );

/** "Renews on …" — the same sentence for a membership and a product. */
function renewsLine(
  locale: Locale,
  day: (iso: string, lastDay?: boolean) => string,
  renewsAt: string | null | undefined,
  n: { total: number; subtotal: number; tax: number; currency: string } | null | undefined,
): string {
  if (!renewsAt) return '';
  if (!n) return t(locale, 'renews_on', { date: day(renewsAt) });
  const money = (c: number) => fmtMoney(c, n.currency, locale);
  return n.tax > 0
    ? t(locale, 'renews_on_at_vat', { date: day(renewsAt), total: money(n.total), subtotal: money(n.subtotal), tax: money(n.tax) })
    : t(locale, 'renews_on_at', { date: day(renewsAt), total: money(n.total) });
}

/** The quiet link at the end of a renewal line. */
const QUIET = 'ml-1 text-ink-subtle underline underline-offset-2 hover:text-ink';

/** "Manage renewal": the renewal as a fact, and the one Stop button. */
function ManageRenewal({ open, onClose, onStop, title, fact }: { open: boolean; onClose: () => void; onStop: () => void; title: string; fact: string }) {
  const locale = useLocale();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(locale, 'manage_renewal')}
      size="sm"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button type="button" variant="danger" onClick={onStop}>
            {t(locale, 'stop_renewal')}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t(locale, 'close')}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-subtle">{fact}</p>
    </Dialog>
  );
}

export function Renewals({ items }: { items: MyRenewal[] }) {
  const locale = useLocale();
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-ink">{t(locale, 'your_memberships')}</h2>
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
  const locale = useLocale();
  const day = dayIn(locale);
  const [confirm, setConfirm] = useState<'stop' | 'resume' | null>(null);
  const [managing, setManaging] = useState(false);
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
        throw new PortalCallError(b.error ?? '', res.status, (b as { code?: string }).code);
      }
      setConfirm(null);
      router.refresh();
    } catch (e) {
      setError(friendlyError(e, locale));
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
                {t(locale, 'add_or_change')}
              </Button>
            )}
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-subtle">
        {r.managed_by_community
          ? t(locale, 'renew_managed')
          : r.unavailable
            ? t(locale, 'renew_unavailable')
            : r.stops_at_period_end && r.renews_at
              ? t(locale, 'renew_stops', { date: day(r.renews_at, true) })
              : renewsLine(locale, day, r.renews_at, n)}
        {!r.managed_by_community && !r.unavailable && r.renews_at && (
          <button type="button" className={QUIET} onClick={() => (r.stops_at_period_end ? setConfirm('resume') : setManaging(true))}>
            {r.stops_at_period_end ? t(locale, 'resume_renewal') : t(locale, 'manage_renewal')}
          </button>
        )}
      </p>
      {/* The card renewals are charged to — changed here, not on Stripe (P4). */}
      {!r.managed_by_community && !r.unavailable && r.renews_at && !r.stops_at_period_end && <CardLine memberId={r.member_id} nudge />}
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
      <ManageRenewal
        open={managing}
        onClose={() => setManaging(false)}
        onStop={() => {
          setManaging(false);
          setConfirm('stop');
        }}
        title={`${r.community} · ${r.tier}`}
        fact={renewsLine(locale, day, r.renews_at, n)}
      />
      <ConfirmDialog
        open={confirm !== null}
        onCancel={() => setConfirm(null)}
        onConfirm={() => change(confirm === 'stop')}
        pending={busy}
        title={confirm === 'stop' ? t(locale, 'stop_q') : t(locale, 'resume_q')}
        message={
          confirm === 'stop'
            ? t(locale, 'stop_msg', {
                tier: r.tier,
                community: r.community,
                date: r.renews_at ? day(r.renews_at, true) : t(locale, 'end_of_period'),
              })
            : t(locale, 'resume_msg', {
                tier: r.tier,
                community: r.community,
                date: r.renews_at ? day(r.renews_at) : t(locale, 'its_renewal_date'),
              })
        }
        confirmLabel={confirm === 'stop' ? t(locale, 'stop_renewal') : t(locale, 'resume_renewal')}
        destructive={confirm === 'stop'}
      />
    </li>
  );
}

/** Products subscribed to on their own (2026-10-16): stop or resume each, the
 *  same way as a membership — here, never on Stripe. The card change follows
 *  when P4's publishable key exists. */
export function ProductRenewals({ items }: { items: MyProductSubscription[] }) {
  const locale = useLocale();
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-ink">{t(locale, 'your_subscriptions')}</h2>
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
  const locale = useLocale();
  const day = dayIn(locale);
  const [confirm, setConfirm] = useState<'stop' | 'resume' | null>(null);
  const [managing, setManaging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const what = r.products.join(', ') || t(locale, 'this_subscription');

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
        throw new PortalCallError(b.error ?? '', res.status, (b as { code?: string }).code);
      }
      setConfirm(null);
      router.refresh();
    } catch (e) {
      setError(friendlyError(e, locale));
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
      </div>
      <p className="mt-1 text-xs text-ink-subtle">
        {r.unavailable
          ? t(locale, 'renew_unavailable')
          : r.stops_at_period_end && r.renews_at
            ? t(locale, 'renew_stops_product', { date: day(r.renews_at, true) })
            : renewsLine(locale, day, r.renews_at, n)}
        {!r.unavailable && r.renews_at && (
          <button type="button" className={QUIET} onClick={() => (r.stops_at_period_end ? setConfirm('resume') : setManaging(true))}>
            {r.stops_at_period_end ? t(locale, 'resume_renewal') : t(locale, 'manage_renewal')}
          </button>
        )}
      </p>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      <ManageRenewal
        open={managing}
        onClose={() => setManaging(false)}
        onStop={() => {
          setManaging(false);
          setConfirm('stop');
        }}
        title={`${what} · ${r.community}`}
        fact={renewsLine(locale, day, r.renews_at, n)}
      />
      <ConfirmDialog
        open={confirm !== null}
        onCancel={() => setConfirm(null)}
        onConfirm={() => change(confirm === 'stop')}
        pending={busy}
        title={confirm === 'stop' ? t(locale, 'stop_q') : t(locale, 'resume_q')}
        message={
          confirm === 'stop'
            ? t(locale, 'stop_msg_product', {
                what,
                community: r.community,
                date: r.renews_at ? day(r.renews_at, true) : t(locale, 'end_of_period'),
              })
            : t(locale, 'resume_msg_product', {
                what,
                community: r.community,
                date: r.renews_at ? day(r.renews_at) : t(locale, 'its_renewal_date'),
              })
        }
        confirmLabel={confirm === 'stop' ? t(locale, 'stop_renewal') : t(locale, 'resume_renewal')}
        destructive={confirm === 'stop'}
      />
    </li>
  );
}
