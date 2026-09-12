// Teams as access groups — resolving team membership into app grants.
//
// The rule (docs/teams-as-access-groups-proposal.md): a user's effective apps
// are the UNION of every app conferred by every active team they are an
// active member of, plus the direct grants an admin ticked on their member
// row. Union, never intersection — nobody loses an app by joining a team.
//
// This module is the single writer of app_membership for grant changes. Both
// the Members page and the Teams page call it, so there is never a second
// opinion about who may open what. app_membership stays the enforcement
// point; team_app_grant is only the intent.
//
// NOT plan-gated. Editing team grants requires Pro (the routes check that),
// but RESOLUTION always runs: a workspace that downgrades keeps the access
// its people already had (Sjoerd, 2026-09-11). Revoking half a workspace's
// app access because a card failed is the wrong response to a billing event.

import { adminClient } from '../db.js';

export type EffectiveGrant = {
  app_id: string;
  role: 'member' | 'admin';
  /** An admin ticked this on the Members page. */
  direct: boolean;
  /** Team names conferring it — what the Members page shows as "via …". */
  via: string[];
};

/**
 * The merge itself, as a pure function — the part worth testing.
 *
 * `direct` is what an admin ticked. `teams` is one entry per live team the
 * user is an active member of, carrying the apps that team confers.
 */
export function mergeGrants(
  direct: { app_id: string; role: string }[],
  teams: { name: string; lead: boolean; apps: { app_id: string; lead_is_app_admin: boolean }[] }[],
): EffectiveGrant[] {
  const byApp = new Map<string, EffectiveGrant>();

  for (const row of direct) {
    byApp.set(row.app_id, {
      app_id: row.app_id,
      role: row.role === 'admin' ? 'admin' : 'member',
      direct: true,
      via: [],
    });
  }

  for (const team of teams) {
    for (const g of team.apps) {
      const asAdmin = team.lead && g.lead_is_app_admin;
      const existing = byApp.get(g.app_id);
      if (existing) {
        // Union: the strongest role wins, and every origin is remembered.
        if (asAdmin) existing.role = 'admin';
        existing.via.push(team.name);
      } else {
        byApp.set(g.app_id, {
          app_id: g.app_id,
          role: asAdmin ? 'admin' : 'member',
          direct: false,
          via: [team.name],
        });
      }
    }
  }

  return [...byApp.values()];
}

/**
 * What a user's grants SHOULD be, without writing anything.
 *
 * An inactive team confers nothing: `is_active` is how a workspace retires a
 * team without deleting its history, and a retired team still handing out
 * apps would be a quiet way to keep access alive. A pending team invitation
 * confers nothing either — status must be 'active'.
 */
export async function effectiveGrants(userId: string): Promise<EffectiveGrant[]> {
  // 1. Direct grants — the rows an admin ticked on the Members page.
  const { data: direct } = await adminClient
    .from('app_membership')
    .select('app_id, role, is_direct')
    .eq('user_id', userId)
    .eq('is_direct', true);

  // 2. Teams the user actually belongs to.
  const { data: memberships } = await adminClient
    .from('team_member')
    .select('team_id, role, status, team:team_id (id, name, is_active)')
    .eq('user_id', userId)
    .eq('status', 'active');

  const liveTeams = (memberships ?? [])
    .map((m) => {
      const team = Array.isArray(m.team) ? m.team[0] : m.team;
      return team && team.is_active
        ? { id: team.id as string, name: team.name as string, lead: m.role === 'lead' }
        : null;
    })
    .filter((t): t is { id: string; name: string; lead: boolean } => !!t);

  let grants: { team_id: string; app_id: string; lead_is_app_admin: boolean }[] = [];
  if (liveTeams.length) {
    const { data } = await adminClient
      .from('team_app_grant')
      .select('team_id, app_id, lead_is_app_admin')
      .in(
        'team_id',
        liveTeams.map((t) => t.id),
      );
    grants = data ?? [];
  }

  return mergeGrants(
    (direct ?? []).map((d) => ({ app_id: d.app_id, role: d.role })),
    liveTeams.map((t) => ({
      name: t.name,
      lead: t.lead,
      apps: grants
        .filter((g) => g.team_id === t.id)
        .map((g) => ({ app_id: g.app_id, lead_is_app_admin: g.lead_is_app_admin })),
    })),
  );
}

/**
 * Make app_membership match what the grants say, for these users.
 *
 * Updates only what changed rather than re-upserting whole rows, so a column
 * added to app_membership later is not clobbered. Removes rows owed to
 * neither a direct tick nor a live team.
 */
export async function syncUsers(userIds: string[]): Promise<void> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;

  // fibre-platform is granted by the platform itself and never appears on the
  // Members page, so it is not ours to remove. Resolved once, not per row.
  const { data: platformApp } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', 'fibre-platform')
    .maybeSingle();
  const platformAppId = platformApp?.id ?? null;

  for (const userId of unique) {
    const wanted = await effectiveGrants(userId);
    const wantedByApp = new Map(wanted.map((g) => [g.app_id, g]));

    const { data: current } = await adminClient
      .from('app_membership')
      .select('app_id, role, is_direct')
      .eq('user_id', userId);

    for (const row of current ?? []) {
      if (row.app_id === platformAppId) continue;
      const want = wantedByApp.get(row.app_id);
      if (!want) {
        await adminClient
          .from('app_membership')
          .delete()
          .eq('user_id', userId)
          .eq('app_id', row.app_id);
        continue;
      }
      if (row.role !== want.role || row.is_direct !== want.direct) {
        await adminClient
          .from('app_membership')
          .update({ role: want.role, is_direct: want.direct })
          .eq('user_id', userId)
          .eq('app_id', row.app_id);
      }
    }

    const have = new Set((current ?? []).map((r) => r.app_id));
    for (const g of wanted) {
      if (have.has(g.app_id)) continue;
      await adminClient
        .from('app_membership')
        .upsert(
          { user_id: userId, app_id: g.app_id, role: g.role, is_direct: g.direct },
          { onConflict: 'user_id,app_id' },
        );
    }
  }
}

/** Re-resolve everyone in a team — after its grants or its roster changed. */
export async function syncTeam(teamId: string): Promise<void> {
  const { data: members } = await adminClient
    .from('team_member')
    .select('user_id')
    .eq('team_id', teamId);
  await syncUsers((members ?? []).map((m) => m.user_id));
}

/**
 * Which apps each user holds through a team, and through which teams — the
 * Members page's "via Finance" line. Read-only; touches no grant rows.
 */
export async function inheritedByUser(
  userIds: string[],
): Promise<Map<string, { app_id: string; via: string[] }[]>> {
  const out = new Map<string, { app_id: string; via: string[] }[]>();
  for (const userId of [...new Set(userIds.filter(Boolean))]) {
    const grants = await effectiveGrants(userId);
    out.set(
      userId,
      grants.filter((g) => g.via.length).map((g) => ({ app_id: g.app_id, via: g.via })),
    );
  }
  return out;
}
