// A merge must not assume a child table's key is called `id`.
//
// PRODUCTION, 2026-10-12. Sjoerd merged two organisations with per-field
// answers and got `column "id" does not exist`; nothing merged, because a
// raising plpgsql function takes its whole statement with it. The cause:
// the FK loop asked the catalogue whether a child had a SINGLE-COLUMN primary
// key and then wrote the column's NAME itself —
//
//     update %s set %I = $1 where %I = $2 and id = $3
//
// — and `public.org_domain_verification` is keyed `org_id`. The merged
// organisation had a row in it: a DNS challenge for "Dewerkhaven.nl", started
// three weeks earlier.
//
// THE STAGING FIXTURE PAIR HAD NO SUCH ROW, which is the whole reason the
// browser pack and the existing merge tests passed. So this test builds the
// real pair's shape, measured on production before it was written: the merged
// organisation carries SIX org_membership rows and ONE
// org_domain_verification row, and the keeper carries one membership and no
// verification.
//
// Both halves of the conflict are covered, because they take different
// branches: with no row on the keeper the row MOVES (the key changes, since
// the key IS the foreign key), and with a row on both the move raises a
// unique violation, the keeper's row stays, and the merged one is recorded
// whole so the undo can put it back.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createThrowawayWorkspace,
  deleteThrowawayWorkspace,
  service,
} from './staging.js';

let ws = '';
const orgs: string[] = [];
const people: string[] = [];

async function makeOrg(name: string, fields: Record<string, unknown> = {}) {
  const { data, error } = await service
    .from('organisation')
    .insert({ workspace_id: ws, name, ...fields })
    .select('id')
    .single();
  if (error) throw new Error(`fixture organisation: ${error.message}`);
  orgs.push(data!.id as string);
  return data!.id as string;
}

async function makePerson(first: string) {
  const { data, error } = await service
    .from('person')
    .insert({ workspace_id: ws, first_name: first, last_name: 'Werkhaven-fixture' })
    .select('id')
    .single();
  if (error) throw new Error(`fixture person: ${error.message}`);
  people.push(data!.id as string);
  return data!.id as string;
}

async function challenge(orgId: string, domain: string) {
  const { error } = await service
    .from('org_domain_verification')
    .insert({ org_id: orgId, workspace_id: ws, domain, challenge: `e2e-${domain}` });
  if (error) throw new Error(`fixture domain challenge: ${error.message}`);
}

async function membership(orgId: string, personId: string) {
  const { error } = await service
    .from('org_membership')
    // org_membership carries NO workspace_id — it is scoped through the
    // organisation. Asked the schema rather than assuming the column, after
    // writing it wrong once.
    .insert({ org_id: orgId, person_id: personId });
  if (error) throw new Error(`fixture membership: ${error.message}`);
}

async function mergeOrgs(keep: string, merge: string, choices?: Record<string, string>) {
  return service.rpc('merge_organisation', {
    p_keep: keep,
    p_merge: merge,
    p_actor: null,
    ...(choices ? { p_choices: choices } : {}),
  });
}

beforeAll(async () => {
  ws = await createThrowawayWorkspace('mergekeys');
}, 120_000);

afterAll(async () => {
  if (ws) {
    await service.from('organisation_merge').delete().eq('workspace_id', ws);
    await service.from('org_domain_verification').delete().eq('workspace_id', ws);
    if (orgs.length) await service.from('org_membership').delete().in('org_id', orgs);
    if (orgs.length) await service.from('organisation').delete().in('id', orgs);
    if (people.length) await service.from('person').delete().in('id', people);
    await deleteThrowawayWorkspace(ws);
  }
}, 120_000);

