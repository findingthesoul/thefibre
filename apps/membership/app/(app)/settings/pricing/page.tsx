import { apiFetch } from '@/lib/api';
import { Breadcrumb, PageContainer, PageHeader } from '../page-chrome';
import { PricingRulesClient, type PricingRuleRow } from './pricing-client';

// The pricing LOGIC BUILDER (§3.9, generalised — Sjoerd: "a logic builder…
// other people can build other logic"). Declarative rows, first match wins,
// deliberately not a canvas: money logic must be auditable at a glance.

export default async function PricingRulesPage() {
  const rules = await apiFetch<{ items: PricingRuleRow[] }>('/api/v1/membership/pricing-rules')
    .then((r) => r.items)
    .catch(() => [] as PricingRuleRow[]);
  const general = rules.find((r) => r.tier_id === null) ?? null;

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Pricing rules"
        description="Adjust prices by rules — purchasing-power pricing by country, or whatever logic your community needs. First matching rule wins; checkout always computes server-side."
      />
      <div className="mt-8">
        <PricingRulesClient initial={general?.config ?? null} />
      </div>
    </PageContainer>
  );
}
