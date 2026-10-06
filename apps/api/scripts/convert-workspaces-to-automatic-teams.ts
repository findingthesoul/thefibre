// Give every EXISTING workspace its two automatic teams.
//
//   cd apps/api
//   npx tsx --env-file=.env.staging scripts/convert-workspaces-to-automatic-teams.ts
//       DRY RUN. Prints, per workspace, exactly who goes into Admins and
//       Everyone and what app grants would change. Writes nothing.
//
//   … scripts/convert-workspaces-to-automatic-teams.ts --apply
//       Does it, and writes an undo file naming every row it created.
//
//   … scripts/convert-workspaces-to-automatic-teams.ts --undo <file>
//       Removes exactly those rows.
//
//   Production additionally needs --production, and is Sjoerd's call, as its
//   own operation, with the dry-run output in front of him first.
//
// New workspaces get these teams on their own — lib/automatic-teams.ts, called
// from every path that writes workspace_member. This is for the ones that
// existed before that shipped.
//
// ---------------------------------------------------------------------------
// Why this is TypeScript and not another .mjs script
// ---------------------------------------------------------------------------
// Because it calls `syncAutomaticTeams` — THE writer, the same function an
// invite and a role change call. A hand-rolled .mjs copy would have to repeat
// the slug rule, the descriptions, the admin role list and the reconcile, and
// the first of those to drift would produce workspaces subtly unlike the ones
// the product makes, in a one-shot conversion nobody re-runs. So the only
// thing written here is the PLAN and the undo; the mutation is the product's.
//
// ---------------------------------------------------------------------------
// It grants nothing, and that is the point
// ---------------------------------------------------------------------------
// Sjoerd chose, in docs/teams-two-automatic-teams.md, that Everyone starts
// EMPTY in existing workspaces: no team_app_grant rows, so the resolver has
// nothing to resolve and not one person's access changes on conversion day.
// The alternatives — seeding Everyone with the union of what members already
// hold, or with every app in the plan — both silently widen who can open what,
// in workspaces that are not ours.
//
// So the dry run's most important line is the one that should read zero: app
// grants changed. If it ever reads anything else, something has been put into
// Everyone that should not be there, and the run refuses.
//
// ---------------------------------------------------------------------------
// The conversion can REVOKE access, and that is what the second gate is for
// ---------------------------------------------------------------------------
// Not obvious, and the reason this script measures before it writes. Putting
// somebody into a team calls `syncTeam`, which calls `syncUsers`, which makes
// `app_membership` match what the grants say — and that means it DELETES any
// row owed to neither a direct tick (`is_direct = true`) nor a live team
// grant. Rows written before teams became the access layer can be exactly
// that: `is_direct` false or null, owed to nothing the resolver can see.
//
// So "nobody's access changes" is only true where no such row exists, and that
// is a measurement, not a property of this script. `revocations()` below finds
// them; --apply refuses while there are any. Clearing them is a decision about
// real people's access, which is Sjoerd's, not a flag's — so there is no
// --force to spend it on.

import { adminClient } from '../src/db.js';
import {
  driftingWorkspaces,
  syncAutomaticTeams,
  type AutomaticKind,
} from '../src/lib/automatic-teams.js';
import { effectiveGrants } from '../src/lib/team-grants.js';
import { writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';
const ADMIN_ROLES = ['admin', 'super_admin'];

const APPLY = process.argv.includes('--apply');
const ALLOW_PRODUCTION = process.argv.includes('--production');
const UNDO_FILE = process.argv[process.argv.indexOf('--undo') + 1];
const UNDOING = process.argv.includes('--undo');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ref = (() => {
  try {
    return new URL(url).hostname.split('.')[0];
  } catch {
    return url;
  }
})();

function target(): string {
  if (ref === STAGING_REF) return 'STAGING';
  if (ref === PRODUCTION_REF) return 'PRODUCTION';
  return 'an UNKNOWN project';
}

/** Say which database before doing anything, and refuse production unless it
 *  was asked for by name. A conversion is irreversible in the sense that
 *  matters — the teams cannot be deleted — so "which one am I on" is never
 *  allowed to be a guess. */
function checkTarget(): void {
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('REFUSED: no Supabase url/service key in the environment.');
    console.error('Run with: npx tsx --env-file=.env.staging scripts/convert-workspaces-to-automatic-teams.ts');
    process.exit(2);
  }
  console.log(`Project: ${ref} (${target()})`);
  if (ref !== STAGING_REF && ref !== PRODUCTION_REF) {
    console.error('REFUSED: this is neither the staging nor the production project. Nothing is touched.');
    process.exit(2);
  }
  if (ref === PRODUCTION_REF && !ALLOW_PRODUCTION) {
    console.error('REFUSED: that is production. Add --production if that is genuinely what you mean.');
    process.exit(2);
  }
}

