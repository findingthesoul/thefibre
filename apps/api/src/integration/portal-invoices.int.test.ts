// A member's own invoices — and nobody else's.
//
// This is the surface where a participant reads their own money. The API
// bypasses RLS here (adminClient), so the EMAIL FILTER IS THE MODEL: whatever
// this route returns is what somebody sees, and there is no second gate
// behind it. The deep link /purchases/<id> in my.thread has no ownership rule
// of its own by design — it opens the list this route returns and finds the
// id in it or does not — which puts the whole of that decision here.
//
// So the case that matters is the third one: another person's invoice must
// not be in the list, because if it is, a forwarded link opens it.
//
// `purchase` is a DUAL-KEY table (docs: ledger identity, two keys). A row
// written before a person existed carries an email and no person_id; a row an
// organiser typed carries a person_id and may carry no email. Both are
// matched, and the first two cases prove each key alone would drop rows.

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
let ws = '';
let me: FixtureUser;
let myPersonId = '';
const tag = randomUUID().slice(0, 8);
const strangerEmail = `int-inv-stranger-${tag}@example.com`;
const ids: Record<string, string> = {};

type Item = {
  id: string;
  item_label: string;
  seller: { legal_name?: string } | null;
  method: string;
  payer_name: string;
  status: string;
};

const mine = async (): Promise<Item[]> => {
  const r = await app.request('/api/v1/me/invoices', {
    headers: { Authorization: `Bearer ${me.accessToken}`, 'X-App-ID': 'fibre-platform' },
  });
  expect(r.status, await r.clone().text()).toBe(200);
  return ((await r.json()) as { items: Item[] }).items;
};

async function purchase(label: string, personId: string | null, payerEmail: string | null) {
  const { data: appRow } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  const { data, error } = await service
    .from('purchase')
    .insert({
      workspace_id: ws,
      app_id: appRow!.id,
      person_id: personId,
      payer_name: 'Fixture Payer',
      payer_email: payerEmail,
      item_label: label,
      item_ref: `int-inv-${label}-${tag}`,
      amount_cents: 2500,
      currency: 'EUR',
      method: 'invoice',
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw new Error(`purchase ${label}: ${error.message}`);
  ids[label] = data!.id as string;
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { portalRoutes } = await import('../routes/portal.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/me', portalRoutes);
  app.route('/api/v1', v1);

  ws = await createThrowawayWorkspace('portal-invoices');
  me = await createFixtureUser(ws, 'inv');

  // A person carrying the SAME verified email the token will present.
  const { data: person, error } = await service
    .from('person')
    .insert({ workspace_id: ws, first_name: 'Fixture', last_name: 'Payer', email: me.email })
    .select('id')
    .single();
  if (error) throw new Error(`person: ${error.message}`);
  myPersonId = person!.id as string;

  // Somebody else entirely.
  const { data: stranger } = await service
    .from('person')
    .insert({ workspace_id: ws, first_name: 'Someone', last_name: 'Else', email: strangerEmail })
    .select('id')
    .single();

  // The seller's invoicing identity, so the From block has something to be.
  await service
    .from('workspace')
    .update({ invoice_details: { legal_name: 'Fixture Seller BV', address: 'Somewhere 1' } })
    .eq('id', ws);

  await purchase('by-person', myPersonId, null); // person_id only
  await purchase('by-email', null, me.email); //    payer_email only
  await purchase('stranger', stranger!.id as string, strangerEmail);
}, 120_000);

afterAll(async () => {
  await service.from('purchase').delete().eq('workspace_id', ws);
  await service.from('person').delete().eq('workspace_id', ws);
  if (me) await deleteFixtureUser(me);
  await deleteThrowawayWorkspace(ws);
}, 120_000);

describe('a member’s own invoices', () => {
  it('finds the row that carries only a person_id', async () => {
    expect((await mine()).map((i) => i.id)).toContain(ids['by-person']);
  });

  it('finds the row that carries only a payer_email', async () => {
    expect((await mine()).map((i) => i.id)).toContain(ids['by-email']);
  });

  // THE case. If this goes red, a forwarded /purchases/<id> opens somebody
  // else's invoice.
  it('never returns another person’s invoice', async () => {
    const items = await mine();
    expect(items.map((i) => i.id), JSON.stringify(items.map((i) => i.item_label))).not.toContain(
      ids['stranger'],
    );
    expect(items).toHaveLength(2);
  });

  it('refuses without a session at all', async () => {
    const r = await app.request('/api/v1/me/invoices', { headers: { 'X-App-ID': 'fibre-platform' } });
    expect(r.status).toBe(401);
  });

  // The document needs these to render; without them the dialog opens on a
  // blank invoice, which is worse than the list it replaced.
  it('carries what the invoice document needs', async () => {
    const row = (await mine()).find((i) => i.id === ids['by-person'])!;
    expect(row.method).toBe('invoice');
    expect(row.payer_name).toBe('Fixture Payer');
    expect(row.status).toBe('paid');
  });

  it('names the seller, from the same resolver the PDF and the email use', async () => {
    const row = (await mine()).find((i) => i.id === ids['by-person'])!;
    expect(row.seller?.legal_name).toBe('Fixture Seller BV');
  });

  // Whose user id ran the sale is the workspace's business, not the buyer's.
  it('never leaks the organiser behind the sale', async () => {
    const r = await app.request('/api/v1/me/invoices', {
      headers: { Authorization: `Bearer ${me.accessToken}`, 'X-App-ID': 'fibre-platform' },
    });
    expect(await r.text()).not.toContain('organiser_user_id');
  });
});
