import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { Breadcrumb, PageContainer, PageHeader } from '../page-chrome';
import { DiscountCodesClient, type AdminCodeRow, type ScopeOption } from './codes-client';

// DISCOUNT CODES for the whole community.
//
// Without this page the codes are unreachable: the join panel has a field and
// the API has a table, and nobody can create the thing they are for. That is
// why it is part of the same slice rather than a nicer version later.
//
// Codes are workspace-wide by default and may be limited to one TIER or one
// PRODUCT — which is why both lists are fetched here and handed down as the
// scope options. A failure to read either is not a failure to show the page:
// the codes still edit, scoped to everything, which is the common case.

export default async function DiscountCodesPage() {
  const locale = await uiLocale();
  const [codes, tiers, products] = await Promise.all([
    apiFetch<{ items: AdminCodeRow[] }>('/api/v1/membership/discount-codes')
      .then((r) => r.items)
      .catch(() => [] as AdminCodeRow[]),
    apiFetch<{ items: { id: string; name: string }[] }>('/api/v1/membership/tiers')
      .then((r) => r.items)
      .catch(() => [] as { id: string; name: string }[]),
    apiFetch<{ items: { id: string; name: string }[] }>('/api/v1/membership/products')
      .then((r) => r.items)
      .catch(() => [] as { id: string; name: string }[]),
  ]);

  const scopeOptions: ScopeOption[] = [
    ...tiers.map((x) => ({ value: x.id, label: x.name, kind: 'tier' as const })),
    ...products.map((x) => ({ value: x.id, label: x.name, kind: 'product' as const })),
  ];

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label={t(locale, 'nav_settings')} />
      <PageHeader
        title={t(locale, 'st_discount_codes_title')}
        description={t(locale, 'st_discount_codes_desc')}
      />
      <div className="mt-8">
        <DiscountCodesClient initial={codes} scopeOptions={scopeOptions} locale={locale} />
      </div>
    </PageContainer>
  );
}
