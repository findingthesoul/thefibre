// A member's name survives the join — against staging.
//
// 2026-10-15, marieke@soul.com: she joined a community where a nameless
// contact with her email already existed; the join threw the typed name away,
// and my.thread → You (which showed the NEWEST contact across communities)
// was blank. Fixed three ways, each pinned here:
//   · resolvePerson fillEmptyName: an existing nameless contact gets the
//     typed name; a named one keeps theirs;
//   · fillEmptyPlatformName: the platform profile gets a name only where it
//     has none;
//   · GET /me/profile shows the newest contact WITH a name, and the billing
//     details of the last paid checkout (read-only).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { createFixtureUser, createThrowawayWorkspace, deleteFixtureUser, deleteThrowawayWorkspace, service, type FixtureUser } from './staging.js';

let app: Hono;
let wsA = '';
let wsB = '';
let user: FixtureUser;
let purchaseId = '';

beforeAll(async () => {
  const { portalRoutes } = await import('../routes/portal.js');
  app = new Hono();
  const v1 = new Hono();
  v1.route('/me', portalRoutes);
  app.route('/api/v1', v1);
  wsA = await createThrowawayWorkspace('namesa');
  wsB = await createThrowawayWorkspace('namesb');
  user = await createFixtureUser(wsA, 'names');
}, 120_000);

afterAll(async () => {
  if (purchaseId) await service.from('purchase').delete().eq('id', purchaseId);
  await service.from('identity_profile').delete().eq('email', user.email);
  await service.from('person').delete().eq('email', user.email);
  if (user) await deleteFixtureUser(user);
  for (const ws of [wsA, wsB]) if (ws) await deleteThrowawayWorkspace(ws);
}, 120_000);

describe('the typed name is not thrown away', () => {
  it('an existing NAMELESS contact gets the name typed at the join', async () => {
    const { resolvePerson } = await import('../lib/resolve-person.js');
    const { data: nameless } = await service.from('person').insert({ workspace_id: wsA, email: user.email }).select('id').single();
    const r = await resolvePerson({ workspaceId: wsA, email: user.email, name: 'Marieke van Dam', source: 'membership_join', create: true, fillEmptyName: true });
    expect(r).toMatchObject({ ok: true, created: false, personId: nameless!.id, firstName: 'Marieke' });
    const { data } = await service.from('person').select('first_name, last_name').eq('id', nameless!.id).single();
    expect(data).toEqual({ first_name: 'Marieke', last_name: 'van Dam' });
  });

  it('a NAMED contact keeps its name, whatever is typed', async () => {
    const { resolvePerson } = await import('../lib/resolve-person.js');
    await resolvePerson({ workspaceId: wsA, email: user.email, name: 'Someone Else', source: 'membership_join', create: true, fillEmptyName: true });
    const { data } = await service.from('person').select('first_name, last_name').eq('workspace_id', wsA).eq('email', user.email).single();
    expect(data).toEqual({ first_name: 'Marieke', last_name: 'van Dam' });
  });

  it('the platform profile gets a name only where it has none', async () => {
    const { fillEmptyPlatformName } = await import('../lib/identity-profile.js');
    await service.from('identity_profile').delete().eq('email', user.email);
    await fillEmptyPlatformName(user.email, 'Marieke van Dam');
    expect((await service.from('identity_profile').select('display_name').eq('email', user.email).single()).data).toEqual({ display_name: 'Marieke van Dam' });
    await fillEmptyPlatformName(user.email, 'Not Her');
    expect((await service.from('identity_profile').select('display_name').eq('email', user.email).single()).data).toEqual({ display_name: 'Marieke van Dam' });
  });
});

describe('my.thread → You', () => {
  it('shows the newest contact WITH a name, not a newer nameless one elsewhere', async () => {
    // A NEWER, nameless contact in another community — the case that blanked the page.
    await service.from('person').insert({ workspace_id: wsB, email: user.email });
    const r = await app.request('/api/v1/me/profile', { headers: { Authorization: `Bearer ${user.accessToken}` } });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await r.json()).toMatchObject({ first_name: 'Marieke', last_name: 'van Dam' });
  });

  it('shows the billing details of the last paid checkout, read-only', async () => {
    const appId = (await service.from('app').select('id').eq('slug', 'membership').single()).data!.id;
    const { data: p, error } = await service
      .from('purchase')
      .insert({
        workspace_id: wsA, app_id: appId, item_ref: `int-names-${Date.now()}`, item_label: 'Membership', payer_name: 'Marieke van Dam',
        payer_email: user.email, amount_cents: 36300, currency: 'EUR', method: 'stripe', status: 'paid', paid_at: new Date().toISOString(),
        billing: { company: 'Bandora BV', address: 'Street 1', postal_code: '1000 AA', city: 'Amsterdam', country: 'NL', tax_no: 'NL854383402B01' },
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    purchaseId = p!.id as string;
    const body = await (await app.request('/api/v1/me/profile', { headers: { Authorization: `Bearer ${user.accessToken}` } })).json();
    expect(body.billing_details).toEqual({ company: 'Bandora BV', address: 'Street 1', postal_code: '1000 AA', city: 'Amsterdam', country: 'NL', tax_no: 'NL854383402B01' });
  });
});
