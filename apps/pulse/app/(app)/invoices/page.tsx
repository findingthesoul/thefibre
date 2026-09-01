// Invoices — every purchase across the Fibre apps, from the platform
// purchase ledger. Scope Me / Team / Workspace; role-gated per
// docs/invoices-and-roles-proposal.md. Copied from The Thread's invoices
// lane; Pulse extras: the mark-paid dialog needs the Pulse accounts (to
// record which bank the money landed on), so they're fetched here too.

import { apiFetch } from '@/lib/api';
import { PageContainer, PageHeader } from '../settings/page-chrome';
import {
  InvoicesClient,
  type InvoiceAccount,
  type CashflowTeam,
} from './invoices-client';

export const metadata = { title: 'Invoices · Pulse' };
export const dynamic = 'force-dynamic';

// Raw shape of GET /api/v1/pulse/involved-teams — team joins can come back
// as an object or a one-element array depending on the relationship.
type InvolvedTeamRow = {
  team_id: string;
  team: { id: string; name: string } | { id: string; name: string }[] | null;
};

async function involvedTeams(): Promise<CashflowTeam[]> {
  try {
    const r = await apiFetch<{ items: InvolvedTeamRow[] }>('/api/v1/pulse/involved-teams');
    return (r.items ?? []).map((row) => {
      const t = Array.isArray(row.team) ? row.team[0] : row.team;
      return { team_id: row.team_id, name: t?.name ?? 'Team' };
    });
  } catch {
    return [];
  }
}

export default async function InvoicesPage() {
  const [teams, accounts, cashflowTeams, myUserId] = await Promise.all([
    // Workspace teams for the Team scope switcher — RLS on the purchases
    // query proves membership, so listing them all is safe.
    apiFetch<{ items: { id: string; name: string }[] }>('/api/v1/teams')
      .then((r) => r.items)
      .catch(() => [] as { id: string; name: string }[]),
    // Unfiltered — every account the user can see, grouped by cashflow in
    // the mark-paid dialog.
    apiFetch<{ items: InvoiceAccount[] }>('/api/v1/pulse/accounts')
      .then((r) => r.items)
      .catch(() => [] as InvoiceAccount[]),
    involvedTeams(),
    apiFetch<{ user: { id: string } }>('/api/v1/auth/me')
      .then((r) => r.user?.id ?? null)
      .catch(() => null),
  ]);

  return (
    <PageContainer max="4xl">
      <PageHeader
        title="Invoices"
        description="Every purchase across your Fibre apps — search, resend invoices, reimburse."
      />
      <InvoicesClient
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        defaultApp="fibre-pulse"
        accounts={accounts}
        cashflowTeams={cashflowTeams}
        myUserId={myUserId}
      />
    </PageContainer>
  );
}
