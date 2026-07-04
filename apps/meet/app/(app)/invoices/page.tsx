// Invoices — every purchase across the Fibre apps, from the platform
// purchase ledger. Scope Me / Team / Workspace; role-gated per
// docs/invoices-and-roles-proposal.md.

import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { InvoicesClient } from './invoices-client';

export const dynamic = 'force-dynamic';

type MeetTeamItem = {
  team: { id: string; name: string } | { id: string; name: string }[] | null;
};

export default async function InvoicesPage() {
  const teams = await apiFetch<{ items: MeetTeamItem[] }>('/api/v1/meet/teams')
    .then((r) =>
      r.items
        .map((m) => (Array.isArray(m.team) ? m.team[0] : m.team))
        .filter(Boolean)
        .map((t) => ({ id: t!.id, name: t!.name })),
    )
    .catch(() => [] as { id: string; name: string }[]);

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Invoices"
        description="Every purchase across your Fibre apps — search, resend invoices, reimburse."
      />
      <InvoicesClient teams={teams} />
    </PageContainer>
  );
}
