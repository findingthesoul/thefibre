// The batched entitlement walk answers EXACTLY what the one-membership walk
// does — percentages AND `via` — before the money path is moved onto it.
//
// docs/handover-portal-entitlements-batching.md, step 2, and the coordinating
// session's condition: `teamCalendarEntitlements` decides the member price at
// enrol, so the old path is deleted only after this has run green on staging.
// `via` matters as much as the percentage: it is the grant a surface names
// when it says which promise a price came from.
//
// Every case is compared two ways: against the old walk, key by key, and
// against the answer written out by hand — a comparison alone passes just as
// well when both walks are wrong the same way.
//
// Cases (a throwaway workspace each for the two communities):
//   active, tier grant 100%                      → that calendar at 100
//   grace, tier 50% AND an included product 80%
//     reaching the SAME calendar                  → 80, via the product grant
//   tier 30% and a product 30% on one calendar    → the TIER's grant (tie rule)
//   no tier grant, a product bought outright 20%  → 20, via that product
//   lapsed, cancelled, no membership at all       → nothing
//   a second community                            → resolved in the same call
// (Two memberships for one person in one workspace cannot be written —
// membership_member is unique on (workspace_id, person_id) — so that shape
// is not a case.)
// …and the seeded staging fixture (Choir 100% via tier, Band 20% via product),
// when scripts/seed-upcoming-fixture.mjs has been run.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

type Ent = { teamId: string; pct: number; via: string };
type Key = { personId: string; workspaceId: string };

let ws1 = '';
let ws2 = '';
const team = { x: randomUUID(), y: randomUUID(), z: randomUUID(), w: randomUUID() };
const grant: Record<string, string> = {};
const person: Record<string, string> = {};
const expected = new Map<string, Ent[]>();
const keys: Key[] = [];
const k = (personId: string, workspaceId: string) => `${personId}|${workspaceId}`;

async function ins<T extends Record<string, unknown>>(table: string, row: T): Promise<string> {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.id as string;
}
const tierGrant = (ws: string, tier: string, teamId: string, pct: number) =>
  ins('membership_access_grant', { workspace_id: ws, tier_id: tier, kind: 'team_calendar', config: { team_id: teamId, discount_pct: pct } });
const productGrant = (ws: string, product: string, teamId: string, pct: number) =>
  ins('membership_access_grant', { workspace_id: ws, product_id: product, kind: 'team_calendar', config: { team_id: teamId, discount_pct: pct } });
const newPerson = (ws: string, name: string) =>
  ins('person', { workspace_id: ws, first_name: name, last_name: 'Entitled', email: `int-ent-${name.toLowerCase()}-${randomUUID().slice(0, 6)}@example.com` });
const member = (ws: string, personId: string, tierId: string, status: string) =>
  ins('membership_member', { workspace_id: ws, person_id: personId, tier_id: tierId, status });

beforeAll(async () => {
  ws1 = await createThrowawayWorkspace('entBatch1');
  ws2 = await createThrowawayWorkspace('entBatch2');

  const tierA = await ins('membership_tier', { workspace_id: ws1, name: 'A' });
  const tierB = await ins('membership_tier', { workspace_id: ws1, name: 'B' });
  const tierC = await ins('membership_tier', { workspace_id: ws1, name: 'C' });
  const tierD = await ins('membership_tier', { workspace_id: ws2, name: 'D' });

  grant.aX = await tierGrant(ws1, tierA, team.x, 100);
  // B: tier 50% and an included product 80% on Y — best percentage wins.
  grant.bY = await tierGrant(ws1, tierB, team.y, 50);
  const p1 = await ins('membership_product', { workspace_id: ws1, name: 'P1' });
  grant.p1Y = await productGrant(ws1, p1, team.y, 80);
  // B: tier 30% and an included product 30% on Z — the tier's grant wins.
  grant.bZ = await tierGrant(ws1, tierB, team.z, 30);
  const p2 = await ins('membership_product', { workspace_id: ws1, name: 'P2' });
  grant.p2Z = await productGrant(ws1, p2, team.z, 30);
  for (const p of [p1, p2]) {
    const { error } = await service.from('membership_tier_product').insert({ tier_id: tierB, product_id: p, optional: false });
    if (error) throw new Error(`tier product: ${error.message}`);
  }
  // C: nothing on the tier; P3 bought outright carries X at 20%.
  const p3 = await ins('membership_product', { workspace_id: ws1, name: 'P3' });
  grant.p3X = await productGrant(ws1, p3, team.x, 20);
  // D, in the second community: an included product carries W at 60%.
  const p4 = await ins('membership_product', { workspace_id: ws2, name: 'P4' });
  grant.p4W = await productGrant(ws2, p4, team.w, 60);
  {
    const { error } = await service.from('membership_tier_product').insert({ tier_id: tierD, product_id: p4, optional: false });
    if (error) throw new Error(`tier product D: ${error.message}`);
  }

  person.active = await newPerson(ws1, 'Active');
  await member(ws1, person.active, tierA, 'active');
  expected.set(k(person.active, ws1), [{ teamId: team.x, pct: 100, via: grant.aX }]);

  person.grace = await newPerson(ws1, 'Grace');
  await member(ws1, person.grace, tierB, 'grace');
  expected.set(k(person.grace, ws1), [
    { teamId: team.y, pct: 80, via: grant.p1Y },
    { teamId: team.z, pct: 30, via: grant.bZ },
  ]);

  person.bought = await newPerson(ws1, 'Bought');
  await member(ws1, person.bought, tierC, 'active');
  {
    const { error } = await service.from('membership_product_purchase').insert({
      workspace_id: ws1, person_id: person.bought, product_id: p3,
      stripe_session_id: `int-ent-${randomUUID()}`, amount_cents: 1000, status: 'paid',
    });
    if (error) throw new Error(`purchase: ${error.message}`);
  }
  expected.set(k(person.bought, ws1), [{ teamId: team.x, pct: 20, via: grant.p3X }]);

  person.lapsed = await newPerson(ws1, 'Lapsed');
  await member(ws1, person.lapsed, tierA, 'lapsed');
  expected.set(k(person.lapsed, ws1), []);

  person.cancelled = await newPerson(ws1, 'Cancelled');
  await member(ws1, person.cancelled, tierB, 'cancelled');
  expected.set(k(person.cancelled, ws1), []);

  person.none = await newPerson(ws1, 'None');
  expected.set(k(person.none, ws1), []);

  person.second = await newPerson(ws2, 'Second');
  await member(ws2, person.second, tierD, 'active');
  expected.set(k(person.second, ws2), [{ teamId: team.w, pct: 60, via: grant.p4W }]);

  for (const key of expected.keys()) {
    const [personId, workspaceId] = key.split('|');
    keys.push({ personId: personId!, workspaceId: workspaceId! });
  }
});

