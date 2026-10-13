// Workspace-wide discount codes, against the real database.
//
// Two of these tests are the reason the file exists.
//
// THE CROSS-WORKSPACE ONE. `discount_code.applies_to_id` has no foreign key —
// one polymorphic id cannot contradict itself the way four nullable FK
// columns can — so the database will happily hold a code in workspace A
// naming a thread in workspace B. Nothing but `lib/discount-codes.ts` stands
// between that row and a discount on somebody else's thread, and it is the
// same shape as both cross-workspace holes found in September 2026.
//
// THE RACE. `redeem_discount_code` is an UPDATE that is its own check, so the
// last use of a code cannot go to two people. The thread path does this as a
// read-then-write and CAN oversell; this asserts the new one does not, by
// firing both redemptions at once rather than reasoning about it.
//
// Everything here runs on throwaway workspaces and cleans up after itself.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createThrowawayWorkspace,
  deleteThrowawayWorkspace,
  service,
} from './staging.js';
import {
  findDiscountCode,
  redeemDiscountCode,
  discountedPrice,
} from '../lib/discount-codes.js';

const tag = randomUUID().slice(0, 8);
let wsA = '';
let wsB = '';
let threadA = '';
let threadB = '';
let tierA = '';
const made: { table: string; id: string }[] = [];

