// Where a thread's money goes — against staging, through the real routes.
//
// Sjoerd, 2026-10-16: "Payment, by default to the organiser. Not to the
// workspace. And before going live, a check screen would be nice."
//   · a NEW thread made in the editor pays its organiser, whatever its scope
//     (the column default, migration 20261015070231);
//   · GET /threads/:id/payment-route answers what a real payment would do:
//     the card account the enrol route charges (threadDestinationAccount),
//     labelled by whose it is, and the seller an invoice is issued under;
//   · a free thread has nothing to check.

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
let ws = '';
let organiser: FixtureUser;
let teamId = '';
let threadId = '';
const ORG_ACCT = `acct_fixtureorg${randomUUID().slice(0, 6)}`;
const WS_ACCT = `acct_fixturews${randomUUID().slice(0, 6)}`;
const made: { table: string; id: string }[] = [];

const call = (path: string, init: RequestInit = {}) =>
  app.request(`/api/v1/thread${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${organiser.accessToken}`, 'X-App-ID': 'the-thread', 'Content-Type': 'application/json' },
  });

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { threadRoutes } = await import('../routes/thread.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/thread', threadRoutes);
  app.route('/api/v1', v1);

  const threadAppId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id;
  ws = await createThrowawayWorkspace('payroute');
  organiser = await createFixtureUser(ws, 'payroute');
  await service.from('workspace_member').upsert({ workspace_id: ws, user_id: organiser.userId, workspace_role: 'admin' });
  await service.from('app_membership').upsert({ user_id: organiser.userId, app_id: threadAppId, role: 'admin' }, { onConflict: 'user_id,app_id' });
  await service.from('workspace_app').upsert({ workspace_id: ws, app_id: threadAppId }, { onConflict: 'workspace_id,app_id' });
  const { error: subErr } = await service.from('workspace_subscription').upsert({ workspace_id: ws, plan_id: 'pro', status: 'active' }, { onConflict: 'workspace_id' });
  if (subErr) throw new Error(`subscription fixture: ${subErr.message}`);
  // Two connected accounts (fixture ids; Stripe does not know them, so no
  // display name comes back — the owner label is what is checked).
  await service.from('workspace').update({ stripe_account_id: WS_ACCT, name: 'Payroute Workspace' }).eq('id', ws);
  await service.from('user_profile').upsert({ user_id: organiser.userId, stripe_account_id: ORG_ACCT, display_name: 'Olga Organiser' }, { onConflict: 'user_id' });
  await service.from('thread_organiser').insert({ user_id: organiser.userId, workspace_id: ws, slug: `payroute-${randomUUID().slice(0, 6)}`, display_name: 'Olga Organiser' });
  const { data: team } = await service.from('team').insert({ workspace_id: ws, name: 'Choir', slug: `payroute-team-${randomUUID().slice(0, 6)}` }).select('id').single();
  teamId = team!.id as string;
  made.push({ table: 'team', id: teamId });
}, 180_000);

afterAll(async () => {
  if (threadId) {
    await service.from('thread_ticket').delete().eq('thread_id', threadId);
    await service.from('thread_engagement').delete().eq('thread_id', threadId);
    const { data } = await service.from('thread_thread').select('program_id').eq('id', threadId).maybeSingle();
    await service.from('thread_thread').delete().eq('id', threadId);
    if (data?.program_id) await service.from('program').delete().eq('id', data.program_id);
  }
  await service.from('thread_organiser').delete().eq('user_id', organiser.userId);
  for (const { table, id } of made) await service.from(table).delete().eq('id', id);
  await service.from('user_profile').delete().eq('user_id', organiser.userId);
  await service.from('app_membership').delete().eq('user_id', organiser.userId);
  await service.from('workspace_member').delete().eq('user_id', organiser.userId);
  await deleteFixtureUser(organiser);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 180_000);

describe('where the money goes', () => {
  it('a NEW team-scope thread made in the editor pays its organiser', async () => {
    const res = await call('/threads', {
      method: 'POST',
      body: JSON.stringify({ title: 'Paid choir weekend', format: 'event', slug: `payroute-${randomUUID().slice(0, 6)}`, team_id: teamId, public_scope: 'team', library_template: null }),
    });
    expect(res.status, await res.clone().text()).toBe(201);
    threadId = (await res.json()).id;
    const { data } = await service.from('thread_thread').select('payment_destination, team_id').eq('id', threadId).single();
    expect(data).toEqual({ payment_destination: 'personal', team_id: teamId });
  });

  it('a free thread has nothing to check', async () => {
    await service.from('thread_thread').update({ price_cents: null }).eq('id', threadId);
    const res = await call(`/threads/${threadId}/payment-route`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ paid: false });
  });

  it('a paid thread: card to the ORGANISER, invoices by the seller an invoice would carry', async () => {
    await service.from('thread_thread').update({ price_cents: 4000, price_currency: 'EUR', payment_methods: ['stripe', 'invoice'] }).eq('id', threadId);
    const res = await call(`/threads/${threadId}/payment-route`);
    expect(res.status, await res.clone().text()).toBe(200);
    const body = await res.json();
    expect(body.paid).toBe(true);
    expect(body.card).toMatchObject({ owner: 'organiser', owner_name: 'Olga Organiser' });
    // The invoice seller IS sellerForSale's answer — the same function an
    // issued invoice uses.
    const { sellerForSale } = await import('../routes/purchases.js');
    const seller = await sellerForSale('the-thread', ws, organiser.userId);
    expect(body.invoice).toEqual({ seller_name: seller?.legal_name?.trim() || null });
  });

  it('pointed at the workspace, the card line says the workspace — the account the enrol route would charge', async () => {
    await service.from('thread_thread').update({ payment_destination: 'workspace' }).eq('id', threadId);
    const body = await (await call(`/threads/${threadId}/payment-route`)).json();
    expect(body.card).toMatchObject({ owner: 'workspace', owner_name: 'Payroute Workspace' });
    const { threadDestinationAccount } = await import('../lib/payment-accounts.js');
    expect(await threadDestinationAccount({ workspace_id: ws, team_id: teamId, payment_destination: 'workspace', organiser_user_id: organiser.userId })).toBe(WS_ACCT);
  });

  it('invoice only: no card line', async () => {
    await service.from('thread_thread').update({ payment_methods: ['invoice'] }).eq('id', threadId);
    const body = await (await call(`/threads/${threadId}/payment-route`)).json();
    expect(body.card).toBeNull();
    expect(body.invoice).not.toBeNull();
  });
});
