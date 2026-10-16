// The member's billing details — read-only here; edited on Purchases (P2) (Sjoerd, 2026-10-15:
// "Manage payment should not go to Stripe. We want to organise everything in
// THE FIBRE."), so there is deliberately no link to Stripe's portal here.

import type { MyProfile } from '@/lib/portal-api';
import type { Locale } from '@thefibre/shared/i18n';
import { t } from '@/lib/i18n';
import { parts } from '@/lib/i18n-parts';

export function BillingCard({ details, locale = 'en' }: { details: NonNullable<MyProfile['billing_details']>; locale?: Locale }) {
  const rows: [string, string | null][] = [
    [t(locale, 'bc_company'), details.company],
    [t(locale, 'f_address'), [details.address, [details.postal_code, details.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null],
    [t(locale, 'f_country'), details.country],
    [t(locale, 'vat_number'), details.tax_no],
  ];
  const shown = rows.filter(([, v]) => v);
  if (!shown.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-ink">{t(locale, 'billing_title')}</h2>
      <dl className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {shown.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="shrink-0 text-sm text-ink-muted">{k}</dt>
            <dd className="min-w-0 truncate text-sm text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-ink-muted">
        {parts(t(locale, 'change_them_under'), {
          link: (
            <a href="/purchases" className="underline underline-offset-2">
              {t(locale, 'nav_purchases')}
            </a>
          ),
        })}
      </p>
    </section>
  );
}
