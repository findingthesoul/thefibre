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
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import type { Locale } from '@thefibre/shared/i18n';
import { t } from '@/lib/i18n';
import { friendlyError } from '@/lib/errors';
import { PortalCallError } from '@/lib/membership-portal-client';
import { parts } from '@/lib/i18n-parts';
import { money as fmtMoney } from '@/lib/format';
import { CardLine } from './card-change';

type Options = {
  interval: 'year' | 'month';
  currency: string;
  current_price_cents: number | null;
  downgrade: 'credit' | 'refund';
  addons: { id: string; name: string; price_cents: number; currency: string; recurring: boolean }[];
  tiers: { id: string; name: string; price_cents: number }[];
};
/** `needs_card` (additive, 2026-10-17): something is due now and there is no
 *  card to charge it to — the window asks for one and keeps Pay disabled. */
type Quote = { due_now_cents: number; tax_now_cents: number; then_cents: number; then_tax_cents: number; credit_cents: number; currency: string; needs_card?: boolean };
type Choice = { kind: 'addon' | 'tier'; id: string; name: string };



async function api<T>(path: string, body?: unknown, locale?: Locale): Promise<T> {
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
  if (!res.ok) throw new PortalCallError(json.error ?? '', res.status, (json as { code?: string }).code);
  return json;
}