async function insert(table: string, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

/** A thread needs a programme to hang off, and a programme needs the app.
 *  Both are fixtures here; the thread is only ever a TARGET for a code. */
async function makeThread(workspaceId: string, slug: string): Promise<string> {
  const appId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!
    .id as string;
  // And an organiser, which needs a user. All of it is scaffolding: what this
  // file is about is whether a CODE may touch this thread, and the thread only
  // has to exist and belong to the right workspace.
  const organiserUser = await insert('user', {
    workspace_id: workspaceId,
    email: `int-disc-${slug}@example.com`,
  });
  const organiserId = await insert('thread_organiser', {
    user_id: organiserUser,
    workspace_id: workspaceId,
    slug: `org-${slug}`,
  });
  const program = await insert('program', {
    workspace_id: workspaceId,
    app_id: appId,
    title: `discount fixture ${slug}`,
    format: 'journey',
    status: 'active',
  });
  return insert('thread_thread', {
    workspace_id: workspaceId,
    program_id: program,
    organiser_id: organiserId,
    slug,
    is_public_listed: false,
    public_enrolment_open: false,
  });
}

const code = (row: Record<string, unknown>) =>
  insert('discount_code', {
    workspace_id: wsA,
    type: 'percentage',
    discount_percentage: 50,
    ...row,
  });

beforeAll(async () => {
  wsA = await createThrowawayWorkspace('discount-a');
  wsB = await createThrowawayWorkspace('discount-b');
  threadA = await makeThread(wsA, `disc-a-${tag}`);
  threadB = await makeThread(wsB, `disc-b-${tag}`);
  tierA = await insert('membership_tier', { workspace_id: wsA, name: 'Members' });
}, 180_000);

afterAll(async () => {
  for (const { table, id } of made) {
    const { error } = await service.from(table).delete().eq('id', id);
    if (error) console.error(`[fixtures] ${table} ${id}: ${error.message}`);
  }
  if (wsA) await deleteThrowawayWorkspace(wsA);
  if (wsB) await deleteThrowawayWorkspace(wsB);
}, 180_000);

describe('finding a code', () => {
  it('finds a workspace-wide code, whatever is being bought', async () => {
    await code({ code: `WIDE-${tag}`, applies_to: 'workspace' });
    for (const target of [
      { kind: 'workspace' } as const,
      { kind: 'thread', id: threadA } as const,
      { kind: 'tier', id: tierA } as const,
    ]) {
      const r = await findDiscountCode(wsA, `WIDE-${tag}`, target);
      expect('code' in r, `${target.kind}: ${JSON.stringify(r)}`).toBe(true);
    }
  });

  it('matches case-insensitively, and matches nothing else', async () => {
    const r = await findDiscountCode(wsA, `wide-${tag}`.toLowerCase(), { kind: 'workspace' });
    expect('code' in r).toBe(true);
  });

  // The hole the thread path had: a typed wildcard must be a typed string.
  // There is no `.ilike()` here to exploit, which is the point — this asserts
  // the absence stays an absence.
  it('treats a wildcard as the text it is', async () => {
    for (const typed of ['%', '*', '_', `WIDE-${tag.slice(0, 2)}%`]) {
      const r = await findDiscountCode(wsA, typed, { kind: 'workspace' });
      expect('error' in r, `${typed} must not match`).toBe(true);
    }
  });

  it('is not found from another workspace', async () => {
    const r = await findDiscountCode(wsB, `WIDE-${tag}`, { kind: 'workspace' });
    expect('error' in r).toBe(true);
  });
});

describe('what a code applies to', () => {
  it('applies to the thread it names, and not to another', async () => {
    await code({ code: `THREAD-${tag}`, applies_to: 'thread', applies_to_id: threadA });
    expect('code' in (await findDiscountCode(wsA, `THREAD-${tag}`, { kind: 'thread', id: threadA }))).toBe(true);
    const other = await makeThread(wsA, `disc-a2-${tag}`);
    const r = await findDiscountCode(wsA, `THREAD-${tag}`, { kind: 'thread', id: other });
    expect('error' in r).toBe(true);
  });

  // ⚠️ THE ONE. A code in workspace A naming a thread in workspace B must
  // never apply, however the request is phrased. The database cannot refuse
  // this row; only the validator can.
  it('refuses a code that names another workspace’s thread', async () => {
    await code({ code: `CROSS-${tag}`, applies_to: 'thread', applies_to_id: threadB });

    // Asked as workspace A, about B's thread — the natural attempt.
    const asA = await findDiscountCode(wsA, `CROSS-${tag}`, { kind: 'thread', id: threadB });
    expect('error' in asA, JSON.stringify(asA)).toBe(true);

    // And asked as workspace B, where the thread genuinely lives: the code
    // belongs to A, so B cannot find it at all.
    const asB = await findDiscountCode(wsB, `CROSS-${tag}`, { kind: 'thread', id: threadB });
    expect('error' in asB, JSON.stringify(asB)).toBe(true);
  });

  it('applies to the tier it names', async () => {
    await code({ code: `TIER-${tag}`, applies_to: 'tier', applies_to_id: tierA });
    expect('code' in (await findDiscountCode(wsA, `TIER-${tag}`, { kind: 'tier', id: tierA }))).toBe(true);
    // And not to a thread, even in the same workspace: a code for a
    // membership tier is not a code for an event.
    const r = await findDiscountCode(wsA, `TIER-${tag}`, { kind: 'thread', id: threadA });
    expect('error' in r).toBe(true);
  });

  // A target deleted since the code was made. "Does not apply" is the honest
  // answer — there is nothing left to apply it to — and it must not throw,
  // because a public form would then 500 instead of saying "not valid".
  it('refuses a code whose target has been deleted', async () => {
    const doomed = await makeThread(wsA, `disc-gone-${tag}`);
    await code({ code: `DANGLE-${tag}`, applies_to: 'thread', applies_to_id: doomed });
    await service.from('thread_thread').delete().eq('id', doomed);

    const r = await findDiscountCode(wsA, `DANGLE-${tag}`, { kind: 'thread', id: doomed });
    expect('error' in r, JSON.stringify(r)).toBe(true);
  });
});

describe('when a code stops working', () => {
  it('refuses an expired one, and the clock is an argument', async () => {
    await code({
      code: `OLD-${tag}`,
      applies_to: 'workspace',
      expires_at: '2026-06-01T00:00:00Z',
    });
    // Before the date it works; after it does not. Both asked of the same
    // row, so the only difference is the clock.
    expect('code' in (await findDiscountCode(wsA, `OLD-${tag}`, { kind: 'workspace' }, new Date('2026-05-01T00:00:00Z')))).toBe(true);
    expect('error' in (await findDiscountCode(wsA, `OLD-${tag}`, { kind: 'workspace' }, new Date('2026-07-01T00:00:00Z')))).toBe(true);
  });

  it('refuses one that is fully used', async () => {
    const id = await code({ code: `USED-${tag}`, applies_to: 'workspace', usage_limit: 1 });
    expect('code' in (await findDiscountCode(wsA, `USED-${tag}`, { kind: 'workspace' }))).toBe(true);
    await service.from('discount_code').update({ used_count: 1 }).eq('id', id);
    expect('error' in (await findDiscountCode(wsA, `USED-${tag}`, { kind: 'workspace' }))).toBe(true);
  });

  it('refuses a deactivated one', async () => {
    const id = await code({ code: `OFF-${tag}`, applies_to: 'workspace' });
    await service.from('discount_code').update({ is_active: false }).eq('id', id);
    expect('error' in (await findDiscountCode(wsA, `OFF-${tag}`, { kind: 'workspace' }))).toBe(true);
  });
});

describe('redeeming', () => {
  // ⚠️ THE RACE. Both calls go out together; exactly one may win. A
  // read-then-write — which is what the thread path still does — gives two.
  it('gives the last use to exactly one of two simultaneous redemptions', async () => {
    const id = await code({ code: `RACE-${tag}`, applies_to: 'workspace', usage_limit: 1 });
    const [a, b] = await Promise.all([redeemDiscountCode(id), redeemDiscountCode(id)]);
    expect([a, b].filter(Boolean), `got ${JSON.stringify([a, b])}`).toHaveLength(1);

    const { data } = await service.from('discount_code').select('used_count').eq('id', id).single();
    expect(data!.used_count).toBe(1);
  });

  it('counts an unlimited code up without ever refusing', async () => {
    const id = await code({ code: `OPEN-${tag}`, applies_to: 'workspace' });
    expect(await redeemDiscountCode(id)).toBe(true);
    expect(await redeemDiscountCode(id)).toBe(true);
    const { data } = await service.from('discount_code').select('used_count').eq('id', id).single();
    expect(data!.used_count).toBe(2);
  });

  // The RPC enforces the expiry as well as the limit, so a second caller that
  // skipped the validator still could not spend an expired code.
  it('refuses an expired code even when asked directly', async () => {
    const id = await code({
      code: `RACE-OLD-${tag}`,
      applies_to: 'workspace',
      expires_at: '2026-06-01T00:00:00Z',
    });
    expect(await redeemDiscountCode(id)).toBe(false);
  });
});

describe('the arithmetic is the one the thread path uses', () => {
  it('prices a percentage, an amount and a free code', async () => {
    const pct = (await findDiscountCode(wsA, `WIDE-${tag}`, { kind: 'workspace' })) as {
      code: Parameters<typeof discountedPrice>[0];
    };
    expect(discountedPrice(pct.code, 10000)).toBe(5000);

    const amountId = await insert('discount_code', {
      workspace_id: wsA,
      code: `AMT-${tag}`,
      type: 'amount',
      discount_amount_cents: 750,
      applies_to: 'workspace',
    });
    expect(amountId).toBeTruthy();
    const amt = (await findDiscountCode(wsA, `AMT-${tag}`, { kind: 'workspace' })) as {
      code: Parameters<typeof discountedPrice>[0];
    };
    expect(discountedPrice(amt.code, 10000)).toBe(9250);
    // Never below zero, however large the discount.
    expect(discountedPrice(amt.code, 500)).toBe(0);
  });
});
