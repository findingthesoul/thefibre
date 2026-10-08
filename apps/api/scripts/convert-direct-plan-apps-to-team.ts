// Meet and Thread, held through Everyone instead of per person.
//
//   cd apps/api
//   npx tsx --env-file=.env.staging scripts/convert-direct-plan-apps-to-team.ts
//       DRY RUN. Names every person and app whose direct row would become a
//       team-derived one, and every row left alone with the reason. Writes
//       nothing.
//
//   … --apply                 does it, and writes an undo file
//   … --undo <file>           puts every converted row back to direct
//   … --production            required on production, on top of --apply
//
// Sjoerd, 2026-10-08: *"meet thread via everyone"*.
//
// ---------------------------------------------------------------------------
// This takes NOTHING away. That is the acceptance line, and it is arithmetic.
// ---------------------------------------------------------------------------
// Every person keeps exactly the apps they had; what changes is WHY they have
// them — a direct tick becomes a grant owed to the Everyone team. The script
// records each person's app set before and after and refuses to finish if any
// of them differs. "access taken: 0" is measured, not hoped for.
//
// What it buys: removing Thread from Everyone now actually removes it,
// because nothing is left underneath holding it up. Before this, every member
// had a direct row that `lib/plan-apps.ts` re-created on every sign-in, so
// the control did nothing and said nothing.
//
// ---------------------------------------------------------------------------
// Which rows, and why not the others — the rule, stated rather than guessed
// ---------------------------------------------------------------------------
// There is no provenance column on `app_membership`: a row written by
// ensurePlanApps and a row an admin ticked are the same row. So the rule is
// made of things that ARE knowable, and everything outside it is left alone
// and printed:
//
//   THE APP is Meet or Thread. Those two are what ensurePlanApps granted to
//   everybody; no other app was ever handed out automatically.
//
//   THE PERSON is in Everyone AND Everyone grants that app. Without both, the
//   resolver would not owe them the app after the flip and `syncUsers` would
//   DELETE it — which is how a conversion silently takes access away.
//
//   ROLE IS 'member'. ensurePlanApps only ever wrote 'member'. A role='admin'
//   row was given by a person and carries app-admin rights the team grant
//   does not confer, so converting it would quietly demote them.
//
// Left alone by that rule, and named in the output: app admins, anyone not in
// Everyone (participants hold no seat; externals may be excluded from the
// team), and every app that is not Meet or Thread.

import { adminClient } from '../src/db.js';
import { syncUsers } from '../src/lib/team-grants.js';
import { writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';
const PLAN_APPS = ['fibre-meet', 'the-thread'];

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
    process.exit(2);
  }
  const name = ref === STAGING_REF ? 'STAGING' : ref === PRODUCTION_REF ? 'PRODUCTION' : 'an UNKNOWN project';
  console.log(`Project: ${ref} (${name})`);
  if (ref !== STAGING_REF && ref !== PRODUCTION_REF) {
    console.error('REFUSED: neither the staging nor the production project.');
    process.exit(2);
  }
  // The gate guards the WRITE, not the look. A dry run reads and prints and
  // changes nothing, so refusing it on production only costs somebody a
  // round trip and teaches them to reach for --production out of habit —
  // which is the opposite of what the flag is for. (It did exactly that on
  // 2026-10-07, with the teams conversion; this is that lesson applied.)
  //
  // WRITES, not APPLY. `--undo` writes too, and the first version of this
  // gate asked only about `--apply` — so `--undo <file>` against production
  // would have written with no `--production` at all, after printing that it
  // was a dry run. Caught in review before it shipped. A gate that names one
  // of the two ways to write is worse than the blunt one it replaced.
  const WRITES = APPLY || UNDOING;
  if (ref === PRODUCTION_REF && WRITES && !ALLOW_PRODUCTION) {
    console.error('REFUSED: that would WRITE to production. Add --production if you mean it.');
    process.exit(2);
  }
  if (ref === PRODUCTION_REF && !WRITES) {
    console.log('(a dry run against production: it reads and prints, and writes nothing)');
  }
}

type Row = { user_id: string; app_id: string; app: string; email: string; external: boolean; workspace: string };
type Skip = Row & { why: string };

