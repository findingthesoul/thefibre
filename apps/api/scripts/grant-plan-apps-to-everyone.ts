// Give the Everyone team the apps its workspace runs.
//
//   cd apps/api
//   npx tsx --env-file=.env.staging scripts/grant-plan-apps-to-everyone.ts
//       DRY RUN. Prints, per workspace, exactly which PERSON gains which APP,
//       with external members listed separately. Writes nothing.
//
//   … --apply                    does it, and writes an undo file
//   … --undo <file>              removes exactly the grants it created
//   … --production               required on production, on top of --apply
//
// Sjoerd, 2026-10-08: "by default should have access to the apps that are
// part of the plan. Not set it manually. Only change it manually."
//
// ---------------------------------------------------------------------------
// This one WIDENS ACCESS. That is the whole point, and the whole risk.
// ---------------------------------------------------------------------------
// The teams conversion that preceded it was careful to change nobody's access
// — Everyone was created empty precisely so conversion day moved nothing.
// This is the opposite act, done deliberately: every member of a workspace
// gains every app that workspace runs.
//
// So the dry run does not print counts. It prints NAMES: this person gains
// this app. And it separates EXTERNAL members, because "everyone in the
// workspace" quietly includes people from other organisations, and handing a
// partner access to an internal app is a different decision from handing it
// to a colleague.

import { adminClient } from '../src/db.js';
import { syncTeam } from '../src/lib/team-grants.js';
import { writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';

/** Granted by the platform itself, never on the Members page, and excluded by
 *  the resolver — so it must not be a team grant either. */
const NEVER_GRANT = ['fibre-platform'];

/**
 * Is this app a thing a person can actually open?
 *
 * Found by reading the first dry run instead of its summary: "The Thread"
 * workspace runs `fibre-learn`, which is registered in the catalogue with
 * NOTHING BUILT — approved, never released, not even beta. Granting it to
 * Everyone would put a tile in six people's launchers for an app that does
 * not exist.
 *
 * The test is NOT "released": `fibre-models` and `fibre-sales` are both live,
 * useful apps that are deliberately beta (`beta_at` set, `released_at` never
 * — Sjoerd: "activate it in beta only"). A released-only filter would strip
 * two real apps out of the baseline. So: approved, and shipped in one sense
 * or the other.
 */
function isUsable(app: { status?: string | null; released_at?: string | null; beta_at?: string | null }): boolean {
  return app.status === 'approved' && !!(app.released_at || app.beta_at);
}

const APPLY = process.argv.includes('--apply');
const ALLOW_PRODUCTION = process.argv.includes('--production');
const UNDOING = process.argv.includes('--undo');
const UNDO_FILE = process.argv[process.argv.indexOf('--undo') + 1];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ref = (() => {
  try {
    return new URL(url).hostname.split('.')[0];
  } catch {
    return url;
  }
})();

function checkTarget(): void {
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('REFUSED: no Supabase url/service key in the environment.');
    console.error('Run with: npx tsx --env-file=.env.staging scripts/grant-plan-apps-to-everyone.ts');
    process.exit(2);
  }
  const name = ref === STAGING_REF ? 'STAGING' : ref === PRODUCTION_REF ? 'PRODUCTION' : 'an UNKNOWN project';
  console.log(`Project: ${ref} (${name})`);
  if (ref !== STAGING_REF && ref !== PRODUCTION_REF) {
    console.error('REFUSED: neither the staging nor the production project. Nothing is touched.');
    process.exit(2);
  }
  if (ref === PRODUCTION_REF && !ALLOW_PRODUCTION) {
    console.error('REFUSED: that is production. Add --production if that is genuinely what you mean.');
    process.exit(2);
  }
}

type Gain = { email: string; external: boolean; app: string };
type Plan = {
  workspaceId: string;
  name: string;
  slug: string | null;
  everyoneTeamId: string;
  appsToGrant: { id: string; slug: string }[];
  gains: Gain[];
};

async function plan(): Promise<Plan[]> {
  const [
    { data: workspaces, error: wErr },
    { data: teams, error: tErr },
    { data: wsApps, error: aErr },
    { data: apps, error: appErr },
    { data: members, error: mErr },
    { data: users, error: uErr },
    { data: held, error: hErr },
    { data: grants, error: gErr },
  ] = await Promise.all([
    adminClient.from('workspace').select('id, name, slug'),
    adminClient.from('team').select('id, workspace_id').eq('automatic', 'everyone'),
    // ACTIVE is `deactivated_at is null`. There is no `is_active` column here
    // — a first draft of this script asked for one, got an error it did not
    // read, and reported that no workspace runs any app at all.
    adminClient.from('workspace_app').select('workspace_id, app_id').is('deactivated_at', null),
    adminClient.from('app').select('id, slug, status, released_at, beta_at'),
    adminClient.from('workspace_member').select('workspace_id, user_id, relationship_type'),
    adminClient.from('user').select('id, email'),
    adminClient.from('app_membership').select('user_id, app_id'),
    adminClient.from('team_app_grant').select('team_id, app_id'),
  ]);
  for (const e of [wErr, tErr, aErr, appErr, mErr, uErr, hErr, gErr]) if (e) throw new Error(e.message);

  const slugOf = new Map((apps ?? []).map((a) => [a.id as string, a.slug as string]));
  const usable = new Set((apps ?? []).filter(isUsable).map((a) => a.id as string));
  const emailOf = new Map((users ?? []).map((u) => [u.id as string, (u.email as string) ?? u.id]));
  const everyoneOf = new Map((teams ?? []).map((t) => [t.workspace_id as string, t.id as string]));
  const holds = new Set((held ?? []).map((h) => `${h.user_id}:${h.app_id}`));
  const granted = new Set((grants ?? []).map((g) => `${g.team_id}:${g.app_id}`));

  const out: Plan[] = [];
  for (const ws of workspaces ?? []) {
    const everyoneTeamId = everyoneOf.get(ws.id as string);
    // No Everyone team means the conversion has not run here. Skipped rather
    // than created: this script grants, it does not convert.
    if (!everyoneTeamId) continue;

    const active = (wsApps ?? [])
      .filter((a) => a.workspace_id === ws.id)
      .map((a) => ({ id: a.app_id as string, slug: slugOf.get(a.app_id as string) ?? '' }))
      .filter((a) => a.slug && !NEVER_GRANT.includes(a.slug) && usable.has(a.id));
    const appsToGrant = active.filter((a) => !granted.has(`${everyoneTeamId}:${a.id}`));
    if (!appsToGrant.length) continue;

    const mine = (members ?? []).filter((m) => m.workspace_id === ws.id);
    const gains: Gain[] = [];
    for (const m of mine) {
      for (const a of appsToGrant) {
        if (holds.has(`${m.user_id}:${a.id}`)) continue;
        gains.push({
          email: emailOf.get(m.user_id as string) ?? (m.user_id as string),
          external: m.relationship_type === 'external',
          app: a.slug,
        });
      }
    }
    out.push({
      workspaceId: ws.id as string,
      name: ws.name as string,
      slug: ws.slug as string | null,
      everyoneTeamId,
      appsToGrant,
      gains,
    });
  }
  return out;
}

