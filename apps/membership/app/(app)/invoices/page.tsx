// Invoices — every purchase across the Fibre apps, from the platform
// purchase ledger. Scope Me / Team / Workspace; role-gated per
// docs/invoices-and-roles-proposal.md. Membership subscription invoices
// land here automatically (one ledger row per billing period).

import { PageContainer, PageHeader } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { InvoicesClient } from './invoices-client';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
  const locale = await uiLocale();
  // Membership has no team scoping (memberships are workspace-wide), so
  // the Team scope simply doesn't render — InvoicesClient hides the chip
  // when the list is empty.
  return (
    <PageContainer max="4xl">
      <PageHeader
        title={t(locale, 'nav_invoices')}
        description={t(locale, 'invoices_desc')}
      />
      <InvoicesClient teams={[]} defaultApp="membership" />
    </PageContainer>
  );
}
