// A paid meeting type cannot be bookable without a way to take the money —
// against staging, through the real routes.
//
// Sjoerd, 2026-10-16, on whether Meet needs Thread's publish guard: "of
// course. No stripe, or invoice only." The rule is lib/meet-payment-route.ts;
// these cases pin each place that reads it:
//   · the editor's save (POST and PATCH) refuses, judged after the save;
//   · a save that changes none of price / methods / switched-on is never
//     refused — the editor sends every field on every save;
//   · switching a broken type OFF is always allowed;
//   · the public page answers booking_open: false;
//   · the public booking route refuses BEFORE a booking row exists.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import {
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  service,
  type FixtureUser,
} from './staging.js';

let app: Hono;
let workspaceId = '';
let user: FixtureUser;
let hostId = '';
const hostSlug = `int-paywall-${randomUUID().slice(0, 8)}`;
const tag = randomUUID().slice(0, 8);
const ACCT = `acct_fixturemeet${tag.slice(0, 6)}`;

const call = (path: string, init?: RequestInit) =>
  app.request(`/api/v1/meet${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      'X-App-ID': 'fibre-meet',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
const publicCall = (path: string, init?: RequestInit) =>
  app.request(`/api/v1/meet${path}`, { ...init, headers: { 'Content-Type': 'application/json' } });

const base = (slug: string) => ({ slug, name: 'Paid session', duration_minutes: 60 });

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { meetRoutes } = await import('../routes/meet.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/meet', meetRoutes);
  app.route('/api/v1', v1);

  workspaceId = await createThrowawayWorkspace('paywall');
  user = await createFixtureUser(workspaceId, 'paywall');
  const { error: wmErr } = await service
    .from('workspace_member')
    .insert({ workspace_id: workspaceId, user_id: user.userId, workspace_role: 'admin' });
  if (wmErr) throw new Error(`workspace_member: ${wmErr.message}`);
  const { data: appRow } = await service.from('app').select('id').eq('slug', 'fibre-meet').single();
  await service.from('workspace_app').upsert({ workspace_id: workspaceId, app_id: appRow!.id }, { onConflict: 'workspace_id,app_id' });
  const { error: amErr } = await service
    .from('app_membership')
    .upsert({ user_id: user.userId, app_id: appRow!.id, role: 'admin', is_direct: true }, { onConflict: 'user_id,app_id' });
  if (amErr) throw new Error(`app_membership: ${amErr.message}`);
  // The account default is card only, and there is no connected account.
  await service.from('user_profile').upsert({ user_id: user.userId, default_payment_methods: ['stripe'] }, { onConflict: 'user_id' });
  const { data: host, error: hErr } = await service
    .from('meet_host')
    .insert({ workspace_id: workspaceId, user_id: user.userId, slug: hostSlug, timezone: 'Europe/Amsterdam' })
    .select('id')
    .single();
  if (hErr) throw new Error(`meet_host: ${hErr.message}`);
  hostId = host!.id as string;
}, 90_000);

afterAll(async () => {
  await service.from('meet_booking').delete().eq('workspace_id', workspaceId);
  await service.from('meet_meeting_type').delete().eq('workspace_id', workspaceId);
  await service.from('meet_host').delete().eq('workspace_id', workspaceId);
  await service.from('user_profile').delete().eq('user_id', user.userId);
  await service.from('app_membership').delete().eq('user_id', user.userId);
  await service.from('workspace_member').delete().eq('user_id', user.userId);
  await service.from('workspace_app').delete().eq('workspace_id', workspaceId);
  if (user) await deleteFixtureUser(user);
  if (workspaceId) await deleteThrowawayWorkspace(workspaceId);
}, 90_000);

/** A type written straight to the table, as one that went live before the guard. */
async function legacyType(slug: string, over: Record<string, unknown> = {}) {
  const { data, error } = await service
    .from('meet_meeting_type')
    .insert({ workspace_id: workspaceId, host_id: hostId, ...base(slug), is_active: true, price_cents: 4000, price_currency: 'eur', payment_methods: ['stripe'], ...over })
    .select('id')
    .single();
  if (error) throw new Error(`legacy type: ${error.message}`);
  return data!.id as string;
}

describe('a paid meeting type needs a way to take the money', () => {
  it('creating one, card only with no connected account, is refused with the code the editor links from', async () => {
    const r = await call('/meeting-types', {
      method: 'POST',
      body: JSON.stringify({ ...base(`card-${tag}`), price_cents: 4000, price_currency: 'eur', payment_methods: ['stripe'] }),
    });
    expect(r.status, await r.clone().text()).toBe(409);
    expect(await r.json()).toMatchObject({ code: 'payment_route_missing' });
    const { count } = await service.from('meet_meeting_type').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('slug', `card-${tag}`);
    expect(count).toBe(0);
  });

  it('inheriting the card-only account default is refused the same way', async () => {
    const r = await call('/meeting-types', {
      method: 'POST',
      body: JSON.stringify({ ...base(`inherit-${tag}`), price_cents: 4000, price_currency: 'eur', payment_methods: null }),
    });
    expect(r.status).toBe(409);
  });

  it('with invoice allowed it is created', async () => {
    const r = await call('/meeting-types', {
      method: 'POST',
      body: JSON.stringify({ ...base(`inv-${tag}`), price_cents: 4000, price_currency: 'eur', payment_methods: ['invoice'] }),
    });
    expect(r.status, await r.clone().text()).toBe(201);
  });

  it('created switched OFF it is allowed — a draft needs no route yet', async () => {
    const r = await call('/meeting-types', {
      method: 'POST',
      body: JSON.stringify({ ...base(`off-${tag}`), price_cents: 4000, price_currency: 'eur', payment_methods: ['stripe'], is_active: false }),
    });
    expect(r.status, await r.clone().text()).toBe(201);
  });

  it('a free type needs nothing', async () => {
    const r = await call('/meeting-types', { method: 'POST', body: JSON.stringify({ ...base(`free-${tag}`), price_cents: 0 }) });
    expect(r.status).toBe(201);
  });

  it('switching the draft ON is refused, and nothing changes', async () => {
    const { data: mt } = await service.from('meet_meeting_type').select('id').eq('workspace_id', workspaceId).eq('slug', `off-${tag}`).single();
    const r = await call(`/meeting-types/${mt!.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: true }) });
    expect(r.status).toBe(409);
    const { data } = await service.from('meet_meeting_type').select('is_active').eq('id', mt!.id).single();
    expect(data!.is_active).toBe(false);
  });

  it('narrowing a live invoice type to card only is refused', async () => {
    const { data: mt } = await service.from('meet_meeting_type').select('id').eq('workspace_id', workspaceId).eq('slug', `inv-${tag}`).single();
    const r = await call(`/meeting-types/${mt!.id}`, { method: 'PATCH', body: JSON.stringify({ payment_methods: ['stripe'] }) });
    expect(r.status).toBe(409);
    const { data } = await service.from('meet_meeting_type').select('payment_methods').eq('id', mt!.id).single();
    expect(data!.payment_methods).toEqual(['invoice']);
  });

  it('a type that went live before the guard: a save that changes none of it goes through (the editor sends every field)', async () => {
    const id = await legacyType(`legacy-${tag}`);
    const r = await call(`/meeting-types/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Renamed', is_active: true, price_cents: 4000, payment_methods: ['stripe'] }),
    });
    expect(r.status, await r.clone().text()).toBe(200);
  });

  it('…and switching it off is always allowed', async () => {
    const { data: mt } = await service.from('meet_meeting_type').select('id').eq('workspace_id', workspaceId).eq('slug', `legacy-${tag}`).single();
    const r = await call(`/meeting-types/${mt!.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: false }) });
    expect(r.status).toBe(200);
  });

  it('the public page says booking is not open for a broken type, and open for an invoice one', async () => {
    await legacyType(`legacy2-${tag}`);
    const broken = await publicCall(`/public/host/${hostSlug}/mt/legacy2-${tag}`);
    expect(broken.status).toBe(200);
    expect((await broken.json()).meeting_type.booking_open).toBe(false);
    const ok = await publicCall(`/public/host/${hostSlug}/mt/inv-${tag}`);
    const okBody = await ok.json();
    expect(okBody.meeting_type.booking_open).toBe(true);
    expect(okBody.meeting_type.payment_methods).toEqual(['invoice']);
  });

  it('the public booking route refuses a broken type BEFORE any booking row exists', async () => {
    const { data: mt } = await service.from('meet_meeting_type').select('id').eq('workspace_id', workspaceId).eq('slug', `legacy2-${tag}`).single();
    const r = await publicCall('/public/bookings', {
      method: 'POST',
      body: JSON.stringify({
        meeting_type_id: mt!.id,
        invitee_email: `int-paywall-${tag}@example.com`,
        invitee_name: 'Guest',
        starts_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        request_id: `int-paywall-${tag}`,
      }),
    });
    expect(r.status, await r.clone().text()).toBe(409);
    expect(await r.json()).toMatchObject({ code: 'booking_not_open' });
    const { count } = await service.from('meet_booking').select('id', { count: 'exact', head: true }).eq('meeting_type_id', mt!.id);
    expect(count).toBe(0);
  });

  it('once the OWNER connects an account, card counts as a route', async () => {
    const { meetRouteProblem, MEET_NO_ROUTE_MESSAGE } = await import('../lib/meet-payment-route.js');
    const mt = { host_id: hostId, price_cents: 4000, payment_methods: ['stripe'], is_active: true };
    expect(await meetRouteProblem(mt, { assumePlatformKey: true })).toBe(MEET_NO_ROUTE_MESSAGE);
    await service.from('user_profile').update({ stripe_account_id: ACCT }).eq('user_id', user.userId);
    expect(await meetRouteProblem(mt, { assumePlatformKey: true })).toBeNull();
    // The booking route charges through the same lookup.
    const { personalStripeAccount } = await import('../lib/payment-accounts.js');
    expect(await personalStripeAccount(user.userId)).toBe(ACCT);
  });
});
