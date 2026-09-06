import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { Breadcrumb, PageContainer, PageHeader } from '../page-chrome';
import { PricingRulesClient, type PricingRuleRow } from './pricing-client';

// The pricing LOGIC BUILDER (§3.9, generalised — Sjoerd: "a logic builder…
// other people can build other logic"). Declarative rows, first match wins,
// deliberately not a canvas: money logic must be auditable at a glance.

export default async function PricingRulesPage() {
  const locale = await uiLocale();
  const rules = await apiFetch<{ items: PricingRuleRow[] }>('/api/v1/membership/pricing-rules')
    .then((r) => r.items)
    .catch(() => [] as PricingRuleRow[]);
  const general = rules.find((r) => r.tier_id === null) ?? null;

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label={t(locale, 'nav_settings')} />
      <PageHeader title={t(locale, 'st_pricing_title')} description={t(locale, 'pricing_desc')} />
      <div className="mt-8">
        <PricingRulesClient initial={general?.config ?? null} locale={locale} />
      </div>
    </PageContainer>
  );
}
