// A purchase is never credited past what was paid (refund rules slice 1,
// 2026-10-17). The guard is the database's: a BEFORE INSERT trigger on
// purchase_credit_note locks the purchase row and refuses a note that would
// take the credited total past its amount. Against staging, a throwaway
// workspace, notes written with the service role exactly as the API will.
//
// Pinned:
//   · notes up to exactly the amount are accepted; one cent more is refused;
//   · TWO notes racing on one purchase, each within it but together past it:
//     one lands, the other is refused (the lock serialises them);
//   · a note naming a purchase in another workspace is refused;
//   · net + vat must equal amount;
//   · one seller cannot reuse a number; another seller may;
//   · DELETING (the cascade lesson; this SQL had never run before staging):
//     hard-deleting a user who issued a note keeps the note and empties
//     issued_by_user_id; hard-deleting a workspace that has a purchase and a
//     credit note removes both (purchase FK is NO ACTION, checked at the end
//     of the statement; the delete guard lets a note go only when its
//     workspace is gone);
//   · AN ISSUED NOTE IS FINAL: deleting one directly is refused; changing
//     its amount is refused; filling in emailed_at is allowed.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createFixtureUser, createThrowawayWorkspace, deleteFixtureUser, deleteThrowawayWorkspace, service } from './staging.js';

let ws = '';
let ws2 = '';
let appId = '';
const purchases: string[] = [];

async function purchase(workspaceId: string, amount: number): Promise<string> {
  const { data, error } = await service
    .from('purchase')
    .insert({
      workspace_id: workspaceId,
      app_id: appId,
      item_label: 'Credit note guard fixture',
      item_ref: `int-cn-${randomUUID()}`,
      amount_cents: amount,
      currency: 'EUR',
      method: 'stripe',
      status: 'paid',
    })
    .select('id')
    .single();
  if (error) throw new Error(`purchase fixture: ${error.message}`);
  purchases.push(data!.id as string);
  return data!.id as string;
}

const note = (purchaseId: string, amount: number, over: Record<string, unknown> = {}) =>
  service.from('purchase_credit_note').insert({
    workspace_id: ws,
    purchase_id: purchaseId,
    seller_ref: 'acct_int_seller_a',
    number: `INT-${randomUUID().slice(0, 8)}-CN`,
    amount_cents: amount,
    net_cents: amount,
    vat_cents: 0,
    currency: 'EUR',
    kind: 'refund',
    ...over,
  });

beforeAll(async () => {
  appId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id as string;
  ws = await createThrowawayWorkspace('credit-note-guard');
  ws2 = await createThrowawayWorkspace('credit-note-guard-2');
}, 120_000);

afterAll(async () => {
  // Credit notes cannot be deleted on their own (that is one of the things
  // pinned below): the workspaces go, and their purchases and notes with them.
  if (ws) expect(await deleteThrowawayWorkspace(ws)).toBe(true);
  if (ws2) expect(await deleteThrowawayWorkspace(ws2)).toBe(true);
  if (purchases.length) expect((await service.from('purchase').select('id').in('id', purchases)).data).toEqual([]);
}, 120_000);

describe('the credited total never passes what was paid', () => {
  it('up to exactly the amount is accepted; one cent more is refused', async () => {
    const p = await purchase(ws, 10_000);
    expect((await note(p, 6_000)).error).toBeNull();
    expect((await note(p, 4_000)).error).toBeNull();
    const over = await note(p, 1);
    expect(over.error?.code).toBe('23514');
    expect(over.error?.message).toContain('exceed');
  });

  it('two notes racing on one purchase: one lands, the other is refused', async () => {
    const p = await purchase(ws, 10_000);
    const [a, b] = await Promise.all([note(p, 6_000), note(p, 6_000)]);
    const errors = [a.error, b.error].filter(Boolean);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe('23514');
    const { data } = await service.from('purchase_credit_note').select('amount_cents').eq('purchase_id', p);
    expect((data ?? []).map((r) => r.amount_cents)).toEqual([6_000]);
  });

  it('a note naming a purchase in another workspace is refused', async () => {
    const elsewhere = await purchase(ws2, 10_000);
    const r = await note(elsewhere, 1_000);
    expect(r.error?.code).toBe('23514');
  });
});

