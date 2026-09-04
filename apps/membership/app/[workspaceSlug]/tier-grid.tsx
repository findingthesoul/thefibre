'use client';

// Tier cards + inline join form. Yearly price is the headline; a monthly
// price (when set) is offered as an interval choice inside the form.

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { publicFetch, PublicApiError, type PublicProduct, type PublicTier } from '@/lib/public-api';
import { money } from '@/lib/money';
import { Button } from '@/components/ui/button';

const INPUT =
  'w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none';

type JoinState = 'idle' | 'submitting' | 'redirecting' | 'already';

export function TierGrid({
  workspaceSlug,
  tiers,
  products,
  initialTierId,
}: {
  workspaceSlug: string;
  tiers: PublicTier[];
  products: PublicProduct[];
  initialTierId: string | null;
}) {
  const [openTierId, setOpenTierId] = useState<string | null>(
    initialTierId && tiers.some((t) => t.id === initialTierId) ? initialTierId : null,
  );
  const productNames = useMemo(
    () => new Map(products.map((p) => [p.id, p.name])),
    [products],
  );

  const cols =
    tiers.length === 1
      ? 'sm:grid-cols-1 max-w-md mx-auto'
      : tiers.length === 2
        ? 'sm:grid-cols-2 max-w-2xl mx-auto'
        : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className={`mt-10 grid grid-cols-1 gap-6 ${cols}`}>
      {tiers.map((tier) => (
        <TierCard
          key={tier.id}
          workspaceSlug={workspaceSlug}
          tier={tier}
          includedProducts={tier.product_ids
            .map((id) => productNames.get(id))
            .filter((n): n is string => Boolean(n))}
          open={openTierId === tier.id}
          onOpen={() => setOpenTierId(tier.id)}
          onClose={() => setOpenTierId(null)}
        />
      ))}
    </div>
  );
}

function TierCard({
  workspaceSlug,
  tier,
  includedProducts,
  open,
  onOpen,
  onClose,
}: {
  workspaceSlug: string;
  tier: PublicTier;
  includedProducts: string[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const currency = tier.currency ?? 'EUR';
  const hasYear = tier.price_cents_year != null && tier.price_cents_year > 0;
  const hasMonth = tier.price_cents_month != null && tier.price_cents_month > 0;

  // Named to avoid shadowing window.setInterval.
  const [interval, setBillingInterval] = useState<'year' | 'month'>(hasYear ? 'year' : 'month');
  const [state, setState] = useState<JoinState>('idle');
  const [error, setError] = useState<string | null>(null);

  // One idempotency key per page visit — double-submits collapse server-side.
  const requestId = useMemo(
    () => `mjoin_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
    [],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    if (!name || !email) return setError('Please fill in your name and email.');

    setState('submitting');
    try {
      const res = await publicFetch<{ url?: string | null; already_member?: boolean }>(
        '/api/v1/membership/public/join',
        {
          method: 'POST',
          body: JSON.stringify({
            workspace_slug: workspaceSlug,
            tier_id: tier.id,
            interval,
            email,
            name,
            request_id: requestId,
          }),
        },
      );
      if (res.already_member) {
        setState('already');
        return;
      }
      if (res.url) {
        setState('redirecting');
        window.location.href = res.url;
        return;
      }
      setState('idle');
      setError('Something went wrong — please try again.');
    } catch (err) {
      setState('idle');
      const body = err instanceof PublicApiError ? (err.body as { error?: unknown }) : null;
      setError(
        typeof body?.error === 'string'
          ? body.error
          : 'Something went wrong — please try again.',
      );
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-line bg-surface-raised p-6">
      <h2 className="text-lg font-medium">{tier.name}</h2>

      <div className="mt-2 flex items-baseline gap-1.5">
        {hasYear ? (
          <>
            <span className="text-2xl font-semibold tabular-nums">
              {money(tier.price_cents_year!, currency)}
            </span>
            <span className="text-sm text-ink-subtle">/ year</span>
          </>
        ) : hasMonth ? (
          <>
            <span className="text-2xl font-semibold tabular-nums">
              {money(tier.price_cents_month!, currency)}
            </span>
            <span className="text-sm text-ink-subtle">/ month</span>
          </>
        ) : (
          <span className="text-sm text-ink-subtle">Price on request</span>
        )}
      </div>
      {hasYear && hasMonth && (
        <div className="mt-0.5 text-xs text-ink-muted">
          or {money(tier.price_cents_month!, currency)} / month
        </div>
      )}

      {tier.description && (
        <p className="mt-3 text-sm text-ink-subtle leading-relaxed">{tier.description}</p>
      )}

      {(tier.characteristics?.length ?? 0) > 0 && (
        <ul className="mt-4 space-y-1.5">
          {tier.characteristics!.map((ch, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-ink-subtle">
              <Check size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-emerald-600" />
              {ch}
            </li>
          ))}
        </ul>
      )}

      {includedProducts.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-ink-muted">Includes</div>
          <ul className="mt-1.5 space-y-1">
            {includedProducts.map((name) => (
              <li key={name} className="text-sm text-ink-subtle">
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto pt-5">
        {state === 'already' ? (
          <p className="text-sm text-ink-subtle rounded-md border border-line bg-surface px-3 py-2.5">
            You&apos;re already a member — check your email for sign-in.
          </p>
        ) : !open ? (
          <Button
            type="button"
            className="w-full"
            onClick={onOpen}
            disabled={!hasYear && !hasMonth}
          >
            Join
          </Button>
        ) : (
          <form onSubmit={onSubmit} className="space-y-2.5">
            {hasYear && hasMonth && (
              <div className="grid grid-cols-2 rounded-md border border-line overflow-hidden h-[34px] text-sm">
                {(
                  [
                    ['year', `${money(tier.price_cents_year!, currency)} / year`],
                    ['month', `${money(tier.price_cents_month!, currency)} / month`],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setBillingInterval(k)}
                    className={
                      interval === k
                        ? 'bg-surface-sunken text-ink font-medium'
                        : 'bg-surface text-ink-subtle hover:text-ink hover:bg-surface-sunken'
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <input
              name="name"
              placeholder="Your name"
              autoComplete="name"
              required
              className={INPUT}
            />
            <input
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              className={INPUT}
            />
            {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
            <Button
              type="submit"
              className="w-full"
              disabled={state === 'submitting' || state === 'redirecting'}
            >
              {state === 'redirecting'
                ? 'Taking you to payment…'
                : state === 'submitting'
                  ? 'One moment…'
                  : 'Continue to payment'}
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="w-full text-xs text-ink-muted hover:text-ink"
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
