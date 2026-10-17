// The published app surface (/api/v1/apps/*), attacked from another
// workspace with a real app key — security F2, the first external batch.
//
// An app key has no user and RLS does not see it: on these routes the
// handler is the whole boundary (data-protection-approach §3.3). The routes
// now query through tenantDb; this proves the boundary holds where it
// matters, with the production middleware and a key minted the way
// Settings → Apps mints one (sha256 of a fibre_ak_ token).
//
// Workspace B holds a person, an organisation, a thread published by the same
// app and an engagement on it. The app's key is for workspace A. It must not
// read B's thread, must not anchor A's message to B's session, and must not
// start a run about B's person or organisation. The legitimate half runs too:
// the key publishes a thread in A, lays a message on it anchored to its own
// session, and starts a run in A.
//
// No run is started about a PERSON on purpose: that writes an append-only
// activity row, which would pin the throwaway workspace for good.

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
import { generateToken } from '../lib/app-keys.js';

const rand = randomUUID().slice(0, 8);
const SLUG = `int-tenancy-${rand}`;
const SCOPES = ['read:programs', 'write:programs', 'write:messages', 'write:flow_runs', 'read:flows'];
let app: Hono;
let wsA = '', wsB = '';
let adminA: FixtureUser;
let appRowId = '';
let KEY = '';
let personB = '', orgB = '', threadB = '', engagementB = '', userB = '';
let flowA = '';