describe('the note itself', () => {
  it('net + vat must equal the amount', async () => {
    const p = await purchase(ws, 12_100);
    expect((await note(p, 12_100, { net_cents: 10_000, vat_cents: 2_000, vat_rate: 21 })).error?.code).toBe('23514');
    expect((await note(p, 12_100, { net_cents: 10_000, vat_cents: 2_100, vat_rate: 21 })).error).toBeNull();
  });

  it('a seller cannot reuse a number; another seller may', async () => {
    const p = await purchase(ws, 10_000);
    const number = `INV-${randomUUID().slice(0, 6)}-CN-01`;
    expect((await note(p, 1_000, { number })).error).toBeNull();
    expect((await note(p, 1_000, { number })).error?.code).toBe('23505');
    expect((await note(p, 1_000, { number, seller_ref: 'acct_int_seller_b' })).error).toBeNull();
  });
});

describe('deleting: a note never blocks a user or a workspace going', () => {
  it('a user who issued a note is hard-deleted; the note stays, issued_by emptied', async () => {
    const issuer = await createFixtureUser(ws, 'cn-issuer');
    const p = await purchase(ws, 5_000);
    const r = await service.from('purchase_credit_note').insert({
      workspace_id: ws, purchase_id: p, seller_ref: 'acct_int_seller_a', number: `INT-${randomUUID().slice(0, 8)}-CN`,
      amount_cents: 1_000, net_cents: 1_000, vat_cents: 0, currency: 'EUR', kind: 'refund', issued_by_user_id: issuer.userId,
    }).select('id').single();
    expect(r.error).toBeNull();
    await deleteFixtureUser(issuer);
    expect((await service.from('user').select('id').eq('id', issuer.userId)).data).toEqual([]);
    const { data } = await service.from('purchase_credit_note').select('id, issued_by_user_id').eq('id', r.data!.id).single();
    expect(data).toEqual({ id: r.data!.id, issued_by_user_id: null });
  });

  it('a workspace with a purchase and a credit note is hard-deleted, both with it', async () => {
    const doomed = await createThrowawayWorkspace('credit-note-doomed');
    const { data: pr, error: pErr } = await service.from('purchase').insert({
      workspace_id: doomed, app_id: appId, item_label: 'doomed', item_ref: `int-cn-${randomUUID()}`, amount_cents: 2_000, currency: 'EUR', method: 'stripe', status: 'paid',
    }).select('id').single();
    expect(pErr).toBeNull();
    const n = await service.from('purchase_credit_note').insert({
      workspace_id: doomed, purchase_id: pr!.id, seller_ref: 'acct_int_seller_a', number: `INT-${randomUUID().slice(0, 8)}-CN`,
      amount_cents: 2_000, net_cents: 2_000, vat_cents: 0, currency: 'EUR', kind: 'refund',
    }).select('id').single();
    expect(n.error).toBeNull();
    expect(await deleteThrowawayWorkspace(doomed)).toBe(true);
    expect((await service.from('workspace').select('id').eq('id', doomed)).data).toEqual([]);
    expect((await service.from('purchase').select('id').eq('id', pr!.id)).data).toEqual([]);
    expect((await service.from('purchase_credit_note').select('id').eq('id', n.data!.id)).data).toEqual([]);
  });

  it('a purchase on its own cannot be deleted from under its note', async () => {
    const p = await purchase(ws, 3_000);
    expect((await note(p, 1_000)).error).toBeNull();
    const d = await service.from('purchase').delete().eq('id', p);
    expect(d.error?.code).toBe('23503');
  });
});

describe('an issued credit note is final', () => {
  it('deleting one directly is refused', async () => {
    const p = await purchase(ws, 4_000);
    const n = await note(p, 1_000).select('id').single();
    expect(n.error).toBeNull();
    const d = await service.from('purchase_credit_note').delete().eq('id', n.data!.id);
    expect(d.error?.code).toBe('23514');
    expect((await service.from('purchase_credit_note').select('id').eq('id', n.data!.id)).data).toHaveLength(1);
  });

  it('changing its amount is refused; filling in emailed_at is allowed', async () => {
    const p = await purchase(ws, 4_000);
    const n = await note(p, 1_000).select('id').single();
    const bad = await service.from('purchase_credit_note').update({ amount_cents: 500, net_cents: 500 }).eq('id', n.data!.id);
    expect(bad.error?.code).toBe('23514');
    const ok = await service.from('purchase_credit_note').update({ emailed_at: new Date().toISOString(), stripe_credit_note_id: 'cn_test' }).eq('id', n.data!.id).select('amount_cents').single();
    expect(ok.error).toBeNull();
    expect(ok.data?.amount_cents).toBe(1_000);
  });
});
