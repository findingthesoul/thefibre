// The two teams every workspace has without anybody creating them.
//
// Approved by Sjoerd 2026-10-06 from docs/teams-two-automatic-teams.md:
//
//   ADMINS   — its members are exactly the workspace's admins. Nobody
//              maintains it; this file keeps it true.
//   EVERYONE — the default. Every member is in it, and what it grants is the
//              baseline a newcomer gets. Nobody can be removed from it: the
//              moment it has exceptions, "what does a new person get?" stops
//              having an answer. A person who needs less than the baseline is
//              a sign the baseline is wrong; a person who needs MORE gets a
//              direct app tick, which already exists and is marked is_direct.
//
// Enforcement does not move. `workspace_app` still says what a workspace runs
// and `app_membership` still says what a person may open; lib/team-grants.ts
// resolves teams into those rows. This file only decides who is in which team.
//
// ---------------------------------------------------------------------------
// Slugs are suffixed with the workspace, and that is not cosmetic
// ---------------------------------------------------------------------------
// `public_root_slug.slug` is a PRIMARY KEY shared by workspaces, teams and
// organisers — one global namespace — and a team claims its slug even when
// unpublished (deliberately; Sjoerd, 2026-09-11: "published or not, it claims
// that slug… this way we prevent future collisions"). So a team literally
// called `everyone` can exist exactly once across the whole platform, and the
// second workspace to try would fail. Suffixing makes them unique without
// touching the trigger every team write goes through.
//
// They are created unpublished: an internal access group has no public page.

import { adminClient } from '../db.js';
import { syncTeam } from './team-grants.js';

export type AutomaticKind = 'admins' | 'everyone';

const NAMES: Record<AutomaticKind, string> = {
  admins: 'Admins',
  everyone: 'Everyone',
};

const DESCRIPTIONS: Record<AutomaticKind, string> = {
  admins:
    'Everyone who administers this workspace. Membership follows the workspace role — change it on the Members page, not here.',
  everyone:
    'Everybody in this workspace. New members join automatically, and the apps granted here are what a newcomer gets.',
};

/** Roles that make somebody an admin of the workspace. The same pair the API
 *  means everywhere else (isWorkspaceAdmin, canManageWorkspace). */
const ADMIN_ROLES = ['admin', 'super_admin'];

/** `everyone-soul-com`. Trimmed so a long workspace slug cannot overflow the
 *  column, and suffixed with the workspace's own slug so it reads as itself in
 *  any admin screen. Falls back to the id when a workspace somehow has no
 *  slug — unique either way, which is the part that must not fail. */
function slugFor(kind: AutomaticKind, workspace: { id: string; slug: string | null }): string {
  const base = (workspace.slug ?? workspace.id).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `${kind}-${base}`.slice(0, 60).replace(/-+$/, '');
}

/**
 * Make sure both teams exist. Idempotent, and safe to call on every path that
 * could be the first to notice a workspace has none — creation, an invite, the
 * conversion script.
 *
 * Returns their ids. Never throws for a team that already exists: the unique
 * index (workspace_id, automatic) is what actually prevents duplicates, and a
 * conflict here means somebody else just created it, which is success.
 */
export async function ensureAutomaticTeams(
  workspaceId: string,
): Promise<Record<AutomaticKind, string | null>> {
  const out: Record<AutomaticKind, string | null> = { admins: null, everyone: null };

  const { data: ws } = await adminClient
    .from('workspace')
    .select('id, slug')
    .eq('id', workspaceId)
    .maybeSingle();
  if (!ws) return out;

  const { data: existing } = await adminClient
    .from('team')
    .select('id, automatic')
    .eq('workspace_id', workspaceId)
    .not('automatic', 'is', null);
  for (const t of existing ?? []) {
    out[t.automatic as AutomaticKind] = t.id as string;
  }

  for (const kind of ['admins', 'everyone'] as AutomaticKind[]) {
    if (out[kind]) continue;
    const { data, error } = await adminClient
      .from('team')
      .insert({
        workspace_id: workspaceId,
        automatic: kind,
        name: NAMES[kind],
        description: DESCRIPTIONS[kind],
        slug: slugFor(kind, ws as { id: string; slug: string | null }),
        is_published: false,
        is_active: true,
      })
      .select('id')
      .maybeSingle();
    if (error) {
      // 23505 = somebody else created it between our read and our write. That
      // is the unique index doing its job, not a failure.
      if (error.code !== '23505') {
        console.error('[automatic-teams] could not create', kind, workspaceId, error.message);
        continue;
      }
      const { data: found } = await adminClient
        .from('team')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('automatic', kind)
        .maybeSingle();
      out[kind] = (found?.id as string) ?? null;
      continue;
    }
    out[kind] = (data?.id as string) ?? null;
  }
  return out;
}

/**
 * Make both teams' membership true: Admins holds exactly the workspace's
 * admins, Everyone holds every member.
 *
 * ONE writer, called from every path that changes a workspace role or adds a
 * member. The alternative — each route maintaining it — is how somebody keeps
 * admin-level app access after being demoted, silently, because one path was
 * missed. `driftingWorkspaces` below exists because "every path was found" is
 * a claim, not a fact.
 */