/** Everything each person can open right now, as a set of app ids. The
 *  before-and-after of the acceptance line. */
async function accessByUser(userIds: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (!userIds.length) return out;
  const { data, error } = await adminClient
    .from('app_membership')
    .select('user_id, app_id')
    .in('user_id', userIds);
  if (error) throw new Error(error.message);
  for (const r of data ?? []) {
    const set = out.get(r.user_id as string) ?? new Set<string>();
    set.add(r.app_id as string);
    out.set(r.user_id as string, set);
  }
  return out;
}

async function plan(): Promise<{ convert: Row[]; skip: Skip[] }> {
  const [
    { data: apps, error: aErr },
    { data: memberships, error: mErr },
    { data: members, error: wErr },
    { data: users, error: uErr },
    { data: teams, error: tErr },
    { data: teamMembers, error: tmErr },
    { data: grants, error: gErr },
    { data: workspaces, error: wsErr },
  ] = await Promise.all([
    adminClient.from('app').select('id, slug').in('slug', PLAN_APPS),
    adminClient.from('app_membership').select('user_id, app_id, role, is_direct'),
    adminClient.from('workspace_member').select('user_id, workspace_id, relationship_type'),
    adminClient.from('user').select('id, email, workspace_id'),
    adminClient.from('team').select('id, workspace_id').eq('automatic', 'everyone'),
    adminClient.from('team_member').select('team_id, user_id').eq('status', 'active'),
    adminClient.from('team_app_grant').select('team_id, app_id'),
    adminClient.from('workspace').select('id, name, slug'),
  ]);
  for (const e of [aErr, mErr, wErr, uErr, tErr, tmErr, gErr, wsErr]) if (e) throw new Error(e.message);

  const planAppIds = new Map((apps ?? []).map((a) => [a.id as string, a.slug as string]));
  const emailOf = new Map((users ?? []).map((u) => [u.id as string, (u.email as string) ?? (u.id as string)]));
  const wsNameOf = new Map((workspaces ?? []).map((w) => [w.id as string, (w.slug as string) ?? (w.name as string)]));
  const wsOfUser = new Map((users ?? []).map((u) => [u.id as string, u.workspace_id as string]));
  const memberOf = new Map((members ?? []).map((m) => [m.user_id as string, m]));
  const everyoneOf = new Map((teams ?? []).map((t) => [t.workspace_id as string, t.id as string]));
  const inTeam = new Set((teamMembers ?? []).map((tm) => `${tm.team_id}:${tm.user_id}`));
  const granted = new Set((grants ?? []).map((g) => `${g.team_id}:${g.app_id}`));

  const convert: Row[] = [];
  const skip: Skip[] = [];

  for (const m of memberships ?? []) {
    const slug = planAppIds.get(m.app_id as string);
    if (!slug) continue; // not Meet or Thread — not ours to touch
    if (m.is_direct !== true) continue; // already owed to a team

    const userId = m.user_id as string;
    const wsId = wsOfUser.get(userId) ?? '';
    const base: Row = {
      user_id: userId,
      app_id: m.app_id as string,
      app: slug,
      email: emailOf.get(userId) ?? userId,
      external: memberOf.get(userId)?.relationship_type === 'external',
      workspace: wsNameOf.get(wsId) ?? wsId,
    };

    if (m.role !== 'member') {
      skip.push({ ...base, why: `role=${m.role} — given by a person, and it carries app-admin rights a team grant does not` });
      continue;
    }
    if (!memberOf.has(userId)) {
      skip.push({ ...base, why: 'holds no seat in the workspace (a participant) — not in Everyone' });
      continue;
    }
    const everyone = everyoneOf.get(wsId);
    if (!everyone) {
      skip.push({ ...base, why: 'the workspace has no Everyone team yet — run the teams conversion first' });
      continue;
    }
    if (!inTeam.has(`${everyone}:${userId}`)) {
      skip.push({ ...base, why: 'not in the Everyone team' });
      continue;
    }
    if (!granted.has(`${everyone}:${m.app_id}`)) {
      skip.push({ ...base, why: 'Everyone does not grant this app — converting would take it away' });
      continue;
    }
    convert.push(base);
  }
  return { convert, skip };
}

