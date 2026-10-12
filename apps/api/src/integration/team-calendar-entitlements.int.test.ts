// The one walk, and the promise that the list and the charge cannot disagree.
//
// `teamCalendarEntitlements` is now the single answer to "which calendars does
// this person's membership carry, and at what percentage". `memberDiscountFor`
// is that walk plus "which of them is this thread's team", and the member's
// could-join list is that walk plus "what is on those calendars". The point of
// extracting it was that a second walk would be a second statement of one
// entitlement — so the test that matters most here is the last one, which
// asserts the two agree for every calendar the walk returns.
//
// Against STAGING, in a throwaway workspace, and everything it makes it
// removes.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';
import { memberDiscountFor, teamCalendarEntitlements } from '../lib/member-discount.js';

let ws = '';
let personId = '';
let strangerId = '';
let tierId = '';
let teamA = '';
let teamB = '';
let teamUngranted = '';
let threadA = '';
let threadB = '';
let memberId = '';

// Every insert, newest first, so afterAll can undo them in an order the
// foreign keys allow. deleteThrowawayWorkspace removes persons, users and
// organisations and leans on cascades for the rest — a membership_member row
// references a person without one, so the person delete fails and the
// workspace with it. (Which also blocks the NEXT run: team slugs live in the
// global public_root_slug table, so a leaked workspace's teams keep them.)
const made: { table: string; id: string }[] = [];

