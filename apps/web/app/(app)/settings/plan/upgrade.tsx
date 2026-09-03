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
import { startCheckout, openPortal, switchPlan, cancelPlan, resumePlan } from './actions';

type Target = {
  id: string;
  name: string;
  price_cents_month: number;
  price_cents_year: number | null;
};

export function UpgradePanel({
  currentPlanId,
  currentInterval,
  comped,
  subscribed,
  cancelling,
  targets,
}: {
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
        else setError(p.error ?? 'could not open the billing portal');
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

  if (comped) return null; // nothing to buy — the plan was granted

  const paid = targets.filter((t) => t.price_cents_month > 0);

  // Every plan×interval combination that isn't the current one.
  const options = paid.flatMap((t) => {
    const opts: { planId: string; name: string; interval: 'monthly' | 'annual'; priceLabel: string }[] = [];
    if (!(t.id === currentPlanId && currentInterval === 'monthly')) {
      opts.push({ planId: t.id, name: t.name, interval: 'monthly', priceLabel: `${eur(t.price_cents_month)}/mo` });
    }
    if (
      t.price_cents_year !== null &&
      t.price_cents_year > 0 &&
      !(t.id === currentPlanId && currentInterval === 'annual')
    ) {
      opts.push({ planId: t.id, name: t.name, interval: 'annual', priceLabel: `${eur(t.price_cents_year)}/yr` });
    }
    return opts;
  });

  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="flex flex-wrap items-center gap-2">
        {cancelling && (
          <Button size="sm" onClick={() => run(resumePlan)} disabled={pending}>
            {pending ? 'Working…' : 'Keep my plan'}
          </Button>
        )}

        {!cancelling &&
          options.map((o) => {
            const label = `${o.name} — ${o.priceLabel}`;
            return (
              <Button
                key={`${o.planId}-${o.interval}`}
                variant={subscribed ? 'secondary' : o.planId === 'pro' && o.interval === 'monthly' ? 'primary' : 'secondary'}
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (subscribed) {
                    setConfirm({ kind: 'switch', planId: o.planId, name: o.name, interval: o.interval, label });
                  } else {
                    run(() => startCheckout(o.planId, o.interval));
                  }
                }}
              >
                {label}
              </Button>
            );
          })}

        {subscribed && !cancelling && (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirm({ kind: 'cancel' })}>
            Downgrade to Free
          </Button>
        )}

        {subscribed && (
          <Button variant="ghost" size="sm" onClick={() => run(openPortal)} disabled={pending}>
            Invoices &amp; card
          </Button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      {!subscribed && options.length > 0 && (
        <p className="mt-2 text-xs text-ink-muted">
          Checkout and card details run on Stripe — we never see the number. Yearly is two months
          free.
        </p>
      )}
      {subscribed && !cancelling && (
        <p className="mt-2 text-xs text-ink-muted">
          Switching charges or credits the difference immediately, on the card on file, with an
          invoice below. Downgrading to Free takes effect at the period end — everything you built
          stays.
        </p>
      )}

      <ConfirmDialog
        open={confirm?.kind === 'switch'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === 'switch') run(() => switchPlan(confirm.planId, confirm.interval));
        }}
        title={confirm?.kind === 'switch' ? `Switch to ${confirm.label}?` : ''}
        message="The difference is prorated and invoiced immediately on your card on file. Your allowances change right away."
        confirmLabel="Switch now"
        pending={pending}
      />
      <ConfirmDialog
        open={confirm?.kind === 'cancel'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(cancelPlan)}
        title="Downgrade to Free?"
        message="Your plan stays active until the end of the paid period, then the workspace drops to Free. Nothing is deleted, and coming back is one click."
        confirmLabel="Downgrade at period end"
        destructive
        pending={pending}
      />
    </div>
  );
}
