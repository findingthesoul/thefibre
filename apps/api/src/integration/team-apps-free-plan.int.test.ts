// The automatic teams' apps are editable on every plan; custom teams are not.
//
// Sjoerd, 2026-10-09. Everyone's grants ARE the baseline a new person gets, so
// a workspace that cannot edit them cannot answer "what does a newcomer get?"
// — the answer stays frozen at whatever the first app activation happened to
// set. That is not a feature to sell. Making a team to give ONE group a
// different set of apps still is, and stays on Pro.
//
// The last case is the one that matters most and the reason the rule was
// pulled into lib/team-app-editing.ts: it asserts that what the API OFFERS
// (can_edit_apps on the list and the detail) is the same answer the PUT
// GIVES. A screen that offers an edit the route then refuses with a 402 is
// two implementations of one rule — the shape that shipped on 2026-10-09,
// when a settings screen offered to open a page the server had just been told
// to hide.
//
// Runs on a workspace explicitly put on FREE: `can()` returns true for a
// workspace with no subscription at all (it fails open), so a throwaway
// workspace would pass this suite while proving nothing.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import {
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  service,
  type FixtureUser,
} from './staging.js';

let app: Hono;
let workspaceId: string;
let user: FixtureUser;
let everyoneId = '';
let customId = '';

