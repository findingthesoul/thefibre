// Removing an app from Everyone has to REMOVE it, and stay removed.
//
// Sjoerd, 2026-10-08: *"meet thread via everyone"*. Until that day
// `ensurePlanApps` upserted an app_membership row for every user in the
// workspace on every single sign-in, so an admin who took Thread off the
// Everyone team watched nothing happen: the rows came back at the next
// sign-in and no screen said why. The control existed and did not work.
//
// These three cases are that story in order — granted at activation, removed
// by an admin, and still gone after the sign-in path runs twice. The third is
// the regression; the first two exist so a failure tells you which half
// broke.
import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';
import { ensureAutomaticTeams, syncAutomaticTeams } from '../lib/automatic-teams.js';
import { syncTeam } from '../lib/team-grants.js';
import { ensurePlanApps } from '../lib/plan-apps.js';

let ws = '';
let bystander = '';
let threadAppId = '';
let everyoneId = '';

beforeAll(async () => {
  ws = await createThrowawayWorkspace('removal-sticks');
  const email = `int-sticks-${randomUUID().slice(0, 8)}@example.com`;
  const { data: u } = await service.from('user').insert({ workspace_id: ws, email }).select('id').single();
  bystander = u!.id as string;
  await service.from('workspace_member').insert({ workspace_id: ws, user_id: bystander, workspace_role: 'organiser' });
  await syncAutomaticTeams(ws);
  const teams = await ensureAutomaticTeams(ws);
  everyoneId = teams.everyone!;
  const { data: app } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  threadAppId = app!.id as string;
});

afterAll(async () => {
  await service.from('app_membership').delete().eq('user_id', bystander);
  await service.from('team_member').delete().eq('user_id', bystander);
  await service.from('workspace_member').delete().eq('user_id', bystander);
  await service.from('team_app_grant').delete().eq('team_id', everyoneId);
  await service.from('workspace_app').delete().eq('workspace_id', ws);
  await service.from('user').delete().eq('id', bystander);
  await deleteThrowawayWorkspace(ws);
});

const holdsThread = async () => {
  const { data } = await service
    .from('app_membership')
    .select('is_direct')
    .eq('user_id', bystander)
    .eq('app_id', threadAppId)
    .maybeSingle();
  return data;
};

it('first activation gives it to everybody, through the team', async () => {
  // This IS the sign-in path's own call: sso/resolve does `void
  // ensurePlanApps(workspace_id)`. Called here in process rather than over
  // HTTP, because /sso/resolve requires SSO_INTERNAL_SECRET and reading a
  // secret to write a test is not a trade I will make.
  await ensurePlanApps(ws);

  const { data: grant } = await service
    .from('team_app_grant')
    .select('team_id')
    .eq('team_id', everyoneId)
    .eq('app_id', threadAppId)
    .maybeSingle();
  expect(grant, 'Everyone was not granted Thread at activation').toBeTruthy();

  const held = await holdsThread();
  expect(held, 'the member did not get Thread').toBeTruthy();
  expect(held!.is_direct, 'it should be owed to the team, not to a tick').toBe(false);
});

it('an admin removing it from Everyone really removes it', async () => {
  await service.from('team_app_grant').delete().eq('team_id', everyoneId).eq('app_id', threadAppId);
  await syncTeam(everyoneId);
  expect(await holdsThread(), 'removing the grant did not take the app away').toBeNull();
});

it('and it STAYS removed across a sign-in — the regression this whole change is for', async () => {
  // Before 2026-10-08 this is where it came back: ensurePlanApps upserted a
  // direct row for every user on every sign-in, so the admin's removal was
  // undone silently and nothing on screen said so.
  await ensurePlanApps(ws);
  expect(await holdsThread(), 'a sign-in put Thread back; the removal did not stick').toBeNull();

  // Twice, because "once" could be a slow write rather than a rule.
  await ensurePlanApps(ws);
  expect(await holdsThread()).toBeNull();
});