async function undo(file: string): Promise<void> {
  const saved = JSON.parse(readFileSync(file, 'utf8')) as {
    project_ref: string;
    converted: { user_id: string; app_id: string }[];
  };
  if (saved.project_ref !== ref) {
    console.error(`REFUSED: that undo file was written against ${saved.project_ref}; this is ${ref}.`);
    process.exit(2);
  }
  console.log(`Putting ${saved.converted.length} row(s) back to a direct tick.`);
  for (const r of saved.converted) {
    const { error } = await adminClient
      .from('app_membership')
      .update({ is_direct: true })
      .eq('user_id', r.user_id)
      .eq('app_id', r.app_id);
    if (error) console.error(`  ${r.user_id}/${r.app_id}: ${error.message}`);
  }
  console.log('Done. Nobody gained or lost an app either way — only the reason changed back.');
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

  const { convert, skip } = await plan();
  console.log(APPLY ? 'APPLY RUN.\n' : 'DRY RUN — nothing is written.\n');

  const byWorkspace = new Map<string, Row[]>();
  for (const r of convert) byWorkspace.set(r.workspace, [...(byWorkspace.get(r.workspace) ?? []), r]);
  for (const [ws, rows] of byWorkspace) {
    console.log(`  ${ws}`);
    const byPerson = new Map<string, Row[]>();
    for (const r of rows) byPerson.set(r.email, [...(byPerson.get(r.email) ?? []), r]);
    for (const [email, list] of byPerson) {
      const tag = list[0]!.external ? '  [EXTERNAL]' : '';
      console.log(`      ${email}${tag}: ${list.map((l) => l.app).join(', ')} — direct tick → via Everyone`);
    }
  }
  if (!convert.length) console.log('  (nothing to convert)');

  if (skip.length) {
    console.log('');
    console.log('  LEFT ALONE, with the reason:');
    for (const s of skip) console.log(`      ${s.email} — ${s.app}: ${s.why}`);
  }

  const externals = convert.filter((r) => r.external);
  console.log('');
  console.log(`rows to convert         : ${convert.length}  (${externals.length} belonging to EXTERNAL members)`);
  console.log(`rows left alone         : ${skip.length}`);

  if (!APPLY) {
    console.log('');
    console.log('access taken            : 0 — by construction; --apply measures it and refuses otherwise');
    console.log('');
    console.log('Re-run with --apply to do it.');
    return;
  }

  const userIds = [...new Set(convert.map((r) => r.user_id))];
  const before = await accessByUser(userIds);

  const undoPlan = {
    created_at: new Date().toISOString(),
    project_ref: ref,
    converted: [] as { user_id: string; app_id: string }[],
  };
  for (const r of convert) {
    const { error } = await adminClient
      .from('app_membership')
      .update({ is_direct: false })
      .eq('user_id', r.user_id)
      .eq('app_id', r.app_id);
    if (error) {
      console.error(`  ${r.email} ${r.app}: ${error.message}`);
      continue;
    }
    undoPlan.converted.push({ user_id: r.user_id, app_id: r.app_id });
  }

  // The resolver now has the last word: if anything about the rule was wrong,
  // this is where the row disappears — and the comparison below catches it.
  await syncUsers(userIds);
  const after = await accessByUser(userIds);

  const lost: string[] = [];
  for (const id of userIds) {
    const b = before.get(id) ?? new Set<string>();
    const a = after.get(id) ?? new Set<string>();
    const gone = [...b].filter((app) => !a.has(app));
    if (gone.length) lost.push(`${convert.find((r) => r.user_id === id)?.email ?? id}: lost ${gone.length} app(s)`);
  }

  const file = join(tmpdir(), `undo-direct-to-team-${ref}-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(undoPlan, null, 2));
  console.log('');
  console.log(`rows converted          : ${undoPlan.converted.length}`);
  console.log(`access taken            : ${lost.length}`);
  for (const l of lost) console.log(`    ${l}`);
  console.log(`undo file               : ${file}`);
  if (lost.length) {
    console.log('');
    console.log('STOP: somebody lost access. Undo with the file above and work out why before retrying.');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
