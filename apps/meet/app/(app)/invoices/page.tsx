// Invoices — every purchase across the Fibre apps, from the platform
// purchase ledger. Scope Me / Team / Workspace; role-gated per
// docs/invoices-and-roles-proposal.md.

import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { InvoicesClient } from './invoices-client';

export const dynamic = 'force-dynamic';

type MeetTeamItem = {
  team: { id: string; name: string } | { id: string; name: string }[] | null;
};

export default async function InvoicesPage() {
  const locale = await uiLocale();
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
        title={t(locale, 'invoices_title')}
        description={t(locale, 'invoices_desc')}
      />
      <InvoicesClient teams={teams} defaultApp="fibre-meet" />
    </PageContainer>
  );
}