type Plan = {
  workspace_id: string;
  name: string;
  slug: string | null;
  existing: Partial<Record<AutomaticKind, string>>;
  want: Record<AutomaticKind, { id: string; email: string | null }[]>;
  missing: Record<AutomaticKind, { id: string; email: string | null }[]>;
};

async function plan(): Promise<Plan[]> {
  const [{ data: workspaces, error: wErr }, { data: members, error: mErr }, { data: teams, error: tErr }, { data: teamMembers, error: tmErr }, { data: users, error: uErr }] =
    await Promise.all([
      adminClient.from('workspace').select('id, name, slug').order('created_at', { ascending: true }),
      adminClient.from('workspace_member').select('workspace_id, user_id, workspace_role'),
      adminClient.from('team').select('id, workspace_id, automatic').not('automatic', 'is', null),
      adminClient.from('team_member').select('team_id, user_id'),
      adminClient.from('user').select('id, email'),
    ]);
  for (const e of [wErr, mErr, tErr, tmErr, uErr]) if (e) throw new Error(e.message);

  const emailOf = new Map((users ?? []).map((u) => [u.id as string, (u.email as string) ?? null]));
  const teamFor = new Map<string, string>(); // `${ws}:${kind}` -> team id
  for (const t of teams ?? []) teamFor.set(`${t.workspace_id}:${t.automatic}`, t.id as string);
  const inTeam = new Map<string, Set<string>>();
  for (const tm of teamMembers ?? []) {
    const k = tm.team_id as string;
    if (!inTeam.has(k)) inTeam.set(k, new Set());
    inTeam.get(k)!.add(tm.user_id as string);
  }

  const out: Plan[] = [];
  for (const ws of workspaces ?? []) {
    const mine = (members ?? []).filter((m) => m.workspace_id === ws.id);
    // A workspace with no members needs no teams yet: the first invite makes
    // them. Converting it would create two empty teams nobody asked for.
    if (!mine.length) continue;

    const person = (m: { user_id: unknown }) => ({
      id: m.user_id as string,
      email: emailOf.get(m.user_id as string) ?? null,
    });
    const want: Plan['want'] = {
      everyone: mine.map(person),
      admins: mine.filter((m) => ADMIN_ROLES.includes(m.workspace_role as string)).map(person),
    };

    const existing: Plan['existing'] = {};
    const missing: Plan['missing'] = { admins: [], everyone: [] };
    for (const kind of ['admins', 'everyone'] as AutomaticKind[]) {
      const teamId = teamFor.get(`${ws.id}:${kind}`);
      if (teamId) existing[kind] = teamId;
      const have = teamId ? (inTeam.get(teamId) ?? new Set<string>()) : new Set<string>();
      missing[kind] = want[kind].filter((p) => !have.has(p.id));
    }

    const nothingToDo =
      existing.admins && existing.everyone && !missing.admins.length && !missing.everyone.length;
    if (!nothingToDo) out.push({ workspace_id: ws.id, name: ws.name as string, slug: ws.slug as string | null, existing, want, missing });
  }
  return out;
}

/** Grant rows hanging off any automatic team. Must be zero: that is what makes
 *  "nobody's access changes" a measurement rather than a promise. */
