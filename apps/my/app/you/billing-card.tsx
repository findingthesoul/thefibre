// The billing details a member last gave at a checkout — READ-ONLY for now.
// Editing them in The Fibre comes with Purchases (Sjoerd, 2026-10-15:
// "Manage payment should not go to Stripe. We want to organise everything in
// THE FIBRE."), so there is deliberately no link to Stripe's portal here.

import type { MyProfile } from '@/lib/portal-api';

export function BillingCard({ details }: { details: NonNullable<MyProfile['billing_details']> }) {
  const rows: [string, string | null][] = [
    ['Company', details.company],
    ['Address', [details.address, [details.postal_code, details.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null],
    ['Country', details.country],
    ['VAT number', details.tax_no],
  ];
  const shown = rows.filter(([, v]) => v);
  if (!shown.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-ink">Billing details</h2>
      <dl className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {shown.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="shrink-0 text-sm text-ink-muted">{k}</dt>
            <dd className="min-w-0 truncate text-sm text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-ink-muted">As given at your last payment. Editing your billing details here is coming soon.</p>
    </section>
  );
}
