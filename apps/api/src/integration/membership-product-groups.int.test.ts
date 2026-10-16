// Product groups (2026-10-16): organising only — where a product is listed in
// Members → Products and on the join page. Against staging, through the real
// routes, with an admin fixture (writes go through userClient, so the RLS is
// what is being tested) and a non-admin member who may not write.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { createFixtureUser, createThrowawayWorkspace, deleteFixtureUser, deleteThrowawayWorkspace, service, type FixtureUser } from './staging.js';

let app: Hono;
let ws = '';
let wsSlug = '';
let admin: FixtureUser;
let member: FixtureUser;
let appId = '';
const productIds: string[] = [];

const call = (who: FixtureUser, method: string, path: string, body?: unknown) =>
  app.request(`/api/v1/membership${path}`, {
    method,
    headers: { Authorization: `Bearer ${who.accessToken}`, 'X-App-ID': 'membership', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const catalog = async () => (await app.request(`/api/v1/membership/public/catalog/${wsSlug}`)).json();

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { membershipRoutes } = await import('../routes/membership.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', async (c, next) => (c.req.path.includes('/membership/public/') ? next() : appContext(c, next)));
  v1.route('/membership', membershipRoutes);
  app.route('/api/v1', v1);

  appId = (await service.from('app').select('id').eq('slug', 'membership').single()).data!.id as string;
  ws = await createThrowawayWorkspace('pgroups');
  wsSlug = (await service.from('workspace').select('slug').eq('id', ws).single()).data!.slug as string;
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: appId }, { onConflict: 'workspace_id,app_id' });
  admin = await createFixtureUser(ws, 'pgroups-admin');
  member = await createFixtureUser(ws, 'pgroups-member');
  await service.from('workspace_member').upsert({ workspace_id: ws, user_id: admin.userId, workspace_role: 'admin' });
  await service.from('app_membership').upsert({ user_id: admin.userId, app_id: appId, role: 'admin' }, { onConflict: 'user_id,app_id' });
  await service.from('app_membership').upsert({ user_id: member.userId, app_id: appId, role: 'member' }, { onConflict: 'user_id,app_id' });
  const { data: prods, error } = await service
    .from('membership_product')
    .insert(['Workshop', 'Retreat', 'Sheet music'].map((name, i) => ({ workspace_id: ws, name, price_cents: 1000 * (i + 1), purchasable: true, sort_order: i * 10 })))
    .select('id');
  if (error) throw new Error(`products: ${error.message}`);
  for (const p of prods!) productIds.push(p.id as string);
}, 120_000);

afterAll(async () => {
  if (ws) {
    await service.from('membership_product').delete().eq('workspace_id', ws);
    await service.from('membership_product_group').delete().eq('workspace_id', ws);
    await service.from('app_membership').delete().in('user_id', [admin?.userId, member?.userId].filter(Boolean) as string[]);
    await service.from('workspace_member').delete().eq('workspace_id', ws);
    await service.from('workspace_app').delete().eq('workspace_id', ws);
  }
  if (admin) await deleteFixtureUser(admin);
  if (member) await deleteFixtureUser(member);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 120_000);

describe('product groups', () => {
  let events = '';
  let books = '';

  it('an admin creates groups, orders them by drag, and files products under them', async () => {
    const a = await call(admin, 'POST', '/product-groups', { name: 'Events' });
    expect(a.status, await a.clone().text()).toBe(201);
    events = (await a.json()).id;
    const b = await call(admin, 'POST', '/product-groups', { name: 'Books' });
    books = (await b.json()).id;
    // Books first, by drag.
    expect((await call(admin, 'PUT', '/product-groups/order', { ids: [books, events] })).status).toBe(200);
    expect((await (await call(admin, 'GET', '/product-groups')).json()).items.map((g: { name: string }) => g.name)).toEqual(['Books', 'Events']);
    for (const [id, gid] of [[productIds[0], events], [productIds[1], events], [productIds[2], books]] as const) {
      const r = await call(admin, 'PATCH', `/products/${id}`, { group_id: gid });
      expect(r.status, await r.clone().text()).toBe(200);
    }
  });

  it('a group that is not this workspace’s (or does not exist) is refused', async () => {
    const r = await call(admin, 'PATCH', `/products/${productIds[0]}`, { group_id: randomUUID() });
    expect(r.status).toBe(400);
  });

  it('a member who is not an admin cannot create a group', async () => {
    const r = await call(member, 'POST', '/product-groups', { name: 'Nope' });
    expect(r.status).not.toBe(201);
    const { count } = await service.from('membership_product_group').select('id', { count: 'exact', head: true }).eq('workspace_id', ws).eq('name', 'Nope');
    expect(count).toBe(0);
  });

  it('the public catalogue lists the groups in order, and each product’s group', async () => {
    const cat = await catalog();
    expect(cat.product_groups.map((g: { name: string }) => g.name)).toEqual(['Books', 'Events']);
    const byId = new Map(cat.products.map((p: { id: string; group_id: string | null }) => [p.id, p.group_id]));
    expect([byId.get(productIds[0]), byId.get(productIds[1]), byId.get(productIds[2])]).toEqual([events, events, books]);
  });

  it('archiving a group ungroups its products and never hides them', async () => {
    expect((await call(admin, 'PATCH', `/product-groups/${events}`, { archived: true })).status).toBe(200);
    const cat = await catalog();
    expect(cat.product_groups.map((g: { name: string }) => g.name)).toEqual(['Books']);
    const listed = cat.products.filter((p: { id: string }) => productIds.includes(p.id));
    expect(listed).toHaveLength(3);
    expect(listed.filter((p: { group_id: string | null }) => p.group_id === null)).toHaveLength(2);
  });
});