async function grantRowsOnAutomaticTeams(): Promise<number> {
  const { data: autos, error } = await adminClient.from('team').select('id').not('automatic', 'is', null);
  if (error) throw new Error(error.message);
  const ids = (autos ?? []).map((t) => t.id as string);
  if (!ids.length) return 0;
  const { count, error: gErr } = await adminClient
    .from('team_app_grant')
    .select('team_id', { count: 'exact', head: true })
    .in('team_id', ids);
  if (gErr) throw new Error(gErr.message);
  return count ?? 0;
}

/**
 * Memberships a sync would DELETE: a row on an app the resolver does not owe
 * this person, which `syncUsers` removes the moment anything re-resolves them.
 *
 * fibre-platform is excluded because `syncUsers` excludes it — it is granted
 * by the platform and never appears on the Members page.
 *
 * This reads every app_membership row and resolves every user, so it is the
 * slow part of the dry run. It is also the only part that could cost somebody
 * their access, so it runs every time, including on --apply.
 */
async function revocations(): Promise<{ user_id: string; app: string; is_direct: unknown }[]> {
  const [{ data: ms, error }, { data: apps, error: aErr }] = await Promise.all([
    adminClient.from('app_membership').select('user_id, app_id, is_direct'),
    adminClient.from('app').select('id, slug'),
  ]);
  if (error) throw new Error(error.message);
  if (aErr) throw new Error(aErr.message);

  const slugOf = new Map((apps ?? []).map((a) => [a.id as string, a.slug as string]));
  const out: { user_id: string; app: string; is_direct: unknown }[] = [];
  for (const userId of [...new Set((ms ?? []).map((m) => m.user_id as string))]) {
    const owed = new Set((await effectiveGrants(userId)).map((g) => g.app_id));
    for (const m of ms ?? []) {
      if (m.user_id !== userId) continue;
      const app = slugOf.get(m.app_id as string) ?? (m.app_id as string);
      if (app === 'fibre-platform' || owed.has(m.app_id)) continue;
      out.push({ user_id: userId, app, is_direct: m.is_direct });
    }
  }
  return out;
}

async function undo(file: string): Promise<void> {
  const saved = JSON.parse(readFileSync(file, 'utf8')) as {
    project_ref: string;
    memberships: { team_id: string; user_id: string }[];
    teams: { workspace_id: string; kind: string; team_id: string }[];
  };
  if (saved.project_ref !== ref) {
    console.error(`REFUSED: that undo file was written against ${saved.project_ref}; this is ${ref}.`);
    process.exit(2);
  }
  console.log(`Undoing ${saved.memberships.length} team membership(s).`);
  let failed = 0;
  for (const m of saved.memberships) {
    const { error } = await adminClient
      .from('team_member')
      .delete()
      .eq('team_id', m.team_id)
      .eq('user_id', m.user_id);
    if (error) {
      failed += 1;
      console.error(`  ${m.team_id}/${m.user_id}: ${error.message}`);
    }
  }
  console.log(failed ? `${failed} could not be removed.` : 'Memberships removed.');
  if (saved.teams.length) {
    console.log('');
    console.log(`${saved.teams.length} team(s) were created and are NOT removed: the database refuses to`);
    console.log('delete an automatic team (team_automatic_no_delete). They are empty now and grant');
    console.log('nothing, so they change nobody\'s access — and the next role change recreates them');
    console.log('anyway. Nothing here needs them gone.');
  }
}