async function call(method: string, path: string, body?: unknown) {
  return app.request(`/api/v1/apps/${SLUG}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function must<T>(label: string, r: { data: T | null; error: { message: string } | null }): T {
  if (r.error || r.data === null) throw new Error(`${label}: ${r.error?.message ?? 'no row'}`);
  return r.data;
}
const idOf = (label: string, r: { data: { id: unknown } | null; error: { message: string } | null }) =>
  must(label, r).id as string;

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { appsRoutes } = await import('../routes/apps.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/apps', appsRoutes);
  app.route('/api/v1', v1);

  wsA = await createThrowawayWorkspace('apps-tenancy-a');
  wsB = await createThrowawayWorkspace('apps-tenancy-b');
  adminA = await createFixtureUser(wsA, 'apps-tenancy-admin-a');
  const { error: mErr } = await service
    .from('workspace_member')
    .upsert({ workspace_id: wsA, user_id: adminA.userId, workspace_role: 'admin' });
  if (mErr) throw new Error(`admin: ${mErr.message}`);

  appRowId = idOf(
    'app',
    await service
      .from('app')
      .insert({
        slug: SLUG,
        name: `Integration tenancy ${rand}`,
        status: 'approved',
        kind: 'third_party',
        released_at: new Date().toISOString(),
        contact_email: `int-tenancy-${rand}@example.com`,
        manifest: { app_slug: SLUG, app_name: 'Integration tenancy', scopes_requested: SCOPES },
      })
      .select('id')
      .single(),
  );
  for (const ws of [wsA, wsB]) {
    idOf('workspace_app', await service.from('workspace_app').insert({ workspace_id: ws, app_id: appRowId }).select('id').single());
  }
  const t = generateToken();
  KEY = t.token;
  idOf(
    'app_key',
    await service
      .from('app_key')
      .insert({
        app_id: appRowId,
        workspace_id: wsA,
        name: 'int tenancy',
        token_prefix: t.prefix,
        token_hash: t.hash,
        scopes: SCOPES,
        created_by: adminA.userId,
      })
      .select('id')
      .single(),
  );

  // Workspace B's rows.
  personB = idOf('personB', await service.from('person').insert({ workspace_id: wsB, first_name: 'Int', last_name: 'TenancyB' }).select('id').single());
  orgB = idOf('orgB', await service.from('organisation').insert({ workspace_id: wsB, name: `Int TenancyB ${rand}` }).select('id').single());
  const threadApp = idOf('the-thread', await service.from('app').select('id').eq('slug', 'the-thread').single());
  userB = idOf('userB', await service.from('user').insert({ workspace_id: wsB, email: `int-tenancy-b-${rand}@example.com` }).select('id').single());
  const organiserB = idOf(
    'organiserB',
    await service.from('thread_organiser').insert({ user_id: userB, workspace_id: wsB, slug: `int-ten-b-${rand}`, display_name: 'Int B', is_published: false }).select('id').single(),
  );
  const programB = idOf(
    'programB',
    await service.from('program').insert({ workspace_id: wsB, app_id: threadApp, title: 'Int B programme', format: 'event', source_app: SLUG }).select('id').single(),
  );
  threadB = idOf(
    'threadB',
    await service.from('thread_thread').insert({ workspace_id: wsB, program_id: programB, organiser_id: organiserB, slug: `int-ten-b-${rand}` }).select('id').single(),
  );
  engagementB = idOf(
    'engagementB',
    await service
      .from('thread_engagement')
      .insert({ workspace_id: wsB, thread_id: threadB, type: 'event', title: 'B session', status: 'draft', starts_at: '2030-03-01T10:00:00Z', ends_at: '2030-03-01T11:00:00Z' })
      .select('id')
      .single(),
  );

  // A flow in workspace A the key may run.
  flowA = idOf(
    'flowA',
    await service
      .from('flow_definition')
      .insert({ workspace_id: wsA, name: 'Int tenancy flow', scope: 'workspace', owner_user_id: adminA.userId, created_by: adminA.userId, lifecycle: 'active' })
      .select('id')
      .single(),
  );
  const versionA = idOf(
    'versionA',
    await service.from('flow_version').insert({ flow_id: flowA, version_number: 1, published_at: new Date().toISOString(), created_by: adminA.userId }).select('id').single(),
  );
  idOf('current version', await service.from('flow_definition').update({ current_version_id: versionA }).eq('id', flowA).select('id').single());
  must(
    'steps',
    await service
      .from('flow_step')
      .insert([
        { flow_version_id: versionA, key: 'start', name: 'Start', kind: 'entry', ordinal: 0 },
        { flow_version_id: versionA, key: 'done', name: 'Done', kind: 'end_positive', ordinal: 1 },
      ])
      .select('id'),
  );
}, 120_000);

afterAll(async () => {
  for (const ws of [wsA, wsB]) {
    if (!ws) continue;
    const { data: threads } = await service.from('thread_thread').select('id, program_id').eq('workspace_id', ws);
    for (const t of threads ?? []) {
      await service.from('thread_engagement').update({ trigger_engagement_id: null }).eq('thread_id', t.id);
      await service.from('thread_engagement').delete().eq('thread_id', t.id);
      await service.from('thread_thread').delete().eq('id', t.id);
      await service.from('program').delete().eq('id', t.program_id);
    }
    await service.from('thread_organiser').delete().eq('workspace_id', ws);
    await service.from('flow_task').delete().eq('workspace_id', ws);
    await service.from('flow_run').delete().eq('workspace_id', ws);
    await service.from('flow_definition').update({ current_version_id: null }).eq('workspace_id', ws);
    await service.from('flow_definition').delete().eq('workspace_id', ws);
  }
  if (userB) await service.from('user').delete().eq('id', userB);
  if (appRowId) {
    await service.from('app_key').delete().eq('app_id', appRowId);
    await service.from('workspace_app').delete().eq('app_id', appRowId);
  }
  if (adminA) await deleteFixtureUser(adminA);
  for (const ws of [wsA, wsB]) if (ws) await deleteThrowawayWorkspace(ws);
  if (appRowId) await service.from('app').delete().eq('id', appRowId);
}, 120_000);

describe('/apps/*/thread across workspaces', () => {
  let threadA = '', sessionA = '';

  it('the key cannot read B’s thread, though its own app published it', async () => {
    const r = await call('GET', `/thread/threads/${threadB}`);
    expect(r.status).toBe(404);
    const list = await call('GET', '/thread/threads');
    expect(list.status, await list.clone().text()).toBe(200);
    expect(((await list.json()) as { threads: { id: string }[] }).threads.map((t) => t.id)).not.toContain(threadB);
  });

  it('publishes a thread in its own workspace (the converted publish path)', async () => {
    const r = await call('POST', '/thread/threads', { title: 'Int A event', format: 'event', slug: `int-ten-a-${rand}` });
    expect(r.status, await r.clone().text()).toBe(201);
    threadA = ((await r.json()) as { id: string }).id;
    const s = await call('POST', `/thread/threads/${threadA}/engagements`, {
      type: 'event',
      title: 'A session',
      source_ref: randomUUID(),
      starts_at: '2030-04-01T10:00:00Z',
      ends_at: '2030-04-01T11:00:00Z',
    });
    expect(s.status, await s.clone().text()).toBe(201);
    sessionA = ((await s.json()) as { id: string }).id;
  });

  it('cannot time its message from B’s session — a 400, and nothing written', async () => {
    const r = await call('POST', `/thread/threads/${threadA}/engagements`, {
      type: 'message',
      title: 'Planted',
      source_ref: randomUUID(),
      trigger_kind: 'relative',
      trigger_anchor: 'engagement',
      trigger_engagement_id: engagementB,
      trigger_offset_days: -1,
      trigger_time: '09:00',
    });
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ error: 'trigger_engagement_id is not an engagement of this thread' });
    const { data } = await service.from('thread_engagement').select('id').eq('thread_id', threadA).eq('title', 'Planted');
    expect(data).toEqual([]);
  });

  it('times a message from its own session, and cannot re-point it at B’s', async () => {
    const r = await call('POST', `/thread/threads/${threadA}/engagements`, {
      type: 'message',
      title: 'Reminder',
      source_ref: randomUUID(),
      trigger_kind: 'relative',
      trigger_anchor: 'engagement',
      trigger_engagement_id: sessionA,
      trigger_offset_days: -1,
      trigger_time: '09:00',
    });
    expect(r.status, await r.clone().text()).toBe(201);
    const id = ((await r.json()) as { id: string }).id;
    const p = await call('PATCH', `/thread/engagements/${id}`, { trigger_engagement_id: engagementB });
    expect(p.status).toBe(400);
    const { data } = await service.from('thread_engagement').select('trigger_engagement_id').eq('id', id).single();
    expect(data!.trigger_engagement_id).toBe(sessionA);
  });

  it('cannot edit or delete B’s engagement by id', async () => {
    expect((await call('PATCH', `/thread/engagements/${engagementB}`, { title: 'Overwritten' })).status).toBe(404);
    expect((await call('DELETE', `/thread/engagements/${engagementB}`)).status).toBe(404);
    const { data } = await service.from('thread_engagement').select('title').eq('id', engagementB).single();
    expect(data!.title).toBe('B session');
  });
});

describe('/apps/*/flow across workspaces', () => {
  it('cannot start a run about B’s person', async () => {
    const r = await call('POST', `/flow/flows/${flowA}/runs`, { person_id: personB });
    expect(r.status).toBe(404);
    expect(await r.json()).toMatchObject({ error: 'person_id is not in this workspace' });
    const { data } = await service.from('flow_run').select('id').eq('person_id', personB);
    expect(data).toEqual([]);
  });

  it('cannot start a run about B’s organisation', async () => {
    const r = await call('POST', `/flow/flows/${flowA}/runs`, { organisation_id: orgB });
    expect(r.status).toBe(404);
    const { data } = await service.from('flow_run').select('id').eq('organisation_id', orgB);
    expect(data).toEqual([]);
  });

  it('starts a run in its own workspace and reads it back with its steps', async () => {
    const r = await call('POST', `/flow/flows/${flowA}/runs`, { subject_label: 'Int A subject' });
    expect(r.status, await r.clone().text()).toBe(201);
    const id = ((await r.json()) as { id: string }).id;
    const g = await call('GET', `/flow/runs/${id}`);
    expect(g.status, await g.clone().text()).toBe(200);
    expect(JSON.stringify(await g.json())).toContain('"start"');
  });
});
