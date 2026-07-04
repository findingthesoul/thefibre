// Invoices — every purchase across the Fibre apps, from the platform
// purchase ledger. Scope Me / Team / Workspace; role-gated per
// docs/invoices-and-roles-proposal.md.

import { apiFetch } from '@/lib/api';
import type { TeamOption } from '@/lib/thread-types';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { InvoicesClient } from './invoices-client';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
  const teams = await apiFetch<{ items: TeamOption[] }>('/api/v1/thread/teams')
    .then((r) => r.items)
    .catch(() => [] as TeamOption[]);

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Invoices"
        description="Every purchase across your Fibre apps — search, resend invoices, reimburse."
      />
      <InvoicesClient teams={teams.map((t) => ({ id: t.id, name: t.name }))} defaultApp="the-thread" />
    </PageContainer>
  );
}