async function main(): Promise<void> {
  checkTarget();
  if (UNDOING) {
    if (!UNDO_FILE) {
      console.error('REFUSED: --undo needs the file written by --apply.');
      process.exit(2);
    }
    return undo(UNDO_FILE);
  }

  const grants = await grantRowsOnAutomaticTeams();
  const wouldRevoke = await revocations();
  const todo = await plan();

  console.log(APPLY ? 'APPLY RUN.\n' : 'DRY RUN — nothing is written.\n');
  for (const p of todo) {
    console.log(`  ${p.name} (${p.slug ?? p.workspace_id})`);
    for (const kind of ['admins', 'everyone'] as AutomaticKind[]) {
      if (!p.existing[kind]) console.log(`    create the ${kind === 'admins' ? 'Admins' : 'Everyone'} team`);
      const add = p.missing[kind];
      if (!add.length) continue;
      console.log(`    ${kind === 'admins' ? 'Admins' : 'Everyone'} + ${add.length}: ${add.map((a) => a.email ?? a.id).join(', ')}`);
    }
  }
  if (!todo.length) console.log('  (nothing to do — every workspace already has both teams, with the right members)');

  const teamsToCreate = todo.reduce(
    (n, p) => n + (p.existing.admins ? 0 : 1) + (p.existing.everyone ? 0 : 1),
    0,
  );
  const membershipsToAdd = todo.reduce((n, p) => n + p.missing.admins.length + p.missing.everyone.length, 0);

  console.log('');
  console.log(`workspaces to convert   : ${todo.length}`);
  console.log(`teams to create         : ${teamsToCreate}`);
  console.log(`memberships to add      : ${membershipsToAdd}`);
  console.log(`app grants changed      : 0   (grant rows on automatic teams: ${grants})`);
  console.log(`access a sync would TAKE: ${wouldRevoke.length}`);
  for (const r of wouldRevoke) {
    console.log(`    ${r.user_id} would lose ${r.app} (is_direct=${String(r.is_direct)})`);
  }

  if (grants > 0) {
    console.log('');
    console.log('REFUSED: an automatic team already carries app grants. Everyone is meant to start');
    console.log('empty in existing workspaces, so somebody has added grants and this conversion');
    console.log('would change who can open what. Understand that first.');
    process.exit(1);
  }

  if (wouldRevoke.length) {
    console.log('');
    console.log('REFUSED: the rows above are owed to neither a direct tick nor a live team grant,');
    console.log('so re-resolving those people DELETES them — they lose those apps. That is a');
    console.log('decision about real people\'s access, not something this script may take: give');
    console.log('each row a direct tick or a team grant first, or decide it should go.');
    process.exit(1);
  }

  if (!APPLY) {
    console.log('');
    console.log('Re-run with --apply to do it.');
    return;
  }

  // The product's own writer, per workspace. It creates what is missing and
  // reconciles membership; everything above was only the account of what it
  // will find to do.
  const undoPlan = {
    created_at: new Date().toISOString(),
    project_ref: ref,
    teams: [] as { workspace_id: string; kind: string; team_id: string }[],
    memberships: [] as { team_id: string; user_id: string }[],
  };

  for (const p of todo) {
    await syncAutomaticTeams(p.workspace_id);
    const { data: made } = await adminClient
      .from('team')
      .select('id, automatic')
      .eq('workspace_id', p.workspace_id)
      .not('automatic', 'is', null);
    for (const t of made ?? []) {
      const kind = t.automatic as AutomaticKind;
      if (!p.existing[kind]) undoPlan.teams.push({ workspace_id: p.workspace_id, kind, team_id: t.id as string });
      for (const person of p.missing[kind]) {
        undoPlan.memberships.push({ team_id: t.id as string, user_id: person.id });
      }
    }
  }

  const file = join(tmpdir(), `undo-automatic-teams-${ref}-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(undoPlan, null, 2));
  console.log('');
  console.log(`Done. Undo file: ${file}`);
  console.log(`  node_modules/.bin/tsx --env-file=<the same env file> scripts/convert-workspaces-to-automatic-teams.ts --undo ${file}`);

  // The check that the conversion actually landed: the same drift report the
  // product uses, which is empty when every automatic team matches its
  // workspace. Any remaining row names a workspace to look at by hand.
  const drift = await driftingWorkspaces();
  console.log('');
  if (!drift.length) console.log('Drift check: clean — every automatic team matches its workspace.');
  else {
    console.log(`Drift check: ${drift.length} row(s) still off:`);
    for (const d of drift) console.log(`  ${d.workspace_id} ${d.kind} missing=${d.missing_members} extra=${d.extra_members}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
