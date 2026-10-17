// An approved app's declaration (its scopes and activity types) is the app's
// own, and the scopes its keys are capped by are the ones a platform admin
// approved. In process, against staging, through the real routes:
//
//   · a workspace admin re-sending the declaration unchanged still installs
//     the per-workspace entity mappings;
//   · a workspace admin changing the scopes or the activity types is refused,
//     and the app's row is untouched;
//   · the app's own key asking for MORE scopes is answered as before, the
//     extra ones are reported as waiting for review, and a key minted after
//     it is still held to the approved set;
//   · a platform admin approving the waiting scopes raises the cap, and a key
//     may then carry them.
// Fixture app, throwaway workspace, every row removed by id. No activity rows.

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
const SLUG = `int-manifest-${rand}`;
const APPROVED = ['read:persons'];
const TYPES = ['thing_happened'];
let app: Hono;
let ws = '';
let wsAdmin: FixtureUser;
let reviewer: FixtureUser;
let appRowId = '';
let KEY = '';

const asUser = (user: FixtureUser, method: string, path: string, body?: unknown) =>
  app.request(`/api/v1/apps${path}`, {
    method,
    headers: { Authorization: `Bearer ${user.accessToken}`, 'X-App-ID': 'fibre-platform', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const asKey = (method: string, path: string, body?: unknown) =>
  app.request(`/api/v1/apps/${SLUG}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const manifest = async () =>
  ((await service.from('app').select('manifest').eq('id', appRowId).single()).data!.manifest ?? {}) as Record<string, unknown>;
const mint = (scopes: string[]) => asUser(wsAdmin, 'POST', `/${SLUG}/keys`, { name: `int ${scopes.join(',')}`, scopes });

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { appsRoutes } = await import('../routes/apps.js');
  const { forgetAllPlans } = await import('../lib/plan.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/apps', appsRoutes);
  app.route('/api/v1', v1);

  ws = await createThrowawayWorkspace('apps-manifest');
  wsAdmin = await createFixtureUser(ws, 'manifest-admin');
  reviewer = await createFixtureUser(ws, 'manifest-reviewer');
  for (const u of [wsAdmin, reviewer]) {
    const { error } = await service.from('workspace_member').upsert({ workspace_id: ws, user_id: u.userId, workspace_role: 'admin' });
    if (error) throw new Error(`member: ${error.message}`);
  }
  // A platform admin, for this fixture only (removed with the user).
  const { error: suErr } = await service.from('user').update({ is_super_admin: true }).eq('id', reviewer.userId);
  if (suErr) throw new Error(`reviewer: ${suErr.message}`);
  // Keys are a Pro feature.
  const { error: subErr } = await service
    .from('workspace_subscription')
    .upsert({ workspace_id: ws, plan_id: 'pro', status: 'active' }, { onConflict: 'workspace_id' });
  if (subErr) throw new Error(`subscription: ${subErr.message}`);
  forgetAllPlans();

  const { data: row, error } = await service
    .from('app')
    .insert({
      slug: SLUG,
      name: `Integration manifest ${rand}`,
      status: 'approved',
      kind: 'third_party',
      released_at: new Date().toISOString(),
      contact_email: `int-manifest-${rand}@example.com`,
      manifest: { app_slug: SLUG, app_name: 'Integration manifest', scopes_requested: APPROVED, activity_types: TYPES },
    })
    .select('id')
    .single();
  if (error) throw new Error(`app: ${error.message}`);
  appRowId = row!.id as string;
  const { error: waErr } = await service.from('workspace_app').insert({ workspace_id: ws, app_id: appRowId });
  if (waErr) throw new Error(`workspace_app: ${waErr.message}`);
  const t = generateToken();
  KEY = t.token;
  const { error: kErr } = await service.from('app_key').insert({
    app_id: appRowId,
    workspace_id: ws,
    name: 'int manifest',
    token_prefix: t.prefix,
    token_hash: t.hash,
    scopes: APPROVED,
    created_by: wsAdmin.userId,
  });
  if (kErr) throw new Error(`app_key: ${kErr.message}`);
}, 180_000);

afterAll(async () => {
  if (appRowId) {
    await service.from('app_key').delete().eq('app_id', appRowId);
    await service.from('app_entity_mapping').delete().eq('app_id', appRowId);
    await service.from('workspace_app').delete().eq('app_id', appRowId);
    await service.from('app').delete().eq('id', appRowId);
  }
  // A platform admin cannot be deleted (a guard): revoke the fixture's flag first.
  if (reviewer) await service.from('user').update({ is_super_admin: false }).eq('id', reviewer.userId);
  for (const u of [wsAdmin, reviewer]) if (u) await deleteFixtureUser(u);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 180_000);

describe('a workspace admin', () => {
  it('installs the per-workspace mappings with the declaration re-sent unchanged', async () => {
    const r = await asUser(wsAdmin, 'PUT', `/${SLUG}/manifest`, {
      entity_mappings: [{ app_entity: 'member', platform_entity: 'person', mapping_kind: 'identity', match_on: ['email'] }],
      scopes_requested: APPROVED,
      activity_types: TYPES,
    });
    expect(r.status, await r.clone().text()).toBe(200);
    const body = (await r.json()) as { mappings_installed: number; scopes_pending_review: string[] };
    expect(body.mappings_installed).toBe(1);
    expect(body.scopes_pending_review).toEqual([]);
  });

  it('cannot change the scopes the app declared, and the row is untouched', async () => {
    const before = await manifest();
    const r = await asUser(wsAdmin, 'PUT', `/${SLUG}/manifest`, { scopes_requested: [...APPROVED, 'write:persons'] });
    expect(r.status).toBe(403);
    expect(await manifest()).toEqual(before);
  });

  it('cannot change the activity types every workspace validates against', async () => {
    const before = await manifest();
    const r = await asUser(wsAdmin, 'PUT', `/${SLUG}/manifest`, { activity_types: ['something_else'] });
    expect(r.status).toBe(403);
    expect(await manifest()).toEqual(before);
  });
});

describe("the app's own key asking for more", () => {
  it('is answered as before, and the extra scope waits for review', async () => {
    const r = await asKey('PUT', '/manifest', { scopes_requested: [...APPROVED, 'write:persons'] });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(((await r.json()) as { scopes_pending_review: string[] }).scopes_pending_review).toEqual(['write:persons']);
    const m = await manifest();
    expect(m.scopes_requested).toEqual(APPROVED);
    expect(m.scopes_pending_review).toEqual(['write:persons']);
  });

  it('does not raise the cap: a key minted now cannot carry the waiting scope', async () => {
    expect((await mint(['write:persons'])).status).toBe(400);
    expect((await mint(APPROVED)).status).toBe(201);
  });
});

describe('a platform admin', () => {
  it('approves the waiting scopes, and a key may then carry them', async () => {
    const r = await asUser(reviewer, 'PATCH', `/${SLUG}`, { action: 'approve_scopes' });
    expect(r.status, await r.clone().text()).toBe(200);
    const m = await manifest();
    expect(new Set(m.scopes_requested as string[])).toEqual(new Set([...APPROVED, 'write:persons']));
    expect(m.scopes_pending_review).toEqual([]);
    expect((await mint(['write:persons'])).status).toBe(201);
  });

  it('a workspace admin cannot approve them', async () => {
    expect((await asUser(wsAdmin, 'PATCH', `/${SLUG}`, { action: 'approve_scopes' })).status).toBe(403);
  });
});