export async function syncAutomaticTeams(workspaceId: string): Promise<void> {
  try {
    const teams = await ensureAutomaticTeams(workspaceId);

    const { data: members, error } = await adminClient
      .from('workspace_member')
      .select('user_id, workspace_role')
      .eq('workspace_id', workspaceId);
    if (error) throw new Error(error.message);

    const all = (members ?? []).map((m) => m.user_id as string);
    const admins = (members ?? [])
      .filter((m) => ADMIN_ROLES.includes(m.workspace_role as string))
      .map((m) => m.user_id as string);

    await reconcile(teams.everyone, all);
    await reconcile(teams.admins, admins);

    // Let the grant resolver write the app_membership rows that follow.
    for (const id of [teams.everyone, teams.admins]) {
      if (id) await syncTeam(id);
    }
  } catch (e) {
    // Never fatal to the caller: a role change or an invite must not fail
    // because a team could not be reconciled. It is logged, and the drift
    // check finds what was missed.
    console.error('[automatic-teams] sync failed', workspaceId, e);
  }
}

/** Make this team's membership exactly `userIds` — add what is missing,
 *  remove what no longer belongs. */
async function reconcile(teamId: string | null, userIds: string[]): Promise<void> {
  if (!teamId) return;
  const { data: current, error } = await adminClient
    .from('team_member')
    .select('user_id')
    .eq('team_id', teamId);
  if (error) throw new Error(`team_member read: ${error.message}`);

  const have = new Set((current ?? []).map((m) => m.user_id as string));
  const want = new Set(userIds);

  const toAdd = [...want].filter((u) => !have.has(u));
  const toRemove = [...have].filter((u) => !want.has(u));

  if (toAdd.length) {
    const { error: aErr } = await adminClient.from('team_member').upsert(
      // 'member', not 'lead': lead means app-admin through team_app_grant, and
      // being a workspace admin is already carried by the Admins team's own
      // grants. Conflating them would make every admin an app-admin of
      // everything Everyone grants.
      toAdd.map((user_id) => ({ team_id: teamId, user_id, role: 'member', status: 'active' })),
      { onConflict: 'team_id,user_id' },
    );
    if (aErr) throw new Error(`team_member add: ${aErr.message}`);
  }
  if (toRemove.length) {
    const { error: rErr } = await adminClient
      .from('team_member')
      .delete()
      .eq('team_id', teamId)
      .in('user_id', toRemove);
    if (rErr) throw new Error(`team_member remove: ${rErr.message}`);
  }
}

export type Drift = {
  workspace_id: string;
  kind: AutomaticKind | 'missing';
  missing_members: number;
  extra_members: number;
};

/**
 * Where the teams have stopped matching the workspace.
 *
 * This exists because the sync above is only as good as the list of places
 * that call it, and that list is a guess until something checks. A path that
 * changes a workspace role without calling `syncAutomaticTeams` leaves
 * somebody holding admin-level access after a demotion — silently, which is
 * the whole problem with it.
 *
 * Read-only. Reports; never repairs. Repairing on read would hide how often
 * this happens, which is the number worth knowing.
 */
export async function driftingWorkspaces(): Promise<Drift[]> {
  const out: Drift[] = [];

  const { data: members, error: mErr } = await adminClient
    .from('workspace_member')
    .select('workspace_id, user_id, workspace_role');
  if (mErr) throw new Error(`drift (members): ${mErr.message}`);

  const { data: teams, error: tErr } = await adminClient
    .from('team')
    .select('id, workspace_id, automatic')
    .not('automatic', 'is', null);
  if (tErr) throw new Error(`drift (teams): ${tErr.message}`);

  const { data: teamMembers, error: tmErr } = await adminClient
    .from('team_member')
    .select('team_id, user_id');
  if (tmErr) throw new Error(`drift (team members): ${tmErr.message}`);

  const byTeam = new Map<string, Set<string>>();
  for (const tm of teamMembers ?? []) {
    const k = tm.team_id as string;
    if (!byTeam.has(k)) byTeam.set(k, new Set());
    byTeam.get(k)!.add(tm.user_id as string);
  }

  const workspaces = new Set((members ?? []).map((m) => m.workspace_id as string));
  for (const ws of workspaces) {
    const mine = (members ?? []).filter((m) => m.workspace_id === ws);
    const want: Record<AutomaticKind, Set<string>> = {
      everyone: new Set(mine.map((m) => m.user_id as string)),
      admins: new Set(
        mine
          .filter((m) => ADMIN_ROLES.includes(m.workspace_role as string))
          .map((m) => m.user_id as string),
      ),
    };

    for (const kind of ['admins', 'everyone'] as AutomaticKind[]) {
      const team = (teams ?? []).find((t) => t.workspace_id === ws && t.automatic === kind);
      if (!team) {
        out.push({ workspace_id: ws, kind: 'missing', missing_members: want[kind].size, extra_members: 0 });
        continue;
      }
      const have = byTeam.get(team.id as string) ?? new Set<string>();
      const missing = [...want[kind]].filter((u) => !have.has(u)).length;
      const extra = [...have].filter((u) => !want[kind].has(u)).length;
      if (missing || extra) {
        out.push({ workspace_id: ws, kind, missing_members: missing, extra_members: extra });
      }
    }
  }
  return out;
}
