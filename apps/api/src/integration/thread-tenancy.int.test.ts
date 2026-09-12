// The Thread's service-role writes, attacked from another workspace.
//
// Found 2026-09-13 by reading routes/thread.ts after the same class turned up
// in PUT /notes: several routes wrote through the service-role client — which
// RLS never sees — and checked nothing about the caller at all. Any signed-in
// user of ANY workspace on the platform could:
//
//   - grant any user The Thread, with role admin     POST   /internal-team
//   - put themselves in any team, as lead            POST   /teams/:id/members
//   - remove anybody from any team                   DELETE /teams/:id/members/:userId
//   - replace another workspace's template grants    PUT    /certificate-templates/:id/shares
//   - wipe another workspace's grants by "deleting"  DELETE /certificate-templates/:id
//
// Reading the code proved the holes existed. This proves they are CLOSED, and
// — the half that is easy to skip — that a legitimate admin can still do
// every one of those things inside their own workspace. A tenancy fix that
// refuses everybody is a lockout wearing a security badge.
//
// The routes run IN PROCESS behind the real appContext middleware, with real
// sessions minted by the fixture harness, so the JWT verification, the
// hook-stamped workspace claims and the route code are all the production
// ones. Staging only, throwaway workspaces, every row cleaned by its own id.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
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
let wsA: string;
let wsB: string;
/** Admin of A — the attacker, and also the legitimate admin. */
let adminA: FixtureUser;
/** An ordinary member of A. */
let memberA: FixtureUser;
/** A member of B — the victim. */
let memberB: FixtureUser;
let teamA: string;
let teamB: string;
let certA: string;
let certB: string;
let shareB: string;
let thethreadAppId: string;
let threadTplB: string;
let threadTplShareB: string;
let programA: string;
let threadA: string;
let organiserA: string;

