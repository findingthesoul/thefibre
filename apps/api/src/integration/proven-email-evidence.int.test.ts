// PROVING THE MAILBOX IS NOT PROVING THE PERSON (2026-10-17).
//
// A sign-in used to stamp verified_at on EVERY contact point holding the
// address, so an address an organiser typed onto somebody's record became
// that person in the portal the moment its owner signed in. markEmailProven
// now stamps only with evidence of the participant's own use, counted on the
// person row (so per workspace). Against STAGING, in two throwaway workspaces:
//   · an organiser-typed address on B grants nothing (the hole);
//   · a merged-away address still reaches the keeper (the lockout stays fixed);
//   · a paid address reaches its person — the positive control, so a rule
//     that stamps nothing cannot pass;
//   · evidence in workspace A does not stamp the same address in workspace C.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';
import { markEmailProven, personIdsForProvenEmail, pointsWithEvidence } from '../lib/proven-email.js';

const tag = randomUUID().slice(0, 8);
const TYPED = `typed-${tag}@example.com`;
const OLD = `merged-${tag}@example.com`;
const PAID = `paid-${tag}@example.com`;
let wsA = '';
let wsC = '';
const ids: Record<string, string> = {};

async function person(ws: string, key: string, email: string, deleted = false) {
  const { data, error } = await service
    .from('person')
    .insert({ workspace_id: ws, email, first_name: key, ...(deleted ? { deleted_at: new Date().toISOString() } : {}) })
    .select('id')
    .single();
  if (error) throw new Error(`person ${key}: ${error.message}`);
  ids[key] = data.id as string;
  return data.id as string;
}
async function point(ws: string, personId: string, value: string) {
  const { error } = await service.from('person_contact_point').insert({ workspace_id: ws, person_id: personId, kind: 'email', value, is_primary: false });
  if (error) throw new Error(`point ${value}: ${error.message}`);
}
async function verified(personId: string, value: string): Promise<boolean> {
  const { data } = await service.from('person_contact_point').select('verified_at').eq('person_id', personId).eq('kind', 'email').eq('value', value).maybeSingle();
  return !!data?.verified_at;
}

beforeAll(async () => {
  wsA = await createThrowawayWorkspace('proven-a');
  wsC = await createThrowawayWorkspace('proven-c');
  // The hole: an organiser typed TYPED onto B.
  await point(wsA, await person(wsA, 'B', `b-${tag}@example.com`), TYPED);
  // The merge: L (address OLD) was merged into K, which carries OLD as a point.
  const k = await person(wsA, 'K', `k-${tag}@example.com`);
  const l = await person(wsA, 'L', OLD, true);
  await point(wsA, k, OLD);
  const m = await service.from('person_merge').insert({ workspace_id: wsA, kept_person_id: k, merged_person_id: l }).select('id').single();
  if (m.error) throw new Error(`merge: ${m.error.message}`);
  ids.merge = m.data.id as string;
  // The positive control: P paid with PAID, and carries it as a point.
  const p = await person(wsA, 'P', `p-${tag}@example.com`);
  await point(wsA, p, PAID);
  const { data: app } = await service.from('app').select('id').eq('slug', 'membership').single();
  const pu = await service
    .from('purchase')
    .insert({ workspace_id: wsA, app_id: app!.id, person_id: p, payer_email: PAID, item_label: 'proof', item_ref: `proof-${tag}`, amount_cents: 100, currency: 'EUR', status: 'paid' })
    .select('id')
    .single();
  if (pu.error) throw new Error(`purchase: ${pu.error.message}`);
  ids.purchase = pu.data.id as string;
  // Workspace C: the same PAID address typed onto X, with no evidence there.
  await point(wsC, await person(wsC, 'X', `x-${tag}@example.com`), PAID);
});

afterAll(async () => {
  if (ids.purchase) await service.from('purchase').delete().eq('id', ids.purchase);
  if (ids.merge) await service.from('person_merge').delete().eq('id', ids.merge);
  for (const ws of [wsA, wsC].filter(Boolean)) {
    await service.from('person_contact_point').delete().eq('workspace_id', ws);
    await service.from('person').delete().eq('workspace_id', ws);
    await deleteThrowawayWorkspace(ws);
  }
});

describe('pointsWithEvidence (pure)', () => {
  it('keeps only the points whose person shows evidence', () => {
    expect(pointsWithEvidence([{ id: 'a', person_id: 'p1' }, { id: 'b', person_id: 'p2' }], new Set(['p2']))).toEqual(['b']);
    expect(pointsWithEvidence([{ id: 'a', person_id: 'p1' }], new Set())).toEqual([]);
  });
});

describe('a sign-in stamps only addresses with evidence', () => {
  it('an organiser-typed address grants nothing', async () => {
    await markEmailProven(TYPED);
    expect(await verified(ids.B!, TYPED)).toBe(false);
    expect(await personIdsForProvenEmail(TYPED)).not.toContain(ids.B);
  });

  it('a merged-away address still reaches the keeper', async () => {
    await markEmailProven(OLD);
    expect(await verified(ids.K!, OLD)).toBe(true);
    expect(await personIdsForProvenEmail(OLD)).toContain(ids.K);
  });

  it('a paid address reaches its person (positive control), and only in the workspace with the evidence', async () => {
    await markEmailProven(PAID);
    expect(await verified(ids.P!, PAID)).toBe(true);
    expect(await verified(ids.X!, PAID)).toBe(false);
    const reach = await personIdsForProvenEmail(PAID);
    expect(reach).toContain(ids.P);
    expect(reach).not.toContain(ids.X);
  });
});