const call = (path: string, init?: RequestInit) =>
  app.request(`/api/v1/teams${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      'X-App-ID': 'fibre-platform',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

const putApps = (teamId: string, slugs: string[]) =>
  call(`/${teamId}/apps`, {
    method: 'PUT',
    body: JSON.stringify({ apps: slugs.map((slug) => ({ slug, lead_is_app_admin: false })) }),
  });

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { teamsRoutes } = await import('../routes/teams.js');
  const { forgetAllPlans } = await import('../lib/plan.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/teams', teamsRoutes);
  app.route('/api/v1', v1);

  workspaceId = await createThrowawayWorkspace('teamapps');
  user = await createFixtureUser(workspaceId, 'teamapps');
  const { error: wmErr } = await service
    .from('workspace_member')
    .insert({ workspace_id: workspaceId, user_id: user.userId, workspace_role: 'admin' });
  if (wmErr) throw new Error(`workspace_member: ${wmErr.message}`);

  // FREE, explicitly. Without this the workspace has no subscription, planFor
  // answers 'unknown', and `can` allows everything.
  const { error: subErr } = await service
    .from('workspace_subscription')
    .upsert({ workspace_id: workspaceId, plan_id: 'free', status: 'active' }, { onConflict: 'workspace_id' });
  if (subErr) throw new Error(`workspace_subscription: ${subErr.message}`);
  forgetAllPlans();

  const { ensureAutomaticTeams } = await import('../lib/automatic-teams.js');
  const teams = await ensureAutomaticTeams(workspaceId);
  everyoneId = teams.everyone ?? '';
  if (!everyoneId) throw new Error('no Everyone team was created');

  // ensureAutomaticTeams CREATES the teams; syncAutomaticTeams is what fills
  // them. Without this the removal case below asserts that nobody was removed
  // from a team that was empty to begin with — which passes while proving
  // nothing. (It did, on the first run.)
  const { error: tmErr } = await service
    .from('team_member')
    .upsert(
      { team_id: everyoneId, user_id: user.userId, role: 'member', status: 'active' },
      { onConflict: 'team_id,user_id' },
    );
  if (tmErr) throw new Error(`team_member: ${tmErr.message}`);

  const { data: custom, error: cErr } = await service
    .from('team')
    .insert({ workspace_id: workspaceId, name: 'A team somebody made', slug: `int-teamapps-${workspaceId.slice(0, 8)}` })
    .select('id')
    .single();
  if (cErr) throw new Error(`custom team: ${cErr.message}`);
  customId = custom!.id as string;

  // One app switched on, so there is something grantable to put.
  const { data: appRow } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  const { error: waErr } = await service
    .from('workspace_app')
    .upsert({ workspace_id: workspaceId, app_id: appRow!.id }, { onConflict: 'workspace_id,app_id' });
  if (waErr) throw new Error(`workspace_app: ${waErr.message}`);
}, 90_000);

afterAll(async () => {
  await service.from('team_app_grant').delete().in('team_id', [everyoneId, customId].filter(Boolean));
  await service.from('team_member').delete().in('team_id', [everyoneId, customId].filter(Boolean));
  await service.from('team').delete().eq('workspace_id', workspaceId);
  await service.from('app_membership').delete().eq('user_id', user.userId);
  await service.from('workspace_subscription').delete().eq('workspace_id', workspaceId);
  await service.from('workspace_app').delete().eq('workspace_id', workspaceId);
  await service.from('workspace_member').delete().eq('user_id', user.userId);
  if (user) await deleteFixtureUser(user);
  if (workspaceId) await deleteThrowawayWorkspace(workspaceId);
}, 90_000);

// The OTHER half of what the Teams page now shows for these two teams.
//
// The page became reachable for Everyone and Admins on 2026-10-09, and it
// arrived carrying Add and Remove buttons — controls the route refuses
// outright. Nothing tested that refusal, so the screen and the route could
// have disagreed in either direction without a failing test.
describe('membership of the automatic teams', () => {
  it('refuses to take somebody out of Everyone, and leaves them in it', async () => {
    const res = await call(`/${everyoneId}/members/${user.userId}`, { method: 'DELETE' });
    expect(res.status).toBe(400);
    const { data } = await service
      .from('team_member')
      .select('user_id')
      .eq('team_id', everyoneId)
      .eq('user_id', user.userId);
    expect(data?.length, 'a refused removal must not have removed anybody').toBe(1);
  });

  it('refuses to add somebody to Everyone', async () => {
    const res = await call(`/${everyoneId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: user.userId, role: 'member' }),
    });
    expect(res.status).toBe(400);
  });

  // The refusal is about the automatic teams, not about membership writes in
  // general — otherwise this would be a much bigger regression wearing the
  // same test.
  it('still allows membership changes on a team somebody made', async () => {
    const add = await call(`/${customId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: user.userId, role: 'member' }),
    });
    expect(add.status, await add.clone().text()).toBe(200);
    const remove = await call(`/${customId}/members/${user.userId}`, { method: 'DELETE' });
    expect(remove.status, await remove.clone().text()).toBe(200);
  });
});

describe('editing a team’s apps on the Free plan', () => {
  it('allows it for Everyone — the baseline is not a paid feature', async () => {
    const res = await putApps(everyoneId, ['the-thread']);
    expect(res.status, await res.clone().text()).toBe(200);
    const { data } = await service.from('team_app_grant').select('app_id').eq('team_id', everyoneId);
    expect(data?.length, 'the grant should be stored, not merely accepted').toBe(1);
  });

  it('still refuses it for a team somebody made', async () => {
    const res = await putApps(customId, ['the-thread']);
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Pro');
    const { data } = await service.from('team_app_grant').select('app_id').eq('team_id', customId);
    expect(data?.length, 'a refused PUT must not have written anything').toBe(0);
  });

  it('says so per team, and keeps the workspace-level flag meaning what it meant', async () => {
    const body = (await (await call('?with_automatic=1')).json()) as {
      items: { id: string; automatic: string | null; can_edit_apps: boolean }[];
      can_edit_grants: boolean;
    };
    // Unchanged meaning: does this WORKSPACE have the Pro feature. It does not.
    expect(body.can_edit_grants).toBe(false);
    expect(body.items.find((t) => t.id === everyoneId)?.can_edit_apps).toBe(true);
    expect(body.items.find((t) => t.id === customId)?.can_edit_apps).toBe(false);
  });

  // The two halves cannot disagree. Asserted by ASKING both, not by reading
  // the rule twice — a test that restated the condition would pass even if
  // the screen and the route had drifted apart.
  it('offers exactly what it allows, for every team', async () => {
    const { items } = (await (await call('?with_automatic=1')).json()) as {
      items: { id: string; name: string; can_edit_apps: boolean }[];
    };
    expect(items.length).toBeGreaterThan(1);
    for (const team of items) {
      const offered = team.can_edit_apps;
      const allowed = (await putApps(team.id, [])).status !== 402;
      expect(allowed, `${team.name}: offered ${offered}, the route said ${allowed}`).toBe(offered);
    }
  });
});