async function call(
  user: FixtureUser,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  return app.request(`/api/v1/thread${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      'X-App-ID': 'the-thread',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function member(ws: string, u: FixtureUser, role: 'admin' | 'organiser') {
  const { error } = await service
    .from('workspace_member')
    .upsert({ workspace_id: ws, user_id: u.userId, workspace_role: role });
  if (error) throw new Error(`workspace_member fixture: ${error.message}`);
}

async function team(ws: string): Promise<string> {
  const { data, error } = await service
    .from('team')
    .insert({ workspace_id: ws, name: 'Tenancy test', slug: `int-tenancy-${randomUUID().slice(0, 8)}` })
    .select('id')
    .single();
  if (error) throw new Error(`team fixture: ${error.message}`);
  return data!.id as string;
}

async function certTemplate(ws: string): Promise<string> {
  const { data, error } = await service
    .from('thread_certificate_template')
    .insert({ workspace_id: ws, name: 'Tenancy test', scope: 'workspace' })
    .select('id')
    .single();
  if (error) throw new Error(`certificate template fixture: ${error.message}`);
  return data!.id as string;
}

beforeAll(async () => {
  // Imported only now, after vitest.integration.config.ts has injected the
  // staging env — the middleware builds its JWKS and db.ts its clients at
  // module load.
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  const { data: appRow } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  thethreadAppId = appRow!.id as string;

  wsA = await createThrowawayWorkspace('tenancy-a');
  wsB = await createThrowawayWorkspace('tenancy-b');
  adminA = await createFixtureUser(wsA, 'tenancy-admin-a');
  memberA = await createFixtureUser(wsA, 'tenancy-member-a');
  memberB = await createFixtureUser(wsB, 'tenancy-member-b');
  await member(wsA, adminA, 'admin');
  await member(wsA, memberA, 'organiser');
  await member(wsB, memberB, 'organiser');

  teamA = await team(wsA);
  teamB = await team(wsB);
  // The victim sits in B's team, so removing them is something to refuse.
  await service.from('team_member').insert({ team_id: teamB, user_id: memberB.userId, role: 'member', status: 'active' });

  certA = await certTemplate(wsA);
  certB = await certTemplate(wsB);
  const { data: s, error: sErr } = await service
    .from('thread_template_share')
    .insert({ workspace_id: wsB, template_kind: 'certificate', template_id: certB, grantee_user_id: memberB.userId })
    .select('id')
    .single();
  if (sErr) throw new Error(`share fixture: ${sErr.message}`);
  shareB = s!.id as string;

  // A thread template in B, with a grant, for the thread-template delete.
  const { data: tt, error: ttErr } = await service
    .from('thread_template')
    .insert({ workspace_id: wsB, title: 'Tenancy test', scope: 'workspace', structure: {} })
    .select('id')
    .single();
  if (ttErr) throw new Error(`thread template fixture: ${ttErr.message}`);
  threadTplB = tt!.id as string;
  const { data: ts, error: tsErr } = await service
    .from('thread_template_share')
    .insert({ workspace_id: wsB, template_kind: 'thread', template_id: threadTplB, grantee_user_id: memberB.userId })
    .select('id')
    .single();
  if (tsErr) throw new Error(`thread template share fixture: ${tsErr.message}`);
  threadTplShareB = ts!.id as string;

  // A thread in A, owned by A's admin, for the co-organiser invite. A host
  // co-organiser may approve, decline and mark paid — money authority.
  //
  // adminA needs Thread membership, like any real Thread admin: RLS on
  // thread_thread hides a thread from somebody without it, and the route
  // checks visibility through RLS BEFORE the tenancy check. Without this row
  // both co-organiser tests stopped at that earlier 404 — the refusal test
  // passed for the wrong reason and proved nothing, which is how this was
  // found: its success-case twin failed.
  const { error: amErr } = await service
    .from('app_membership')
    .upsert({ user_id: adminA.userId, app_id: thethreadAppId, role: 'admin' }, { onConflict: 'user_id,app_id' });
  if (amErr) throw new Error(`app membership fixture: ${amErr.message}`);
  const { data: org, error: orgErr } = await service
    .from('thread_organiser')
    .insert({ user_id: adminA.userId, workspace_id: wsA, slug: `int-tenancy-org-${randomUUID().slice(0, 8)}` })
    .select('id')
    .single();
  if (orgErr) throw new Error(`organiser fixture: ${orgErr.message}`);
  organiserA = org!.id as string;
  const { data: prog, error: progErr } = await service
    .from('program')
    .insert({ workspace_id: wsA, app_id: thethreadAppId, title: 'Tenancy test', format: 'event', status: 'draft' })
    .select('id')
    .single();
  if (progErr) throw new Error(`program fixture: ${progErr.message}`);
  programA = prog!.id as string;
  const { data: th, error: thErr } = await service
    .from('thread_thread')
    .insert({ workspace_id: wsA, program_id: programA, organiser_id: organiserA, slug: `int-tenancy-${randomUUID().slice(0, 8)}` })
    .select('id')
    .single();
  if (thErr) throw new Error(`thread fixture: ${thErr.message}`);
  threadA = th!.id as string;
}, 60_000);

afterAll(async () => {
  if (threadA) {
    await service.from('thread_thread_organiser').delete().eq('thread_id', threadA);
    await service.from('thread_thread').delete().eq('id', threadA);
  }
  if (programA) await service.from('program').delete().eq('id', programA);
  if (threadTplB) {
    await service.from('thread_template_share').delete().eq('template_id', threadTplB);
    await service.from('thread_template').delete().eq('id', threadTplB);
  }
  const users = [adminA, memberA, memberB].filter(Boolean);
  // Organiser rows, including any the invite route provisioned for a fixture.
  if (users.length) {
    await service.from('thread_organiser').delete().in('user_id', users.map((u) => u.userId));
  }
  if (thethreadAppId && users.length) {
    await service.from('app_membership').delete().eq('app_id', thethreadAppId).in('user_id', users.map((u) => u.userId));
  }
  await service.from('thread_template_share').delete().in('template_id', [certA, certB].filter(Boolean));
  await service.from('thread_certificate_template').delete().in('id', [certA, certB].filter(Boolean));
  await service.from('team_member').delete().in('team_id', [teamA, teamB].filter(Boolean));
  await service.from('team').delete().in('id', [teamA, teamB].filter(Boolean));
  if (users.length) {
    await service.from('workspace_member').delete().in('user_id', users.map((u) => u.userId));
  }
  for (const u of users) await deleteFixtureUser(u);
  if (wsA) await deleteThrowawayWorkspace(wsA);
  if (wsB) await deleteThrowawayWorkspace(wsB);
}, 60_000);

describe('an admin of one workspace cannot reach into another', () => {
  it('cannot grant a user from another workspace The Thread', async () => {
    const res = await call(adminA, 'POST', '/internal-team', { user_id: memberB.userId, role: 'admin' });
    expect(res.status).toBe(404);
    const { data } = await service
      .from('app_membership')
      .select('user_id')
      .eq('app_id', thethreadAppId)
      .eq('user_id', memberB.userId);
    expect(data ?? []).toHaveLength(0);
  });

  it('cannot put themselves into another workspace\'s team as lead', async () => {
    const res = await call(adminA, 'POST', `/teams/${teamB}/members`, { user_id: adminA.userId, role: 'lead' });
    expect(res.status).toBe(404);
    const { data } = await service.from('team_member').select('user_id').eq('team_id', teamB).eq('user_id', adminA.userId);
    expect(data ?? []).toHaveLength(0);
  });

  it('cannot remove somebody from another workspace\'s team', async () => {
    const res = await call(adminA, 'DELETE', `/teams/${teamB}/members/${memberB.userId}`);
    expect(res.status).toBe(404);
    const { data } = await service.from('team_member').select('user_id').eq('team_id', teamB).eq('user_id', memberB.userId);
    expect(data ?? []).toHaveLength(1);
  });

  it('cannot replace another workspace\'s certificate grants', async () => {
    const res = await call(adminA, 'PUT', `/certificate-templates/${certB}/shares`, { user_ids: [], team_ids: [] });
    expect(res.status).toBe(404);
    const { data } = await service.from('thread_template_share').select('id').eq('id', shareB);
    expect(data ?? []).toHaveLength(1);
  });

  it('cannot wipe another workspace\'s grants by deleting its template', async () => {
    const res = await call(adminA, 'DELETE', `/certificate-templates/${certB}`);
    expect(res.status).toBe(404);
    const { data: share } = await service.from('thread_template_share').select('id').eq('id', shareB);
    expect(share ?? []).toHaveLength(1);
    const { data: tpl } = await service.from('thread_certificate_template').select('id').eq('id', certB);
    expect(tpl ?? []).toHaveLength(1);
  });

  it('gives the same answer for an id that does not exist anywhere', async () => {
    // "Elsewhere" and "nowhere" must be indistinguishable, or the route is a
    // way to learn which ids exist in other tenants.
    const res = await call(adminA, 'POST', `/teams/${randomUUID()}/members`, { user_id: adminA.userId });
    expect(res.status).toBe(404);
  });
});

describe('the two routes found by the same read, attacked the same way', () => {
  it('cannot wipe another workspace\'s grants by deleting its THREAD template', async () => {
    const res = await call(adminA, 'DELETE', `/thread-templates/${threadTplB}`);
    expect(res.status).toBe(404);
    const { data: share } = await service.from('thread_template_share').select('id').eq('id', threadTplShareB);
    expect(share ?? []).toHaveLength(1);
  });

  it('cannot make somebody from another workspace a co-organiser of a thread here', async () => {
    const res = await call(adminA, 'POST', `/threads/${threadA}/members`, { user_id: memberB.userId, role: 'host' });
    expect(res.status).toBe(404);
    const { data } = await service.from('thread_thread_organiser').select('thread_id').eq('thread_id', threadA);
    expect(data ?? []).toHaveLength(0);
  });

  it('CAN make a member of this workspace a co-organiser', async () => {
    const res = await call(adminA, 'POST', `/threads/${threadA}/members`, { user_id: memberA.userId, role: 'host' });
    expect(res.status).toBe(201);
  });
});

describe('the same admin can still do all of it at home', () => {
  // The half a tenancy fix most often breaks. Every refusal above is only
  // worth something if these still pass.
  it('grants a member of their own workspace The Thread', async () => {
    const res = await call(adminA, 'POST', '/internal-team', { user_id: memberA.userId, role: 'member' });
    expect(res.status).toBe(201);
  });

  it('adds a member of their own workspace to their own team', async () => {
    const res = await call(adminA, 'POST', `/teams/${teamA}/members`, { user_id: memberA.userId });
    expect(res.status).toBe(201);
  });

  it('removes them again', async () => {
    const res = await call(adminA, 'DELETE', `/teams/${teamA}/members/${memberA.userId}`);
    expect(res.status).toBe(204);
  });

  it('shares their own certificate template with their own member', async () => {
    const res = await call(adminA, 'PUT', `/certificate-templates/${certA}/shares`, {
      user_ids: [memberA.userId],
      team_ids: [teamA],
    });
    expect(res.status).toBe(200);
  });

  it('refuses a grantee from another workspace even on their own template', async () => {
    const res = await call(adminA, 'PUT', `/certificate-templates/${certA}/shares`, { user_ids: [memberB.userId] });
    expect(res.status).toBe(404);
  });
});

describe('authority inside a workspace still applies', () => {
  it('an ordinary member cannot grant The Thread', async () => {
    const res = await call(memberA, 'POST', '/internal-team', { user_id: adminA.userId, role: 'admin' });
    expect(res.status).toBe(403);
  });

  it('an ordinary member cannot change a team they do not lead', async () => {
    const res = await call(memberA, 'POST', `/teams/${teamA}/members`, { user_id: memberA.userId, role: 'lead' });
    expect(res.status).toBe(403);
  });
});
