import { pickPriceLogicRow } from '@thefibre/shared/price-logic';
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
  // THE SAME CHOICE THE CHARGE MAKES. `find` here showed a rule set from five
  // weeks earlier while six newer saves sat in the table, which is why an
  // admin could type a country, press Save, and watch it "disappear": the
  // save worked every time and this read the oldest row.
  const general = pickPriceLogicRow(rules, null);

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