describe('merge_organisation with a child keyed on something other than id', () => {
  it('merges a pair shaped like the production one, and moves the challenge', async () => {
    const keep = await makeOrg('De Fixture', { domain: 'defixture.nl' });
    const merge = await makeOrg('De Fixture coöperatie U.A.', {
      domain: 'Defixture.nl',
      city: 'Zierikzee',
    });
    // The production pair: six people on the merged row, one on the keeper.
    await membership(keep, await makePerson('Keeper'));
    for (const n of [1, 2, 3, 4, 5, 6]) await membership(merge, await makePerson(`Member${n}`));
    // And the row that broke it. ONLY on the merged organisation, which is
    // how it was on production.
    await challenge(merge, 'Defixture.nl');

    // Per-field answers, as he used: take the name from the merged row and
    // keep the keeper's domain.
    const { error } = await mergeOrgs(keep, merge, { name: 'merge', domain: 'keep' });
    // THE ASSERTION THAT FAILS ON TODAY'S FUNCTION, with that exact message.
    expect(error?.message ?? null).toBeNull();

    const { data: survivors } = await service
      .from('org_membership')
      .select('org_id')
      .in('org_id', [keep, merge]);
    expect(
      (survivors ?? []).filter((r) => r.org_id === keep).length,
      'all seven memberships hang off the keeper',
    ).toBe(7);
    expect((survivors ?? []).filter((r) => r.org_id === merge).length).toBe(0);

    // The challenge moved, which is what a key that IS the foreign key does.
    const { data: dv } = await service
      .from('org_domain_verification')
      .select('org_id, domain')
      .in('org_id', [keep, merge]);
    expect(dv, 'one challenge, now the keeper’s').toHaveLength(1);
    expect(dv![0]!.org_id).toBe(keep);

    const { data: kept } = await service
      .from('organisation')
      .select('name, domain, deleted_at, merged_into')
      .eq('id', keep)
      .single();
    expect(kept!.name, 'the name he took from the other row').toBe('De Fixture coöperatie U.A.');
    expect(kept!.domain, 'the domain he kept').toBe('defixture.nl');
    expect(kept!.deleted_at).toBeNull();

    const { data: gone } = await service
      .from('organisation')
      .select('deleted_at, merged_into')
      .eq('id', merge)
      .single();
    expect(gone!.deleted_at).not.toBeNull();
    expect(gone!.merged_into).toBe(keep);
  }, 120_000);

  it('when BOTH have a challenge, the keeper keeps its own and undo restores the other', async () => {
    const keep = await makeOrg('Both Sides', { domain: 'bothsides.nl' });
    const merge = await makeOrg('Both Sides B.V.', { domain: 'bothsides.com' });
    await challenge(keep, 'bothsides.nl');
    await challenge(merge, 'bothsides.com');

    const { data: mergeId, error } = await mergeOrgs(keep, merge);
    expect(error?.message ?? null).toBeNull();

    // The keeper's own answer survives; only one row can exist per org.
    const { data: dv } = await service
      .from('org_domain_verification')
      .select('org_id, domain')
      .in('org_id', [keep, merge]);
    expect(dv).toHaveLength(1);
    expect(dv![0]!.org_id).toBe(keep);
    expect(dv![0]!.domain, 'the keeper’s domain, not the merged row’s').toBe('bothsides.nl');

    // And the undo puts the dropped one back, which is the reason it was
    // recorded whole rather than deleted and forgotten.
    const { error: undoErr } = await service.rpc('unmerge_organisation', {
      p_merge_id: mergeId as string,
      p_actor: null,
    });
    expect(undoErr?.message ?? null).toBeNull();

    const { data: after } = await service
      .from('org_domain_verification')
      .select('org_id, domain')
      .in('org_id', [keep, merge]);
    expect(after, 'both challenges exist again').toHaveLength(2);
    expect(
      (after ?? []).find((r) => r.org_id === merge)?.domain,
      'the merged row’s challenge is back on the merged row',
    ).toBe('bothsides.com');
  }, 120_000);

  it('undo moves a MOVED challenge back, though the move changed its key', async () => {
    const keep = await makeOrg('Mover', { domain: 'mover.nl' });
    const merge = await makeOrg('Mover B.V.', { domain: 'mover.com' });
    await challenge(merge, 'mover.com');

    const { data: mergeId, error } = await mergeOrgs(keep, merge);
    expect(error?.message ?? null).toBeNull();

    const { error: undoErr } = await service.rpc('unmerge_organisation', {
      p_merge_id: mergeId as string,
      p_actor: null,
    });
    expect(undoErr?.message ?? null).toBeNull();

    const { data: after } = await service
      .from('org_domain_verification')
      .select('org_id, domain')
      .in('org_id', [keep, merge]);
    expect(after, 'still one challenge').toHaveLength(1);
    expect(
      after![0]!.org_id,
      'back on the organisation it belonged to — the audit row had to carry the KEY, not just the ids',
    ).toBe(merge);
  }, 120_000);
});
