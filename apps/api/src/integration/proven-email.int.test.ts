// Who a proven email may act for, against real Postgres.
//
// The rule has one load-bearing half and one convenient half, and only the
// load-bearing one is a security property:
//
//   convenient  — a VERIFIED contact point reaches its person, so merging two
//                 records of one human does not lock the losing address out
//                 of its own portal.
//   LOAD-BEARING — an UNVERIFIED contact point reaches nothing. A contact
//                 point is ordinary curator data: any organiser can type any
//                 address onto any contact. If typing one granted portal
//                 access, typing `someone@else.com` onto a contact would hand
//                 whoever reads that mailbox their invoices and enrolments.
//
// A test that only proved the first half would pass just as happily against
// an implementation that forgot the `verified_at` clause entirely, which is
// exactly the bug worth catching — so the unverified case is asserted first
// and asserted hardest.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createThrowawayWorkspace,
  deleteThrowawayWorkspace,
  service,
} from './staging.js';
import { markEmailProven, personIdsForProvenEmail } from '../lib/proven-email.js';

let ws: string;
const madePeople: string[] = [];

beforeAll(async () => {
  ws = await createThrowawayWorkspace('proven-email');
});

afterAll(async () => {
  if (madePeople.length) {
    await service.from('person_contact_point').delete().in('person_id', madePeople);
    await service.from('person').delete().in('id', madePeople);
  }
  if (ws) await deleteThrowawayWorkspace(ws);
});

async function makePerson(email: string | null): Promise<string> {
  const { data, error } = await service
    .from('person')
    .insert({ workspace_id: ws, first_name: 'Proven', last_name: 'Probe', email })
    .select('id')
    .single();
  if (error) throw new Error(`person fixture: ${error.message}`);
  madePeople.push(data!.id as string);
  return data!.id as string;
}

describe('personIdsForProvenEmail', () => {
  it('does NOT reach a person through an UNVERIFIED contact point', async () => {
    const stranger = `stranger-${randomUUID().slice(0, 8)}@example.com`;
    const victim = await makePerson(`victim-${randomUUID().slice(0, 8)}@example.com`);

    // Exactly what an organiser typing an address onto a contact produces.
    const { error } = await service
      .from('person_contact_point')
      .insert({ workspace_id: ws, person_id: victim, kind: 'email', value: stranger, label: 'work' });
    expect(error).toBeNull();

    const reached = await personIdsForProvenEmail(stranger);
    expect(reached).not.toContain(victim);
    expect(reached).toEqual([]);
  });

  it('reaches a person through a contact point once it is PROVEN', async () => {
    const addr = `proven-${randomUUID().slice(0, 8)}@example.com`;
    // A person whose OWN email is something else — the merged case: the
    // address that lost now lives only as a contact point.
    const merged = await makePerson(`kept-${randomUUID().slice(0, 8)}@example.com`);
    await service
      .from('person_contact_point')
      .insert({ workspace_id: ws, person_id: merged, kind: 'email', value: addr, label: 'private' });

    // Before proving: nothing. This is the lockout being reproduced.
    expect(await personIdsForProvenEmail(addr)).toEqual([]);

    // Signing in with it is what proves it.
    await markEmailProven(addr);

    expect(await personIdsForProvenEmail(addr)).toContain(merged);
  });

  it('still reaches a person by their own email, merge or no merge', async () => {
    const addr = `own-${randomUUID().slice(0, 8)}@example.com`;
    const p = await makePerson(addr);
    expect(await personIdsForProvenEmail(addr)).toContain(p);
  });

  it('reaches EVERY person row carrying the proven address', async () => {
    // One human is a person row in every workspace that knows them, and the
    // portal answers across all of them. A rule that stopped at the first
    // match would silently hide one community's records.
    const addr = `both-${randomUUID().slice(0, 8)}@example.com`;
    const direct = await makePerson(addr);
    const viaPoint = await makePerson(`other-${randomUUID().slice(0, 8)}@example.com`);
    await service
      .from('person_contact_point')
      .insert({ workspace_id: ws, person_id: viaPoint, kind: 'email', value: addr, label: 'work' });
    await markEmailProven(addr);

    const reached = await personIdsForProvenEmail(addr);
    expect(reached).toContain(direct);
    expect(reached).toContain(viaPoint);
  });

  it('does not reach a soft-deleted person', async () => {
    // Forgotten is forgotten: an erasure must not be undone by the fact that
    // the address was once proven.
    const addr = `gone-${randomUUID().slice(0, 8)}@example.com`;
    const p = await makePerson(`kept2-${randomUUID().slice(0, 8)}@example.com`);
    await service
      .from('person_contact_point')
      .insert({ workspace_id: ws, person_id: p, kind: 'email', value: addr, label: 'other' });
    await markEmailProven(addr);
    expect(await personIdsForProvenEmail(addr)).toContain(p);

    await service.from('person').update({ deleted_at: new Date().toISOString() }).eq('id', p);
    expect(await personIdsForProvenEmail(addr)).not.toContain(p);
  });

  // The scenario in Sjoerd's words — "community members see each other" —
  // reproduced with a REAL merge rather than by hand-placing a contact point.
  // Everything above tests the rule; this tests that the rule meets the event
  // that triggers it. Without it I would be asserting my own model of what a
  // merge does, which is the thing that was wrong this morning.
  it('after a REAL merge, the address that lost still reaches the person', async () => {
    const kept = `kept-${randomUUID().slice(0, 8)}@example.com`;
    const lost = `lost-${randomUUID().slice(0, 8)}@example.com`;
    const keeper = await makePerson(kept);
    const loser = await makePerson(lost);

    // Both addresses were proven — both are real sign-in identities, which is
    // how one human ends up with two records in the first place.
    await markEmailProven(kept);
    await markEmailProven(lost);
    expect(await personIdsForProvenEmail(lost)).toContain(loser);

    const { error } = await service.rpc('merge_person', {
      p_keep: keeper,
      p_merge: loser,
      p_actor: null,
    });
    expect(error).toBeNull();

    // The losing address now belongs to nobody's `person.email` — the merge
    // moved it to email_secondary and its contact point onto the keeper. The
    // portal must still find the person.
    const reached = await personIdsForProvenEmail(lost);
    expect(reached).toContain(keeper);
    // And not the merged-away row, which is soft-deleted.
    expect(reached).not.toContain(loser);
  });

  it('markEmailProven is idempotent and never un-verifies', async () => {
    const addr = `idem-${randomUUID().slice(0, 8)}@example.com`;
    const p = await makePerson(`kept3-${randomUUID().slice(0, 8)}@example.com`);
    await service
      .from('person_contact_point')
      .insert({ workspace_id: ws, person_id: p, kind: 'email', value: addr, label: 'work' });

    await markEmailProven(addr);
    const first = (
      await service
        .from('person_contact_point')
        .select('verified_at')
        .eq('person_id', p)
        .eq('value', addr)
        .single()
    ).data!.verified_at as string;

    await markEmailProven(addr);
    const second = (
      await service
        .from('person_contact_point')
        .select('verified_at')
        .eq('person_id', p)
        .eq('value', addr)
        .single()
    ).data!.verified_at as string;

    // Unchanged: the second call must not move the timestamp, or every portal
    // visit would rewrite the row and "when was this proven" would mean
    // "when was it last looked at".
    expect(second).toBe(first);
  });
});
