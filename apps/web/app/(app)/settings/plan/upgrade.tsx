'use client';

// The money controls — fully in-app since 0.25.0 ("work on the internal
// product up and downgrading. and invoicing" — Sjoerd, 2026-09-03):
//
//  - Not subscribed → checkout buttons (Stripe's hosted page, once).
//  - Subscribed     → switch plan/interval right here (prorated and invoiced
//    immediately, card on file), downgrade to Free (= cancel at period end,
//    with a confirm), or undo a pending cancellation.
//  - "Manage billing" remains for what Stripe genuinely owns: the card and
//    the hosted invoice history.
//
// Admin-gated server-side; everyone may see the buttons, the API declines
// non-admins politely.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { eur } from '@/lib/plans';
import { COUNTRIES } from '@/lib/countries';
// Aliased: the plan-target map below already binds `t` per row.
import { t as tr, type Locale } from '@/lib/i18n-ui';
import { startCheckout, openPortal, switchPlan, cancelPlan, resumePlan } from './actions';

type Target = {
  id: string;
  name: string;
  price_cents_month: number;
  price_cents_year: number | null;
};

export function UpgradePanel({
  locale,
  currentPlanId,
  currentInterval,
  comped,
  subscribed,
  cancelling,
  targets,
}: {
  locale: Locale;
  currentPlanId: string;
  currentInterval: string | null;
  comped: boolean;
  subscribed: boolean;
  cancelling: boolean;
  targets: Target[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: 'switch'; planId: string; name: string; interval: 'monthly' | 'annual'; label: string }
    | { kind: 'cancel' }
    | null
  >(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<{ url?: string; error?: string; usePortal?: boolean }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.usePortal) {
        const p = await openPortal();
        if (p.url) window.location.href = p.url;
        else setError(p.error ?? tr(locale, 'portal_open_failed'));
        return;
      }
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      if (r.error) {
        setError(r.error);
      } else {
        setConfirm(null);
        router.refresh();
      }
    });
  }

  // One billing toggle for the whole row (Sjoerd, 2026-09-03: "1
  // subscription with a toggle for per year"). Declared before any early
  // return — hooks must run unconditionally.
  const [interval, setInterval] = useState<'monthly' | 'annual'>(
    currentInterval === 'annual' ? 'annual' : 'monthly',
  );
  // Billing country for a FIRST checkout — the VAT rate is pinned before the
  // Stripe page exists (dynamic per-address rates are gone from Stripe's
  // API). The webhook corrects future invoices if the typed address differs.
  const [country, setCountry] = useState('NL');

  if (comped) return null; // nothing to buy — the plan was granted

  const paid = targets.filter((t) => t.price_cents_month > 0);

  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="mb-3 inline-flex rounded-md border border-line p-0.5 text-xs">
          {(['monthly', 'annual'] as const).map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => setInterval(iv)}
              className={`rounded px-3 py-1.5 transition-colors ${
                interval === iv ? 'bg-ink text-ink-inverse' : 'text-ink-subtle hover:text-ink'
              }`}
            >
              {iv === 'monthly' ? tr(locale, 'monthly') : tr(locale, 'yearly_two_free')}
            </button>
          ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {cancelling && (
          <Button size="sm" onClick={() => run(resumePlan)} disabled={pending}>
            {pending ? tr(locale, 'working') : tr(locale, 'keep_my_plan')}
          </Button>
        )}

        {paid.map((t) => {
            const cents = interval === 'monthly' ? t.price_cents_month : t.price_cents_year;
            if (cents === null || cents === 0) return null;
            const isCurrent = t.id === currentPlanId && interval === (currentInterval ?? 'monthly');
            const label = `${t.name} — ${eur(cents)}${
              interval === 'monthly' ? tr(locale, 'per_mo') : tr(locale, 'per_yr')
            }`;
            if (isCurrent) {
              return (
                <span
                  key={t.id}
                  className="inline-flex h-8 items-center rounded-md border border-line px-3 text-sm text-ink-muted"
                >
                  {t.name} — {tr(locale, 'current_plan')}
                </span>
              );
            }
            return (
              <Button
                key={t.id}
                variant={!subscribed && t.id === 'pro' ? 'primary' : 'secondary'}
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (subscribed) {
                    setConfirm({ kind: 'switch', planId: t.id, name: t.name, interval, label });
                  } else {
                    run(() => startCheckout(t.id, interval, country));
                  }
                }}
              >
                {label}
              </Button>
            );
        })}

        {subscribed && !cancelling && (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirm({ kind: 'cancel' })}>
            {tr(locale, 'downgrade_to_free')}
          </Button>
        )}

        {subscribed && (
          <Button variant="ghost" size="sm" onClick={() => run(openPortal)} disabled={pending}>
            {tr(locale, 'payment_method')}
          </Button>
        )}
      </div>

      {!subscribed && paid.length > 0 && (
        <label className="mt-3 flex items-center gap-2 text-xs text-ink-subtle">
          {tr(locale, 'billing_country')}
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="h-8 rounded-md border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-line-strong"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      {!subscribed && paid.length > 0 && (
        <p className="mt-2 text-xs text-ink-muted">{tr(locale, 'checkout_stripe_note')}</p>
      )}
      {subscribed && !cancelling && (
        <p className="mt-2 text-xs text-ink-muted">{tr(locale, 'switch_note')}</p>
      )}

      <ConfirmDialog
        open={confirm?.kind === 'switch'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === 'switch') run(() => switchPlan(confirm.planId, confirm.interval));
        }}
        title={
          confirm?.kind === 'switch' ? tr(locale, 'switch_to_q', { label: confirm.label }) : ''
        }
        message={
          cancelling ? tr(locale, 'switch_msg_cancelling') : tr(locale, 'switch_msg')
        }
        confirmLabel={tr(locale, 'switch_now')}
        pending={pending}
      />
      <ConfirmDialog
        open={confirm?.kind === 'cancel'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(cancelPlan)}
        title={tr(locale, 'downgrade_to_free_q')}
        message={tr(locale, 'downgrade_msg')}
        confirmLabel={tr(locale, 'downgrade_at_period_end')}
        destructive
        pending={pending}
      />
    </div>
  );
}
