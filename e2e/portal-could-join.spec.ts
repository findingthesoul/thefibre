// What a member is told their membership lets them join — in their own portal.
//
// The entitlement is pinned by integration tests and the price by unit tests.
// Neither shows what a MEMBER reads. This signs in as the member fixture,
// opens /memberships, and reads the section: one calendar at 100% and one at
// 20%, so both sentences are exercised — "included in your membership" and a
// price with the list price beside it — at desktop and at 375.
//
// It also checks what must NOT be there: a thread on a calendar nobody granted
// this tier, and a draft one on a calendar they DO hold. A list of what you
// can join is only worth anything if everything in it can be joined.
//
// Seeds its own community in the FIXTURE workspace and removes all of it.
// Never a real person's membership.

import { expect, test } from '@playwright/test';
import { HOSTS, fixtureIdentity, memberLandUrl, stagingService } from './helpers.js';

const TAG = 'e2e-could-join';
const PRICE = 4000;

let ws = '';
let memberEmail = '';
const made: { table: string; id: string }[] = [];

async function ins(table: string, row: Record<string, unknown>) {
  const { data, error } = await stagingService().from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

test.beforeAll(async () => {
  const service = stagingService();
  const fixture = await fixtureIdentity();
  ws = fixture.workspaceId;
  memberEmail = 'e2e-member@example.com'; // the member fixture's own address

  // An earlier run's rows first: a stale thread must not be the one under test.
  const { data: stale } = await service
    .from('thread_thread')
    .select('id, program_id')
    .eq('workspace_id', ws)
    .like('slug', `${TAG}%`);
  for (const t of stale ?? []) {
    await service.from('thread_thread').delete().eq('id', t.id);
    await service.from('program').delete().eq('id', t.program_id);
  }
  const { data: staleTiers } = await service
    .from('membership_tier')
    .select('id')
    .eq('workspace_id', ws)
    .like('name', `${TAG}%`);
  for (const t of staleTiers ?? []) {
    await service.from('membership_access_grant').delete().eq('tier_id', t.id);
    await service.from('membership_member').delete().eq('tier_id', t.id);
    await service.from('membership_tier').delete().eq('id', t.id);
  }
  const { data: staleTeams } = await service
    .from('team')
    .select('id')
    .eq('workspace_id', ws)
    .like('slug', `${TAG}%`);
  if (staleTeams?.length) {
    await service.from('team').delete().in(
      'id',
      staleTeams.map((t) => t.id),
    );
  }

  const { data: app } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  const { data: org } = await service
    .from('thread_organiser')
    .select('id')
    .eq('user_id', fixture.userRowId)
    .single();

  const team = async (slug: string, published = true) =>
    ins('team', {
      workspace_id: ws,
      name: `${TAG} ${slug}`,
      slug: `${TAG}-${slug}`,
      is_active: true,
      is_published: published,
    });
  const thread = async (
    teamId: string,
    slug: string,
    opts: { status?: string; price?: number } = {},
  ) => {
    const program = await ins('program', {
      workspace_id: ws,
      app_id: app!.id,
      title: `${TAG} ${slug}`,
      format: 'journey',
      status: opts.status ?? 'active',
    });
    return ins('thread_thread', {
      workspace_id: ws,
      program_id: program,
      organiser_id: org!.id,
      slug: `${TAG}-${slug}`,
      team_id: teamId,
      price_cents: opts.price ?? PRICE,
      price_currency: 'EUR',
      is_public_listed: true,
      public_enrolment_open: true,
      payment_methods: ['invoice'],
    });
  };

  const freeTeam = await team('free');
  const partTeam = await team('part');
  const otherTeam = await team('other');
  await thread(freeTeam, 'free-one');
  await thread(partTeam, 'part-one');
  // Not granted to this tier at all, and a DRAFT on a calendar that is —
  // the two rows that must not appear.
  await thread(otherTeam, 'ungranted');
  await thread(freeTeam, 'draft-one', { status: 'draft' });

  const tierId = await ins('membership_tier', { workspace_id: ws, name: `${TAG} tier` });
  await ins('membership_access_grant', {
    workspace_id: ws,
    tier_id: tierId,
    kind: 'team_calendar',
    config: { team_id: freeTeam, discount_pct: 100 },
  });
  await ins('membership_access_grant', {
    workspace_id: ws,
    tier_id: tierId,
    kind: 'team_calendar',
    config: { team_id: partTeam, discount_pct: 20 },
  });

  const { data: person } = await service
    .from('person')
    .select('id')
    .eq('workspace_id', ws)
    .eq('email', memberEmail)
    .maybeSingle();
  expect(person, 'the member fixture has a person row').toBeTruthy();
  await ins('membership_member', {
    workspace_id: ws,
    person_id: person!.id,
    tier_id: tierId,
    status: 'active',
  });
}, 240_000);

test.afterAll(async () => {
  const service = stagingService();
  for (const { table, id } of made) await service.from(table).delete().eq('id', id);
});

/** Sign in where the helper can, then walk to the portal: /my serves no
 *  `/sso/land` of its own — it rides the apex auth cookie, which is how a
 *  member reaches it. (Same approach as portal-members-list.spec.ts.) */
async function landPortal(page: import('@playwright/test').Page) {
  await page.goto(await memberLandUrl(HOSTS.thread, 'the-thread', '/dashboard'));
  await page.waitForURL(/dashboard|no-access/, { timeout: 30_000 });
  await page.goto(`${HOSTS.my}/memberships`);
  await page.waitForURL(/memberships/, { timeout: 30_000 });
}

test('a member reads what their membership lets them join, at their price', async ({ page }) => {
  test.slow();
  await landPortal(page);
  const body = page.locator('body');

  await expect(body, 'the section exists').toContainText(/What you can join/i, {
    timeout: 30_000,
  });

  // The whole card, printed: a walk whose only evidence is a green tick tells
  // nobody what a member was told.
  const shown = (await body.innerText()).replace(/\n+/g, ' | ');
  const from = shown.search(/What you can join/i);
  console.log(`[could-join] ${shown.slice(from, from + 400)}`);

  // 100% — the sentence, not a price of zero.
  await expect(body, 'a calendar the membership covers').toContainText(
    new RegExp(`${TAG} free-one`),
  );
  await expect(body, 'reads as included, not as 0.00').toContainText(
    /included in your membership/i,
  );

  // 20% — their price AND the list price, so the membership's worth is visible.
  await expect(body, 'a calendar at a reduced price').toContainText(
    new RegExp(`${TAG} part-one`),
  );
  await expect(body, 'what they pay').toContainText('€32.00');
  await expect(body, 'and what anybody else pays').toContainText('€40.00');

  // What must NOT be there, each anchored on something that IS.
  await expect(body, 'a calendar nobody granted this tier').not.toContainText(
    new RegExp(`${TAG} ungranted`),
  );
  await expect(body, 'a draft thread cannot be joined, so it is not offered').not.toContainText(
    new RegExp(`${TAG} draft-one`),
  );

  // Every row is clickable and points at a public thread page.
  const links = await page
    .locator('a')
    .filter({ hasText: new RegExp(`${TAG} (free|part)-one`) })
    .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href));
  console.log(`[could-join] links: ${JSON.stringify(links)}`);
  expect(links.length, 'both rows are links').toBeGreaterThanOrEqual(2);
  for (const href of links) expect(href, 'a public thread address').toMatch(/thefibre\.tech\//);
});

test('and it reads on a phone', async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 375, height: 812 });
  await landPortal(page);
  const body = page.locator('body');
  await expect(body).toContainText(/What you can join/i, { timeout: 30_000 });
  await expect(body).toContainText(/included in your membership/i);
  await expect(body).toContainText('€32.00');

  // Nothing spills sideways — the fault the team-calendar field had at this
  // width, measured rather than eyeballed.
  const fit = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  console.log(`[could-join] 375 fit: ${JSON.stringify(fit)}`);
  expect(fit.scrollWidth, 'the page does not scroll sideways').toBeLessThanOrEqual(
    fit.clientWidth + 1,
  );
});
