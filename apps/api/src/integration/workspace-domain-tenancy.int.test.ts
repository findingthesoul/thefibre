// A workspace's own domains, attacked from another workspace — the first
// module converted to tenantDb (security F2, pilot).
//
// Same harness as persons-merge-tenancy.int.test.ts: the routes run in
// process behind the real appContext, with real minted sessions. Workspace B
// owns an email domain and a web host (rows written directly, no provider is
// ever called); workspace A's admin lists, and tries to remove, B's.
// Both halves: A sees and changes nothing of B's, and B's own admin still
// reads and removes its own email domain through the converted code.
//
// Never calls Resend or Vercel: the email row has no provider_id, and the
// only web delete is A's, which finds nothing to remove.

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
let wsA: string, wsB: string;
let adminA: FixtureUser, adminB: FixtureUser;
const tag = randomUUID().slice(0, 8);
const emailHostB = `int-dom-${tag}.example.com`;
const webHostB = `www.int-dom-${tag}.example.com`;
let emailRowB = '', webRowB = '';

async function call(user: FixtureUser, method: string, path: string, body?: unknown) {
  return app.request(`/api/v1/workspace-domain${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      'X-App-ID': 'fibre-platform',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const stillThere = async (id: string) =>
  ((await service.from('workspace_domain').select('id').eq('id', id)).data ?? []).length === 1;

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { workspaceDomainRoutes } = await import('../routes/workspace-domain.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/workspace-domain', workspaceDomainRoutes);
  app.route('/api/v1', v1);

  wsA = await createThrowawayWorkspace('dom-tenancy-a');
  wsB = await createThrowawayWorkspace('dom-tenancy-b');
  adminA = await createFixtureUser(wsA, 'dom-tenancy-admin-a');
  adminB = await createFixtureUser(wsB, 'dom-tenancy-admin-b');
  for (const [ws, u] of [[wsA, adminA], [wsB, adminB]] as const) {
    const { error } = await service
      .from('workspace_member')
      .upsert({ workspace_id: ws, user_id: u.userId, workspace_role: 'admin' });
    if (error) throw new Error(`admin: ${error.message}`);
  }
  const { data: e, error: eErr } = await service
    .from('workspace_domain')
    .insert({ workspace_id: wsB, kind: 'email', host: emailHostB, provider: 'resend', status: 'pending' })
    .select('id')
    .single();
  if (eErr) throw new Error(`email row: ${eErr.message}`);
  emailRowB = e.id as string;
  const { data: w, error: wErr } = await service
    .from('workspace_domain')
    .insert({ workspace_id: wsB, kind: 'web', host: webHostB, provider: 'vercel', status: 'verified', app: 'the-thread', root_slug: `int-dom-${tag}` })
    .select('id')
    .single();
  if (wErr) throw new Error(`web row: ${wErr.message}`);
  webRowB = w.id as string;
}, 90_000);

afterAll(async () => {
  await service.from('workspace_domain').delete().in('id', [emailRowB, webRowB].filter(Boolean));
  for (const u of [adminA, adminB]) if (u) await deleteFixtureUser(u);
  for (const ws of [wsA, wsB]) if (ws) await deleteThrowawayWorkspace(ws);
}, 90_000);

describe('workspace-domain routes across workspaces', () => {
  it("A's admin lists none of B's domains", async () => {
    const r = await call(adminA, 'GET', '');
    expect(r.status, await r.clone().text()).toBe(200);
    const body = (await r.json()) as { email: unknown; web: unknown[] };
    expect(body.email).toBeNull();
    expect(body.web).toEqual([]);
  });

  it("A's admin cannot remove B's web host by naming it", async () => {
    const r = await call(adminA, 'DELETE', '/web', { host: webHostB });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ unchanged: true });
    expect(await stillThere(webRowB)).toBe(true);
  });

  it("A's admin removing 'its' email domain leaves B's alone", async () => {
    const r = await call(adminA, 'DELETE', '/email');
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ unchanged: true });
    expect(await stillThere(emailRowB)).toBe(true);
  });

  it('the lookups the pages use answer for the owner only', async () => {
    const { senderDomainState, rootBelongsToWorkspace, resolveWebHost } = await import('../lib/workspace-domain.js');
    expect(await senderDomainState(wsA, `hello@${emailHostB}`)).toBeNull();
    expect(await senderDomainState(wsB, `hello@${emailHostB}`)).toBe('unverified');
    // A verified customer host resolves to its ONE owner, whoever asks — it
    // is how a request on that host finds its workspace at all.
    expect((await resolveWebHost(webHostB))?.workspace_id).toBe(wsB);
    // A Meet root that does not exist in A is not A's, nor B's.
    expect(await rootBelongsToWorkspace('fibre-meet', wsA, `int-dom-${tag}`)).toBe(false);
  });

  it("B's own admin reads its domains and removes its email domain", async () => {
    const list = (await (await call(adminB, 'GET', '')).json()) as { email: { host: string } | null; web: { host: string }[] };
    expect(list.email?.host).toBe(emailHostB);
    expect(list.web.map((w) => w.host)).toEqual([webHostB]);
    const r = await call(adminB, 'DELETE', '/email');
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(await stillThere(emailRowB)).toBe(false);
  });
});
