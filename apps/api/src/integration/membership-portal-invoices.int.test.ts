// A member's invoices as the MEMBERSHIP portal lists them — per membership.
//
// There are two member-facing invoice lists, and they disagreed. The
// cross-app one (`GET /me/invoices`, portal-invoices.int.test.ts) has always
// matched BOTH ledger keys — person_id and payer_email — because `purchase`
// is a dual-key table: a row written before a person existed carries the
// payer's email and no person id, and a row an organiser typed carries a
// person id and no email. This one matched person_id ONLY, so the same money
// was visible in one list and absent from the other.
//
// That shape is exactly what the membership join writes when somebody pays
// first and gets an account second, which is the ordinary case for a public
// join page. So the missing row was not hypothetical.
//
// Found on 2026-10-13 while proving a reported missing invoice was NOT this
// route's fault. It was not — the reported row carried both keys — but the
// hole was there, one query away, and a ledger that answers "what did I pay"
// two different ways depending on which page asks is the bug whether or not
// anybody has hit it yet.

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
let memberId = '';
let tierId = '';
let membershipAppId = '';
const tag = randomUUID().slice(0, 8);
const ids: Record<string, string> = {};

type Item = { id: string; item_label: string; amount_cents: number; status: string };

/** The list the membership portal renders, for this member. */
const mine = async (member = memberId): Promise<Item[]> => {
  const r = await app.request(
    `/api/v1/membership/portal/me/invoices?member_id=${encodeURIComponent(member)}`,
    { headers: { Authorization: `Bearer ${me.accessToken}`, 'X-App-ID': 'membership' } },
  );
  expect(r.status, await r.clone().text()).toBe(200);
  return ((await r.json()) as { items: Item[] }).items;
};

/** A membership purchase with whichever of the two keys the case needs. */
async function purchase(label: string, personId: string | null, payerEmail: string | null) {
  const { data, error } = await service
    .from('purchase')
    .insert({
      workspace_id: ws,
      app_id: membershipAppId,
      person_id: personId,
      payer_name: 'Fixture Member',
      payer_email: payerEmail,
      item_label: `membership ${label}`,
      item_ref: `int-mpi-${label}-${tag}`,
      amount_cents: 30000,
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
  const { membershipPortalRoutes } = await import('../routes/membership-portal.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/membership/portal', membershipPortalRoutes);
  app.route('/api/v1', v1);

  const { data: appRow, error: aErr } = await service
    .from('app')
    .select('id')
    .eq('slug', 'membership')
    .single();
  if (aErr) throw new Error(`membership app row: ${aErr.message}`);
  membershipAppId = appRow!.id as string;

  ws = await createThrowawayWorkspace('membership-portal-invoices');
  me = await createFixtureUser(ws, 'mpi');

  // The person carrying the same verified email the token presents — which
  // is what `ownedMember` checks before the ledger is touched at all.
  const { data: person, error: pErr } = await service
    .from('person')
    .insert({ workspace_id: ws, first_name: 'Fixture', last_name: 'Member', email: me.email })
    .select('id')
    .single();
  if (pErr) throw new Error(`person: ${pErr.message}`);
  myPersonId = person!.id as string;

  const { data: tier, error: tErr } = await service
    .from('membership_tier')
    .insert({ workspace_id: ws, name: 'Community member' })
    .select('id')
    .single();
  if (tErr) throw new Error(`tier: ${tErr.message}`);
  tierId = tier!.id as string;

  const { data: member, error: mErr } = await service
    .from('membership_member')
    .insert({
      workspace_id: ws,
      person_id: myPersonId,
      tier_id: tierId,
      status: 'active',
    })
    .select('id')
    .single();
  if (mErr) throw new Error(`member: ${mErr.message}`);
  memberId = member!.id as string;

  // Somebody else in the same workspace, with their own membership money.
  const strangerEmail = `int-mpi-stranger-${tag}@example.com`;
  const { data: stranger, error: sErr } = await service
    .from('person')
    .insert({ workspace_id: ws, first_name: 'Someone', last_name: 'Else', email: strangerEmail })
    .select('id')
    .single();
  if (sErr) throw new Error(`stranger: ${sErr.message}`);

  await purchase('by-person', myPersonId, null); //      person_id only
  await purchase('by-email', null, me.email); //         payer_email only — the hole
  await purchase('stranger', stranger!.id as string, strangerEmail);
}, 180_000);

afterAll(async () => {
  await service.from('purchase').delete().eq('workspace_id', ws);
  await service.from('membership_member').delete().eq('workspace_id', ws);
  await service.from('membership_tier').delete().eq('workspace_id', ws);
  await service.from('person').delete().eq('workspace_id', ws);
  if (me) await deleteFixtureUser(me);
  await deleteThrowawayWorkspace(ws);
}, 180_000);

describe('the membership portal’s invoice list', () => {
  it('finds the row that carries only a person_id', async () => {
    expect((await mine()).map((i) => i.id)).toContain(ids['by-person']);
  });

  // THE case this file was written for. Red before 2026-10-13: the route
  // filtered on person_id alone, so a membership paid for before the person
  // row existed was invisible to the person who paid for it.
  it('finds the row that carries only the payer’s email', async () => {
    const items = await mine();
    expect(
      items.map((i) => i.id),
      `got ${JSON.stringify(items.map((i) => i.item_label))}`,
    ).toContain(ids['by-email']);
  });

  it('never returns another person’s invoice', async () => {
    const items = await mine();
    expect(items.map((i) => i.id)).not.toContain(ids['stranger']);
    expect(items).toHaveLength(2);
  });

  // Both keys can match the same row; it must appear once. (Merged by id —
  // the cross-app list has the same rule.)
  it('lists a row carrying BOTH keys exactly once', async () => {
    await purchase('both', myPersonId, me.email);
    const items = await mine();
    expect(items.filter((i) => i.id === ids['both'])).toHaveLength(1);
    await service.from('purchase').delete().eq('id', ids['both']);
  });

  it('newest first', async () => {
    const items = await mine();
    const dates = items.map((i) => (i as unknown as { created_at: string }).created_at);
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates);
  });

  // Ownership is proven BEFORE the ledger is touched, and it is proven on the
  // member, not on the email alone: somebody else's membership id presented
  // with a valid session is a 404, not somebody else's money.
  it('refuses a membership that is not this person’s', async () => {
    const { data: other, error } = await service
      .from('membership_member')
      .insert({
        workspace_id: ws,
        person_id: (
          await service.from('person').select('id').eq('workspace_id', ws).neq('id', myPersonId).limit(1).single()
        ).data!.id,
        tier_id: tierId,
        status: 'active',
      })
      .select('id')
      .single();
    if (error) throw new Error(`other member: ${error.message}`);
    const r = await app.request(
      `/api/v1/membership/portal/me/invoices?member_id=${other!.id}`,
      { headers: { Authorization: `Bearer ${me.accessToken}`, 'X-App-ID': 'membership' } },
    );
    expect(r.status).toBe(404);
    await service.from('membership_member').delete().eq('id', other!.id as string);
  });

  it('refuses without a session at all', async () => {
    const r = await app.request(`/api/v1/membership/portal/me/invoices?member_id=${memberId}`, {
      headers: { 'X-App-ID': 'membership' },
    });
    expect(r.status).toBe(401);
  });
});
