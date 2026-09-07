// recordPurchase is the convergence point of checkout, webhooks, payment
// links and mark-paid — its update-first-insert-second on (app_id,
// item_ref) is what makes webhook retries and double-submits safe. Locked
// here against the real staging database.
//
// Fixture discipline: throwaway item_refs (int-test-<uuid>), cleaned by
// exactly those refs; the workspace is an existing non-rehearsal one and
// is never swept.

import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { anyWorkspaceId, service } from './staging.js';

// Dynamic import AFTER the staging env exists so src/db.ts builds its
// adminClient against staging.
const { recordPurchase } = await import('../lib/purchases.js');

const refs: string[] = [];
const ref = () => {
  const r = `int-test-${randomUUID()}`;
  refs.push(r);
  return r;
};

afterAll(async () => {
  if (refs.length) await service.from('purchase').delete().in('item_ref', refs);
});

describe('recordPurchase idempotency', () => {
  it('the same (app, item_ref) written twice yields ONE row (webhook retry)', async () => {
    const workspaceId = await anyWorkspaceId();
    const itemRef = ref();
    const write = {
      appSlug: 'the-thread' as const,
      workspaceId,
      itemRef,
      itemLabel: 'integration fixture',
      payerEmail: 'int-test@example.com',
      amountCents: 1234,
      currency: 'eur',
      method: 'invoice' as const,
      status: 'pending' as const,
    };
    await recordPurchase(write);
    await recordPurchase(write); // the retry

    const { data } = await service.from('purchase').select('id, status').eq('item_ref', itemRef);
    expect(data?.length).toBe(1);
  });

  it('a later status write MERGES over the row (pending → paid keeps one row, stamps paid_at)', async () => {
    const workspaceId = await anyWorkspaceId();
    const itemRef = ref();
    await recordPurchase({
      appSlug: 'the-thread',
      workspaceId,
      itemRef,
      itemLabel: 'integration fixture',
      amountCents: 5000,
      currency: 'eur',
      method: 'invoice',
      status: 'pending',
    });
    // The webhook arrives: only what IT knows — no amount, no label.
    await recordPurchase({ appSlug: 'the-thread', workspaceId, itemRef, status: 'paid' });

    const { data } = await service
      .from('purchase')
      .select('status, paid_at, amount_cents, item_label')
      .eq('item_ref', itemRef);
    expect(data?.length).toBe(1);
    expect(data![0].status).toBe('paid');
    expect(data![0].paid_at).toBeTruthy();
    // The merge must not erase what the first write knew.
    expect(data![0].amount_cents).toBe(5000);
    expect(data![0].item_label).toBe('integration fixture');
  });

  it('concurrent first writes for one item_ref never produce duplicates', async () => {
    const workspaceId = await anyWorkspaceId();
    const itemRef = ref();
    const write = {
      appSlug: 'the-thread' as const,
      workspaceId,
      itemRef,
      amountCents: 100,
      currency: 'eur',
      method: 'free' as const,
      status: 'paid' as const,
    };
    await Promise.all([recordPurchase(write), recordPurchase(write), recordPurchase(write)]);
    const { data } = await service.from('purchase').select('id').eq('item_ref', itemRef);
    // update-first-insert-second has a first-write race window; the
    // CONTRACT is convergence to one logical row per (app, item_ref) —
    // if this ever yields >1, the insert needs an upsert/on-conflict.
    expect(data?.length).toBe(1);
  });
});
