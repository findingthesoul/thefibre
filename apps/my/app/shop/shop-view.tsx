'use client';

// The shop's layout and its three actions. Every action is a route that
// already exists — this file decides nothing about who may have what:
//   · Add to membership → the "Add or change" dialog, this product chosen
//     (preview, then confirm on the ONE subscription);
//   · Buy → /public/buy;  Subscribe → /public/subscribe (Stripe Checkout).
// Owned products are listed and never offered; a renewing one points at
// Purchases, where it is stopped.

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@thefibre/shared/ui/button';
import { NOTICE, ROW_LIST } from '@thefibre/shared/ui/recipes';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import type { Locale } from '@thefibre/shared/i18n';
import { t, type MyKey } from '@/lib/i18n';
import { money, fmtDate } from '@/lib/format';
import type { ShopCommunity } from '@/lib/portal-api';
import { ChangeMembership } from '../purchases/change-membership';

type Renewal = { member_id: string; community: string; tier: string; renews_at: string | null };
type Buyer = { email: string; name: string; country: string | null; taxNo: string | null };

const PER: Record<string, MyKey> = { year: 'per_year', month: 'per_month' };

function priceLine(locale: Locale, cents: number | null, currency: string, interval: string | null, inclVat = false): string {
  if (cents == null) return '';
  const amount = money(cents, currency, locale);
  const iv = interval ?? 'once';
  const base = iv === 'once' ? `${amount} · ${t(locale, 'one_off')}` : PER[iv] ? t(locale, 'price_per', { price: amount, per: t(locale, PER[iv]!) }) : `${amount} / ${iv}`;
  return inclVat ? `${base} · ${t(locale, 'price_incl_vat')}` : base;
}

export function ShopView({ communities, renewals, buyer }: { communities: ShopCommunity[]; renewals: Renewal[]; buyer: Buyer }) {
  const locale = useLocale();
  const [adding, setAdding] = useState<{ memberId: string; id: string; name: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ ws: string; message: string } | null>(null);
  const renewalOf = (memberId: string | null) => renewals.find((r) => r.member_id === memberId) ?? null;
  const addingRenewal = adding ? renewalOf(adding.memberId) : null;

  async function checkout(c: ShopCommunity, item: ShopCommunity['open'][number]) {
    setBusy(item.id);
    setError(null);
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
    const route = item.action === 'subscribe' ? '/api/v1/membership/public/subscribe' : '/api/v1/membership/public/buy';
    const common = {
      workspace_slug: c.workspace_slug,
      email: buyer.email,
      name: buyer.name,
      locale,
      request_id: `shop_${crypto.randomUUID().replace(/-/g, '')}`,
      // Back to my.thread after Stripe (Purchases on success, the Shop on
      // cancel) — a token the API maps to its own my.thread origin, never a URL.
      return_to: 'my' as const,
      ...(buyer.country ? { country: buyer.country } : {}),
    };
    // Each route takes the VAT number where its own form does (as the page
    // basket sends it): `billing.tax_no` to subscribe, `vat_id` to buy.
    const body =
      item.action === 'subscribe'
        ? { ...common, product_ids: [item.id], ...(buyer.taxNo ? { billing: { tax_no: buyer.taxNo } } : {}) }
        : { ...common, product_id: item.id, ...(buyer.taxNo ? { vat_id: buyer.taxNo } : {}) };
    try {
      const res = await fetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as { url?: string | null; already_purchased?: boolean; error?: unknown };
      if (json.already_purchased) {
        setError({ ws: c.workspace_id, message: t(locale, 'shop_already', { name: item.name }) });
      } else if (res.ok && json.url) {
        window.location.assign(json.url);
        return;
      } else {
        const msg = typeof json.error === 'string' ? json.error : '';
        // A VAT-registered community needs the buyer's country; say where
        // it is given rather than show a bare refusal.
        setError({ ws: c.workspace_id, message: !buyer.country && /country/i.test(msg) ? t(locale, 'shop_need_details') : msg || t(locale, 'did_not_save') });
      }
    } catch {
      setError({ ws: c.workspace_id, message: t(locale, 'did_not_save') });
    }
    setBusy(null);
  }

  const label = (key: MyKey) => <h3 className="mb-2 mt-5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">{t(locale, key)}</h3>;

  return (
    <div className="mt-6 space-y-10">
      {communities.map((c) => (
        <section key={c.workspace_id} data-community={c.workspace_name}>
          <h2 className="text-base font-semibold text-ink">{c.workspace_name}</h2>

          {c.members_only.length > 0 && renewalOf(c.member_id) && (
            <>
              {label('shop_members_only')}
              <ul className={ROW_LIST}>
                {c.members_only.map((p) => (
                  <li key={p.id} data-item={p.name} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">{p.name}</div>
                      <div className="text-xs text-ink-muted">{priceLine(locale, p.price_cents, p.currency, p.price_interval)}</div>
                    </div>
                    <Button variant="secondary" className="shrink-0 whitespace-nowrap" onClick={() => setAdding({ memberId: c.member_id!, id: p.id, name: p.name })}>
                      {t(locale, 'shop_add')}
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {c.open.length > 0 && (
            <>
              {label('shop_open')}
              <ul className={ROW_LIST}>
                {c.open.map((p) => (
                  <li key={p.id} data-item={p.name} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">{p.name}</div>
                      {p.description && <div className="truncate text-xs text-ink-subtle">{p.description}</div>}
                      <div className="text-xs text-ink-muted">{priceLine(locale, p.price_cents, p.currency, p.price_interval, p.price_includes_vat)}</div>
                    </div>
                    <Button variant="secondary" className="shrink-0 whitespace-nowrap" disabled={busy !== null} onClick={() => void checkout(c, p)}>
                      {busy === p.id ? t(locale, 'loading') : t(locale, p.action === 'subscribe' ? 'shop_subscribe' : 'shop_buy')}
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {c.owned.length > 0 && (
            <>
              {label('shop_owned')}
              <ul className={ROW_LIST}>
                {c.owned.map((p) => (
                  <li key={p.id} data-item={p.name} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="truncate text-sm text-ink">{p.name}</div>
                    {p.recurring && (
                      <Link href="/purchases" className="shrink-0 text-xs text-ink underline underline-offset-2 hover:opacity-70">
                        {t(locale, 'shop_stop_in_purchases')}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {error?.ws === c.workspace_id && <p className={`mt-3 ${NOTICE.error}`}>{error.message}</p>}
        </section>
      ))}

      <p className="text-xs text-ink-muted">{t(locale, 'prices_excl_vat')}</p>

      {adding && addingRenewal && (
        <ChangeMembership
          memberId={adding.memberId}
          community={addingRenewal.community}
          tier={addingRenewal.tier}
          renewsOn={fmtDate(addingRenewal.renews_at, locale) ?? ''}
          open
          onClose={() => setAdding(null)}
          preselect={{ id: adding.id, name: adding.name }}
        />
      )}
    </div>
  );
}
