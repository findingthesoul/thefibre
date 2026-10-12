// Who is entitled to a member price, resolved against the real tables.
//
// The arithmetic is a unit test (lib/member-discount.test.ts). THIS is the
// other half, and the half that cannot be reasoned about: the walk from a
// person to an active membership to its tier's products to their grants to a
// `team_calendar` whose team is this thread's team. Six joins, any one of
// which could quietly answer nothing — and a resolver that answers null when
// it should answer 100 shows up as a member being charged full price, which
// nobody reports as a bug in a resolver.
//
// Against STAGING, in a throwaway workspace, and everything it makes it
// removes.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';
import { memberDiscountFor } from '../lib/member-discount.js';

let ws = '';
const made: { table: string; id: string }[] = [];

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

let teamId = '';
let otherTeamId = '';
let threadId = '';
let soloThreadId = '';
let personId = '';
let tierId = '';
let productId = '';
const EMAIL = 'e2e-member-discount@example.com';

beforeAll(async () => {
  ws = await createThrowawayWorkspace('memberdisc');

  teamId = await insert('team', { workspace_id: ws, name: 'Calendar team', slug: 'calendar-team' });
  otherTeamId = await insert('team', {
    workspace_id: ws,
    name: 'Another team',
    slug: 'another-team',
  });

  const organiserUser = await insert('user', { workspace_id: ws, email: EMAIL });
  const organiserId = await insert('thread_organiser', {
    user_id: organiserUser,
    workspace_id: ws,
    slug: 'memberdisc-organiser',
  });
  const program = await insert('program', {
    workspace_id: ws,
    app_id: (
      await service.from('app').select('id').eq('slug', 'the-thread').single()
    ).data!.id,
    title: 'Member discount fixture',
    format: 'journey',
    status: 'active',
  });
  threadId = await insert('thread_thread', {
    workspace_id: ws,
    program_id: program,
    organiser_id: organiserId,
    slug: 'team-thread',
    team_id: teamId,
    is_public_listed: false,
    public_enrolment_open: false,
  });
  const soloProgram = await insert('program', {
    workspace_id: ws,
    app_id: (
      await service.from('app').select('id').eq('slug', 'the-thread').single()
    ).data!.id,
    title: 'No team fixture',
    format: 'journey',
    status: 'active',
  });
  soloThreadId = await insert('thread_thread', {
    workspace_id: ws,
    program_id: soloProgram,
    organiser_id: organiserId,
    slug: 'workspace-thread',
    is_public_listed: false,
    public_enrolment_open: false,
  });

  personId = await insert('person', {
    workspace_id: ws,
    first_name: 'Member',
    last_name: 'Discount',
    email: EMAIL,
  });
  tierId = await insert('membership_tier', { workspace_id: ws, name: 'Members' });
  productId = await insert('membership_product', { workspace_id: ws, name: 'The calendar' });
  await service
    .from('membership_tier_product')
    .insert({ tier_id: tierId, product_id: productId, optional: false });
  await insert('membership_member', {
    workspace_id: ws,
    person_id: personId,
    tier_id: tierId,
    status: 'active',
  });
}, 180_000);

afterAll(async () => {
  for (const { table, id } of made) {
    const { error } = await service.from(table).delete().eq('id', id);
    if (error) console.error(`[fixtures] ${table} ${id}: ${error.message}`);
  }
  if (ws) await deleteThrowawayWorkspace(ws);
}, 180_000);

describe('memberDiscountFor', () => {
  it('answers null with no grant at all', async () => {
    // Asserted FIRST, so a later pass cannot be the fixture answering yes to
    // everything: the walk has to be able to say no.
    await expect(memberDiscountFor(personId, threadId)).resolves.toBeNull();
  });

  let productGrant = '';

  it('finds the percentage through the tier’s product', async () => {
    productGrant = await insert('membership_access_grant', {
      workspace_id: ws,
      product_id: productId,
      kind: 'team_calendar',
      config: { team_id: teamId, discount_pct: 55 },
    });
    await expect(memberDiscountFor(personId, threadId)).resolves.toEqual({
      pct: 55,
      via: productGrant,
    });
  });

  it('takes the BEST of two grants for the same calendar, not the first row', async () => {
    // A WORSE grant, on the tier — and the resolver reads tier grants BEFORE
    // product grants, so this one comes first in the list it walks. That
    // ordering is the point: with both at the same number, or with the better
    // one first, "take the first" and "take the best" are indistinguishable
    // and this test proves nothing. (It did not, until a mutation check said
    // so: removing the best-of comparison left it green.)
    await insert('membership_access_grant', {
      workspace_id: ws,
      tier_id: tierId,
      kind: 'team_calendar',
      config: { team_id: teamId, discount_pct: 20 },
    });
    await expect(memberDiscountFor(personId, threadId)).resolves.toEqual({
      pct: 55,
      via: productGrant,
    });
  });

  it('ignores a grant for ANOTHER team', async () => {
    // 100% — BETTER than this thread's 55% — on a team that does not own this
    // thread. The number matters: with it, a resolver that forgot the team
    // match answers 100 and this test goes red. With both at 100 the test
    // would have passed either way, which is how a guard gets removed in a
    // refactor and nobody hears about it.
    await insert('membership_access_grant', {
      workspace_id: ws,
      tier_id: tierId,
      kind: 'team_calendar',
      config: { team_id: otherTeamId, discount_pct: 100 },
    });
    expect((await memberDiscountFor(personId, threadId))?.pct).toBe(55);
  });

  it('answers null for a thread with NO team', async () => {
    // A workspace thread carries team_id NULL and is nobody's calendar.
    await expect(memberDiscountFor(personId, soloThreadId)).resolves.toBeNull();
  });

  it('answers null once the membership lapses, and again when it is back', async () => {
    const flip = async (status: string) => {
      const { error } = await service
        .from('membership_member')
        .update({ status })
        .eq('workspace_id', ws)
        .eq('person_id', personId);
      if (error) throw new Error(`flip to ${status}: ${error.message}`);
    };
    await flip('lapsed');
    await expect(memberDiscountFor(personId, threadId)).resolves.toBeNull();
    // GRACE still counts: a late payment is not somebody leaving.
    await flip('grace');
    expect((await memberDiscountFor(personId, threadId))?.pct).toBe(55);
    await flip('active');
  });

  it('answers for a PERSON, never for a typed address', async () => {
    // There is no by-email resolver any more: pricing on an address typed
    // into a public form would hand the member price to whoever typed it.
    // The entitlement takes a person id, and a person id comes from a
    // session. Asserted as a property of the module so nobody re-adds one
    // without reading why it went.
    const mod = await import('../lib/member-discount.js');
    expect(Object.keys(mod)).not.toContain('memberDiscountForEmail');
  });
});
