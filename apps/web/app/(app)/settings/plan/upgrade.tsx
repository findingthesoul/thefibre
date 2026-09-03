'use client';

// The money buttons. Checkout runs on Stripe's hosted page (subscription
// mode, platform account); the portal handles card changes, plan switches
// and cancellation. Admin-gated server-side — everyone may see the buttons,
// the API says no politely to non-admins.

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { eur } from '@/lib/plans';
import { startCheckout, openPortal } from './actions';

type UpgradeTarget = {
  id: string;
  name: string;
  price_cents_month: number;
  price_cents_year: number | null;
};

export function UpgradePanel({
  currentPlanId,
  comped,
  subscribed,
  targets,
}: {
  currentPlanId: string;
  comped: boolean;
  subscribed: boolean;
  targets: UpgradeTarget[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function go(fn: () => Promise<{ url?: string; error?: string; usePortal?: boolean }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.usePortal) {
        const p = await openPortal();
        if (p.url) window.location.href = p.url;
        else setError(p.error ?? 'could not open the billing portal');
        return;
      }
      if (r.url) window.location.href = r.url;
      else setError(r.error ?? 'something went wrong');
    });
  }

  if (comped) return null; // nothing to buy — the plan was granted

  const upgrades = targets.filter((t) => t.id !== currentPlanId && t.price_cents_month > 0);

  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="flex flex-wrap items-center gap-3">
        {subscribed ? (
          <Button variant="secondary" size="sm" onClick={() => go(openPortal)} disabled={pending}>
            {pending ? 'Opening…' : 'Change plan, cancel, invoices, card — Manage billing'}
          </Button>
        ) : (
          upgrades.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <Button size="sm" onClick={() => go(() => startCheckout(t.id, 'monthly'))} disabled={pending}>
                {t.name} — {eur(t.price_cents_month)}/mo
              </Button>
              {t.price_cents_year !== null && t.price_cents_year > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => go(() => startCheckout(t.id, 'annual'))}
                  disabled={pending}
                >
                  {eur(t.price_cents_year)}/yr
                </Button>
              )}
            </div>
          ))
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      {!subscribed && upgrades.length > 0 && (
        <p className="mt-2 text-xs text-ink-muted">
          Checkout and card details run on Stripe — we never see the number. Yearly is two months
          free.
        </p>
      )}
      {subscribed && (
        <p className="mt-2 text-xs text-ink-muted">
          Switching up or down prorates automatically; cancelling takes effect at the period end
          and drops the workspace to Free — everything you built stays.
        </p>
      )}
    </div>
  );
}
