import { apiFetch } from '@/lib/api';
import {
  AccountsActions,
  AccountsList,
  type Account,
  type CashflowTeam,
} from './accounts-client';

export const metadata = { title: 'Accounts · Pulse' };

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

// Platform user id of the signed-in user — needed to write owner_user_id for
// the personal ("Me") cashflow. Degrades to null (option hidden).
async function currentUserId(): Promise<string | null> {
  try {
    const r = await apiFetch<{ user: { id: string } }>('/api/v1/auth/me');
    return r.user?.id ?? null;
  } catch {
    return null;
  }
}

export default async function AccountsPage() {
  let items: Account[] = [];
  try {
    const r = await apiFetch<{ items: Account[] }>('/api/v1/pulse/accounts');
    items = r.items;
  } catch {
    /* empty state below */
  }
  const [teams, myUserId] = await Promise.all([involvedTeams(), currentUserId()]);

  return (
    <div className="px-6 py-10 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">Accounts</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Balance snapshots anchor the projection. Reserves are earmarked money — in the bank,
            not yours to spend.
          </p>
        </div>
        <div className="shrink-0 pt-1">
          <AccountsActions accounts={items} teams={teams} myUserId={myUserId} />
        </div>
      </div>

      <AccountsList accounts={items} teams={teams} myUserId={myUserId} />
    </div>
  );
}