afterAll(async () => {
  for (const ws of [ws1, ws2].filter(Boolean)) {
    for (const table of ['membership_product_purchase', 'membership_member', 'membership_access_grant']) {
      await service.from(table).delete().eq('workspace_id', ws);
    }
    await deleteThrowawayWorkspace(ws);
  }
});

const sorted = (xs: Ent[]) => [...xs].sort((a, b) => a.teamId.localeCompare(b.teamId));

describe('the batched walk', () => {
  it('answers every case exactly as written out, pct AND via', async () => {
    const { teamCalendarEntitlementsFor } = await import('../lib/member-discount.js');
    const got = await teamCalendarEntitlementsFor(keys);
    for (const [key, want] of expected) {
      expect(sorted(got.get(key) ?? []), key).toEqual(sorted(want));
    }
  });

  it('answers exactly what the one-membership walk answers, key by key', async () => {
    const { teamCalendarEntitlements, teamCalendarEntitlementsFor } = await import('../lib/member-discount.js');
    const batched = await teamCalendarEntitlementsFor(keys);
    for (const key of keys) {
      const old = await teamCalendarEntitlements(key.personId, key.workspaceId);
      expect(sorted(batched.get(k(key.personId, key.workspaceId)) ?? []), k(key.personId, key.workspaceId)).toEqual(sorted(old));
    }
  });

  it('answers each key the same alone as in a crowd', async () => {
    const { teamCalendarEntitlementsFor } = await import('../lib/member-discount.js');
    const crowd = await teamCalendarEntitlementsFor(keys);
    for (const key of keys) {
      const alone = await teamCalendarEntitlementsFor([key]);
      const id = k(key.personId, key.workspaceId);
      expect(sorted(alone.get(id) ?? [])).toEqual(sorted(crowd.get(id) ?? []));
    }
  });

  it('agrees with the old walk on the seeded staging fixture (Choir 100% via tier, Band 20% via product)', async () => {
    const { data: people, error } = await service
      .from('person')
      .select('id, workspace_id')
      .eq('email', 'upcoming-fixture@example.com')
      .is('deleted_at', null);
    if (error) throw new Error(error.message);
    const fixtureKeys = (people ?? []).map((p) => ({ personId: p.id as string, workspaceId: p.workspace_id as string }));
    if (!fixtureKeys.length) {
      console.warn('[entitlements-batched] seeded fixture absent: run scripts/seed-upcoming-fixture.mjs to include it');
      return;
    }
    const { teamCalendarEntitlements, teamCalendarEntitlementsFor } = await import('../lib/member-discount.js');
    const batched = await teamCalendarEntitlementsFor(fixtureKeys);
    const pcts: number[] = [];
    for (const key of fixtureKeys) {
      const old = await teamCalendarEntitlements(key.personId, key.workspaceId);
      const id = k(key.personId, key.workspaceId);
      expect(sorted(batched.get(id) ?? []), id).toEqual(sorted(old));
      pcts.push(...old.map((e) => e.pct));
    }
    // Non-empty, said out loud: a fixture that lost its grants would make
    // both walks answer [] and this test pass about nothing.
    expect(pcts.sort((a, b) => a - b)).toEqual([20, 100]);
  });
});