async function undo(file: string): Promise<void> {
  const saved = JSON.parse(readFileSync(file, 'utf8')) as {
    project_ref: string;
    grants: { team_id: string; app_id: string }[];
  };
  if (saved.project_ref !== ref) {
    console.error(`REFUSED: that undo file was written against ${saved.project_ref}; this is ${ref}.`);
    process.exit(2);
  }
  console.log(`Removing ${saved.grants.length} team grant(s), then re-resolving everyone they touched.`);
  const teams = new Set<string>();
  for (const g of saved.grants) {
    const { error } = await adminClient
      .from('team_app_grant')
      .delete()
      .eq('team_id', g.team_id)
      .eq('app_id', g.app_id);
    if (error) console.error(`  ${g.team_id}/${g.app_id}: ${error.message}`);
    else teams.add(g.team_id);
  }
  // The grant rows are only half of it: app_membership is the enforcement
  // layer, and the resolver is what takes the derived rows away again. A
  // direct tick somebody also has is untouched, which is correct.
  for (const t of teams) await syncTeam(t);
  console.log('Done. Access taken back to what it was, except where somebody also holds the app directly.');
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

  const todo = await plan();
  console.log(APPLY ? 'APPLY RUN.\n' : 'DRY RUN — nothing is written.\n');

  let grantRows = 0;
  let internalGains = 0;
  let externalGains = 0;

  for (const p of todo) {
    console.log(`  ${p.name} (${p.slug ?? p.workspaceId})`);
    console.log(`    Everyone gains: ${p.appsToGrant.map((a) => a.slug).join(', ')}`);
    grantRows += p.appsToGrant.length;

    const internal = p.gains.filter((g) => !g.external);
    const external = p.gains.filter((g) => g.external);
    internalGains += internal.length;
    externalGains += external.length;

    if (!p.gains.length) {
      console.log('    nobody gains anything — every member already holds these apps');
      continue;
    }
    const byPerson = (list: Gain[]) => {
      const m = new Map<string, string[]>();
      for (const g of list) m.set(g.email, [...(m.get(g.email) ?? []), g.app]);
      return [...m.entries()];
    };
    for (const [email, appsGained] of byPerson(internal)) {
      console.log(`      ${email} gains ${appsGained.join(', ')}`);
    }
    // Separated on purpose: giving a partner from another organisation access
    // to an internal app is a different decision from giving it to a
    // colleague, and it should not be buried in a list.
    if (external.length) {
      console.log('    EXTERNAL members (people from outside this organisation):');
      for (const [email, appsGained] of byPerson(external)) {
        console.log(`      ${email} gains ${appsGained.join(', ')}`);
      }
    }
  }

  if (!todo.length) console.log('  (nothing to do — every Everyone team already grants what its workspace runs)');

  console.log('');
  console.log(`workspaces affected     : ${todo.length}`);
  console.log(`app grants to create    : ${grantRows}`);
  console.log(`people gaining access   : ${internalGains} internal, ${externalGains} EXTERNAL`);

  if (!APPLY) {
    console.log('');
    console.log('Re-run with --apply to do it. Read the names above first — this widens access.');
    return;
  }

  const undoPlan = {
    created_at: new Date().toISOString(),
    project_ref: ref,
    grants: [] as { team_id: string; app_id: string }[],
  };
  for (const p of todo) {
    for (const a of p.appsToGrant) {
      const { error } = await adminClient
        .from('team_app_grant')
        .upsert(
          { team_id: p.everyoneTeamId, app_id: a.id, lead_is_app_admin: false },
          { onConflict: 'team_id,app_id' },
        );
      if (error) {
        console.error(`  ${p.name}: ${a.slug}: ${error.message}`);
        continue;
      }
      undoPlan.grants.push({ team_id: p.everyoneTeamId, app_id: a.id });
    }
    // Materialise: app_membership is what the apps actually check.
    await syncTeam(p.everyoneTeamId);
  }

  const file = join(tmpdir(), `undo-everyone-grants-${ref}-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(undoPlan, null, 2));
  console.log('');
  console.log(`Done. Undo file: ${file}`);
  console.log(`  npx tsx --env-file=<same env file> scripts/grant-plan-apps-to-everyone.ts --undo ${file}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