async function insert(table: string, row: Record<string, unknown>) {
  const { data, error } = await service.from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

beforeAll(async () => {
  ws = await createThrowawayWorkspace('tcentitle');

  teamA = await insert('team', { workspace_id: ws, name: 'Choir', slug: 'tce-choir' });
  teamB = await insert('team', { workspace_id: ws, name: 'Band', slug: 'tce-band' });
  teamUngranted = await insert('team', { workspace_id: ws, name: 'Silent', slug: 'tce-silent' });

  const appId = (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id;
  const organiserUser = await insert('user', { workspace_id: ws, email: 'tce@example.com' });
  const organiserId = await insert('thread_organiser', {
    user_id: organiserUser,
    workspace_id: ws,
    slug: 'tce-organiser',
  });
  const thread = async (teamId: string, slug: string) => {
    const program = await insert('program', {
      workspace_id: ws,
      app_id: appId,
      title: `TCE ${slug}`,
      format: 'journey',
      status: 'active',
    });
    return insert('thread_thread', {
      workspace_id: ws,
      program_id: program,
      organiser_id: organiserId,
      slug,
      team_id: teamId,
      price_cents: 5000,
      price_currency: 'EUR',
    });
  };
  threadA = await thread(teamA, 'tce-a');
  threadB = await thread(teamB, 'tce-b');

  personId = await insert('person', {
    workspace_id: ws,
    first_name: 'Tce',
    last_name: 'Member',
    email: 'tce-member@example.com',
  });
  strangerId = await insert('person', {
    workspace_id: ws,
    first_name: 'Tce',
    last_name: 'Stranger',
    email: 'tce-stranger@example.com',
  });

  tierId = await insert('membership_tier', { workspace_id: ws, name: 'TCE tier' });
  // Team A straight on the tier; team B through a product the tier includes.
  // Both are the member's, by different routes — and the walk must find both
  // or the list silently shows half a membership.
  await insert('membership_access_grant', {
    workspace_id: ws,
    tier_id: tierId,
    kind: 'team_calendar',
    config: { team_id: teamA, discount_pct: 100 },
  });
  const productId = await insert('membership_product', { workspace_id: ws, name: 'TCE product' });
  await insert('membership_access_grant', {
    workspace_id: ws,
    product_id: productId,
    kind: 'team_calendar',
    config: { team_id: teamB, discount_pct: 20 },
  });
  await service
    .from('membership_tier_product')
    .insert({ tier_id: tierId, product_id: productId, optional: false });

  memberId = await insert('membership_member', {
    workspace_id: ws,
    person_id: personId,
    tier_id: tierId,
    status: 'active',
  });
}, 180_000);

afterAll(async () => {
  await service.from('membership_tier_product').delete().eq('tier_id', tierId);
  for (const { table, id } of made) await service.from(table).delete().eq('id', id);
  if (ws) await deleteThrowawayWorkspace(ws);
});

describe('teamCalendarEntitlements', () => {
  it('finds every calendar, through the tier AND through its products', async () => {
    const held = await teamCalendarEntitlements(personId, ws);
    expect(
      held.map((e) => [e.teamId, e.pct]).sort(),
      'both routes to a calendar, not just the tier-level one',
    ).toEqual(
      [
        [teamA, 100],
        [teamB, 20],
      ].sort(),
    );
  });

  it('and does not invent one for a team nobody granted', async () => {
    const held = await teamCalendarEntitlements(personId, ws);
    expect(held.some((e) => e.teamId === teamUngranted)).toBe(false);
  });

  it('answers nothing for somebody who is not a member', async () => {
    expect(await teamCalendarEntitlements(strangerId, ws)).toEqual([]);
  });

  it('answers nothing once the membership lapses, and again when it is back', async () => {
    await service.from('membership_member').update({ status: 'lapsed' }).eq('id', memberId);
    expect(await teamCalendarEntitlements(personId, ws), 'a lapse ends the offer').toEqual([]);
    // Grace is a late payment, not a departure — the same predicate the rest
    // of membership uses.
    await service.from('membership_member').update({ status: 'grace' }).eq('id', memberId);
    expect((await teamCalendarEntitlements(personId, ws)).length, 'grace still counts').toBe(2);
    await service.from('membership_member').update({ status: 'active' }).eq('id', memberId);
  });

  it('takes the BEST percentage when one calendar is granted twice', async () => {
    const extra = await insert('membership_access_grant', {
      workspace_id: ws,
      tier_id: tierId,
      kind: 'team_calendar',
      // Deliberately WORSE and inserted later: if the walk took the last row,
      // or the first, instead of the best, this is the case that would catch
      // it only by accident. 60 beats nothing but loses to 100.
      config: { team_id: teamA, discount_pct: 60 },
    });
    const held = await teamCalendarEntitlements(personId, ws);
    expect(held.find((e) => e.teamId === teamA)?.pct, 'the better grant wins').toBe(100);
    await service.from('membership_access_grant').delete().eq('id', extra);
  });

  it('AGREES with memberDiscountFor for every calendar it returns', async () => {
    // THE REASON THE WALK WAS EXTRACTED. The member's list is built from this
    // function and the charge is built from memberDiscountFor; if they ever
    // part company, a member is shown one price and charged another. They
    // share code now, so this passes by construction — which is exactly when
    // it earns its place: it goes red the day somebody gives either one its
    // own query again.
    const held = await teamCalendarEntitlements(personId, ws);
    const byTeam = new Map(held.map((e) => [e.teamId, e.pct]));
    for (const [threadId, teamId] of [
      [threadA, teamA],
      [threadB, teamB],
    ] as const) {
      const charged = await memberDiscountFor(personId, threadId);
      expect(charged?.pct, `thread on ${teamId}`).toBe(byTeam.get(teamId));
    }
  });

  it('and a thread with NO team is nobody’s calendar, from either side', async () => {
    const program = await insert('program', {
      workspace_id: ws,
      app_id: (await service.from('app').select('id').eq('slug', 'the-thread').single()).data!.id,
      title: 'TCE solo',
      format: 'journey',
      status: 'active',
    });
    const solo = await insert('thread_thread', {
      workspace_id: ws,
      program_id: program,
      organiser_id: (
        await service.from('thread_organiser').select('id').eq('workspace_id', ws).single()
      ).data!.id,
      slug: 'tce-solo',
      price_cents: 5000,
    });
    expect(await memberDiscountFor(personId, solo)).toBeNull();
  });
});