export function ChangeMembership({
  memberId,
  community,
  tier,
  renewsOn,
  open,
  onClose,
  preselect,
}: {
  memberId: string;
  community: string;
  tier: string;
  /** The renewal date, already formatted. */
  renewsOn: string;
  open: boolean;
  onClose: () => void;
  /** An add-on to choose as the dialog opens — the shop's "Add" (2026-10-16),
   *  so the member lands on its preview rather than picking it again. */
  preselect?: { id: string; name: string };
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
  const locale = useLocale();
  const money = (cents: number, currency: string) => fmtMoney(cents, currency, locale);

  useEffect(() => {
    if (!open) return;
    setOptions(null);
    setChoice(null);
    setQuote(null);
    setError(null);
    setDone(null);
    api<Options>(`/me/options/${memberId}`, undefined, locale).then(setOptions, (e: unknown) => setError(friendlyError(e, locale)));
  }, [open, memberId, locale]);

  // The shop's preselected add-on: picked (and previewed) once the options
  // say it is still on offer — never a choice the options no longer hold.
  useEffect(() => {
    if (!open || !preselect || !options || choice) return;
    if (options.addons.some((a) => a.id === preselect.id)) void pick({ kind: 'addon', id: preselect.id, name: preselect.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselect?.id, options]);

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
          locale,
        ),
      );
    } catch (e) {
      setError(friendlyError(e, locale));
    }
  }

  async function confirm() {
    if (!choice || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(choice.kind === 'addon' ? `/me/addons/${memberId}` : `/me/change/${memberId}`, choice.kind === 'addon' ? { product_id: choice.id, request_id: requestId } : { tier_id: choice.id, request_id: requestId }, locale);
      setDone(choice.kind === 'addon' ? t(locale, 'change_done_addon', { name: choice.name }) : t(locale, 'change_done_tier', { name: choice.name }));
      router.refresh();
    } catch (e) {
      setError(friendlyError(e, locale));
    } finally {
      setBusy(false);
    }
  }

  const monthly = options?.interval === 'month';
  const per = monthly ? t(locale, 'per_month') : t(locale, 'per_year');
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
      title={t(locale, 'add_or_change')}
      description={`${tier} · ${community}`}
      footer={
        done ? (
          <Button type="button" onClick={onClose}>
            {t(locale, 'close')}
          </Button>
        ) : (
          <>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t(locale, 'cancel')}
            </Button>
            <Button type="button" onClick={confirm} disabled={!quote || busy || !!quote.needs_card}>
              {busy
                ? t(locale, 'one_moment')
                : quote && quote.due_now_cents > 0
                  ? t(locale, 'pay_amount', { amount: money(quote.due_now_cents, quote.currency) })
                  : t(locale, 'confirm')}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p className={NOTICE.success}>{done} {t(locale, 'receipt_on_way')}</p>
      ) : !options ? (
        error ? <p className={NOTICE.error}>{error}</p> : <p className="text-sm text-ink-subtle">{t(locale, 'loading')}</p>
      ) : (
        <div className="space-y-5">
          {options.addons.length > 0 && (
            <section>
              <h3 className="text-xs font-medium text-ink-muted">{t(locale, 'add_to_membership')}</h3>
              <ul className="mt-1.5 divide-y divide-line overflow-hidden rounded-xl border border-line">
                {options.addons.map((a) =>
                  row(
                    { kind: 'addon', id: a.id, name: a.name },
                    money(a.price_cents, a.currency),
                    a.recurring ? t(locale, 'renews_with_per', { per }) : t(locale, 'one_off'),
                  ),
                )}
              </ul>
            </section>
          )}
          {options.tiers.length > 0 && (
            <section>
              <h3 className="text-xs font-medium text-ink-muted">{t(locale, 'change_your_membership')}</h3>
              <ul className="mt-1.5 divide-y divide-line overflow-hidden rounded-xl border border-line">
                {options.tiers.map((tier) =>
                  row(
                    { kind: 'tier', id: tier.id, name: tier.name },
                    t(locale, 'price_per', { price: money(tier.price_cents, options.currency), per }),
                    options.current_price_cents !== null && tier.price_cents < options.current_price_cents
                      ? t(locale, 'less_than_now')
                      : t(locale, 'more_than_now'),
                  ),
                )}
              </ul>
            </section>
          )}
          {options.addons.length === 0 && options.tiers.length === 0 && (
            <p className="text-sm text-ink-subtle">{t(locale, 'nothing_to_change')}</p>
          )}
          <p className="text-xs text-ink-muted">{t(locale, 'prices_excl_vat')}</p>
          {choice && quote && (
            <div className={NOTICE.info}>
              {quote.due_now_cents > 0 ? (
                <p>
                  {parts(t(locale, 'quote_pay_now'), {
                    amount: <span className="font-medium text-ink">{money(quote.due_now_cents, quote.currency)}</span>,
                    vat: quote.tax_now_cents > 0 ? t(locale, 'quote_vat', { tax: money(quote.tax_now_cents, quote.currency) }) : '',
                  })}
                </p>
              ) : quote.credit_cents > 0 ? (
                <p>
                  {t(locale, options.downgrade === 'refund' ? 'quote_credit_refund' : 'quote_credit_credit', {
                    amount: money(quote.credit_cents, quote.currency),
                  })}
                </p>
              ) : (
                <p>{t(locale, 'nothing_charged')}</p>
              )}
              {quote.needs_card && (
                <div className="mt-2 border-t border-line pt-2">
                  <p className="font-medium text-ink">{t(locale, 'addon_needs_card')}</p>
                  {/* The same card line as on the page: "No card on file ·
                      change" opens the card form here, in The Fibre. */}
                  <CardLine memberId={memberId} />
                  <button type="button" onClick={() => choice && void pick(choice)} className="mt-1 text-xs text-ink-subtle underline underline-offset-2 hover:text-ink">
                    {t(locale, 'addon_card_recheck')}
                  </button>
                </div>
              )}
              {quote.then_cents > 0 && (
                <p className="mt-1">
                  {t(locale, monthly ? 'then_every_month' : 'then_every_year', {
                    amount: money(quote.then_cents, quote.currency),
                    vat: quote.then_tax_cents > 0 ? t(locale, 'then_vat') : '',
                    date: renewsOn,
                  })}
                </p>
              )}
            </div>
          )}
          {choice && !quote && !error && <p className="text-sm text-ink-subtle">{t(locale, 'working_price')}</p>}
          {error && <p className={NOTICE.error}>{error}</p>}
        </div>
      )}
    </Dialog>
  );
}
