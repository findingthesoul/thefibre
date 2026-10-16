'use client';

// Your billing details, kept in The Fibre (Purchases, P2). Sjoerd, 2026-10-15:
// "Manage payment should not go to Stripe." Saved here and told to Stripe —
// never read back from it. A new country or VAT number re-decides the VAT of
// a running membership from its next invoice; the page says what changed.
// Invoices already issued keep the details they were issued with.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@thefibre/shared/ui/button';
import { SearchSelect } from '@thefibre/shared/ui/search-select';
import { COUNTRY_OPTIONS } from '@thefibre/shared/countries';
import { browserSupabase } from '@/lib/supabase/client';
import type { BuyerDetails } from '@/lib/portal-api';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { t } from '@/lib/i18n';

const INPUT = 'w-full rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none';

type Outcome = { subscriptions: { community: string; vat: string | null; updated: boolean; error?: string }[] };

export function BillingDetailsForm({ initial }: { initial: BuyerDetails }) {
  const router = useRouter();
  const [d, setD] = useState<BuyerDetails>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Outcome | null>(null);
  const locale = useLocale();
  const set = (k: keyof BuyerDetails) => (v: string) => {
    setD((x) => ({ ...x, [k]: v }));
    setDone(null);
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await browserSupabase().auth.getSession();
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
      const res = await fetch(`${base}/api/v1/membership/portal/me/billing-details`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? t(locale, 'could_not_save', { status: res.status }));
      setDone(body as Outcome);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field = (k: keyof BuyerDetails, label: string, auto?: string) => (
    <label className="block">
      <span className="text-xs text-ink-subtle">{label}</span>
      <input className={`mt-1 ${INPUT}`} value={(d[k] as string | null) ?? ''} onChange={(e) => set(k)(e.target.value)} autoComplete={auto} />
    </label>
  );

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-ink">{t(locale, 'billing_title')}</h2>
      <p className="mt-1 text-xs text-ink-muted">
        {initial.from_checkout
          ? t(locale, 'billing_from_checkout')
          : t(locale, 'billing_used_next')}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2">
        {field('name', t(locale, 'f_name'), 'name')}
        {field('company', t(locale, 'f_company'), 'organization')}
        <div className="sm:col-span-2">{field('address', t(locale, 'f_address'), 'street-address')}</div>
        {field('postal_code', t(locale, 'f_postal_code'), 'postal-code')}
        {field('city', t(locale, 'f_city'), 'address-level2')}
        <label className="block">
          <span className="text-xs text-ink-subtle">{t(locale, 'f_country')}</span>
          <SearchSelect value={d.country ?? ''} onChange={set('country')} options={COUNTRY_OPTIONS} placeholder={t(locale, 'choose_country')} className="mt-1 w-full text-left" />
        </label>
        {field('tax_no', t(locale, 'f_vat'))}
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="button" variant="save" onClick={save} disabled={busy}>
            {busy ? t(locale, 'saving') : t(locale, 'save')}
          </Button>
          {error && <span className="text-xs text-red-700">{error}</span>}
        </div>
        {done && (
          <div className="text-xs text-ink-subtle sm:col-span-2">
            {t(locale, 'saved')}
            {done.subscriptions.map((s) => (
              <div key={s.community}>
                {s.community}:{' '}
                {s.error ? t(locale, 'billing_sub_error') : s.vat ? t(locale, 'billing_sub_vat', { vat: s.vat }) : t(locale, 'billing_sub_updated')}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
