// Invoices — every purchase across the Fibre apps, from the platform
// purchase ledger. Scope Me / Team / Workspace; role-gated per
// docs/invoices-and-roles-proposal.md. Membership subscription invoices
// land here automatically (one ledger row per billing period).

import { PageContainer, PageHeader } from '@/components/ui/page';
import { InvoicesClient } from './invoices-client';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
  // Membership has no team scoping (memberships are workspace-wide), so
  // the Team scope simply doesn't render — InvoicesClient hides the chip
  // when the list is empty.
  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Invoices"
        description="Every purchase across your Fibre apps — search, resend invoices, reimburse."
      />
      <InvoicesClient teams={[]} defaultApp="membership" />
    </PageContainer>
  );
}
