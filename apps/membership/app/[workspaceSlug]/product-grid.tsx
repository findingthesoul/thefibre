'use client';

// À-la-carte product cards (2026-09-06) — the tier-grid's sibling: a
// product marked purchasable (with a price) gets a Buy button that opens
// the same inline name+email form and hands off to Stripe Checkout in
// one-off payment mode. Prices are FLAT — the pricing logic builder is
// tier-scoped, so no country adjustment here.

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { publicFetch, PublicApiError, type PublicProduct } from '@/lib/public-api';
import { money } from '@/lib/money';
import { t, type Locale } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

const INPUT =
  'w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none';

type BuyState = 'idle' | 'submitting' | 'redirecting' | 'already';

export function ProductGrid({
  workspaceSlug,
  products,
  locale = 'en',
}: {
  workspaceSlug: string;
  products: PublicProduct[];
  /** Resolved server-side by the page (Thread pattern) — never from cookies. */
  locale?: Locale;
}) {
  const buyable = products.filter(
    (p) => p.purchasable && p.price_cents != null && p.price_cents > 0,
  );
  if (buyable.length === 0) return null;

  const cols =
    buyable.length === 1
      ? 'sm:grid-cols-1 max-w-md mx-auto'
      : buyable.length === 2
        ? 'sm:grid-cols-2 max-w-2xl mx-auto'
        : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <section className="mt-16">
      <h2 className="text-xl font-medium tracking-tight text-center">
        {t(locale, 'products_headline')}
      </h2>
      <div className={`mt-8 grid grid-cols-1 gap-6 ${cols}`}>
        {buyable.map((product) => (
          <ProductCard
            key={product.id}
            workspaceSlug={workspaceSlug}
            product={product}
            locale={locale}
          />
        ))}
      </div>
    </section>
  );
}

function ProductCard({
  workspaceSlug,
  product,
  locale,
}: {
  workspaceSlug: string;
  product: PublicProduct;
  locale: Locale;
}) {
  const currency = product.currency ?? 'EUR';
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<BuyState>('idle');
  const [error, setError] = useState<string | null>(null);

  // One idempotency key per page visit — double-submits collapse server-side
  // (it doubles as the Stripe idempotency key on the session create).
  const requestId = useMemo(
    () => `mbuy_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
    [],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    if (!name || !email) return setError(t(locale, 'fill_name_email'));

    setState('submitting');
    try {
      const res = await publicFetch<{ url?: string | null; already_purchased?: boolean }>(
        '/api/v1/membership/public/buy',
        {
          method: 'POST',
          body: JSON.stringify({
            workspace_slug: workspaceSlug,
            product_id: product.id,
            email,
            name,
            locale,
            request_id: requestId,
          }),
        },
      );
      if (res.already_purchased) {
        setState('already');
        return;
      }
      if (res.url) {
        setState('redirecting');
        window.location.href = res.url;
        return;
      }
      setState('idle');
      setError(t(locale, 'something_wrong'));
    } catch (err) {
      setState('idle');
      const body = err instanceof PublicApiError ? (err.body as { error?: unknown }) : null;
      setError(typeof body?.error === 'string' ? body.error : t(locale, 'something_wrong'));
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-line bg-surface-raised p-6">
      <h3 className="text-lg font-medium">{product.name}</h3>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums">
          {money(product.price_cents!, currency)}
        </span>
        <span className="text-sm text-ink-subtle">{t(locale, 'one_off')}</span>
      </div>

      {product.description && (
        <p className="mt-3 text-sm text-ink-subtle leading-relaxed">{product.description}</p>
      )}

      {(product.characteristics?.length ?? 0) > 0 && (
        <ul className="mt-4 space-y-1.5">
          {product.characteristics!.map((ch, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-ink-subtle">
              <Check size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-emerald-600" />
              {ch}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-5">
        {state === 'already' ? (
          <p className="text-sm text-ink-subtle rounded-md border border-line bg-surface px-3 py-2.5">
            {t(locale, 'already_purchased_note')}
          </p>
        ) : !open ? (
          <Button type="button" className="w-full" onClick={() => setOpen(true)}>
            {t(locale, 'buy')}
          </Button>
        ) : (
          <form onSubmit={onSubmit} className="space-y-2.5">
            <input
              name="name"
              placeholder={t(locale, 'your_name')}
              autoComplete="name"
              required
              className={INPUT}
            />
            <input
              name="email"
              type="email"
              placeholder={t(locale, 'email_placeholder')}
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
                ? t(locale, 'taking_to_payment')
                : state === 'submitting'
                  ? t(locale, 'one_moment')
                  : t(locale, 'continue_to_payment')}
            </Button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full text-xs text-ink-muted hover:text-ink"
            >
              {t(locale, 'cancel')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
