// The member price, end to end, against the deployed API with a REAL token.
//
// Everything about this feature was tested rather than seen: the arithmetic
// in a unit test, the entitlement walk in an integration test, the decision
// about who qualifies in a pure function. What none of that covers is the
// thing that actually has to hold — that the API, deployed, charges a
// signed-in member less and charges everybody else the list price. The hole
// this feature nearly shipped with (pricing on a typed email) was invisible
// to every one of those tests.
//
// So this calls the PUBLIC enrol route the way the form does, four times,
// with and without a bearer:
//
//   1. anonymous                           → list price
//   2. signed in as the member, own address → member price, ledger says why
//   3. signed in as the member, SOMEBODY ELSE's address → list price
//   4. a forged bearer                      → list price, and no error
//
// It seeds its own community in the FIXTURE workspace — a team, a priced
// thread in it, a tier whose grant carries that team's calendar, and a member
// — and removes all of it. No real person's membership is touched.

import { expect, test } from '@playwright/test';
import { HOSTS, fixtureIdentity, memberLandUrl, stagingService } from './helpers.js';

const TAG = 'e2e-member-price';
const API = 'https://thefibre-api-staging.fly.dev';
const PRICE = 3500;

let ws = '';
let threadSlug = '';
let organiserSlug = '';
let ownerSlug = '';
let threadId = '';
let freeThreadId = '';
let partialThreadId = '';
let partialSlug = '';
let partialOwnerSlug = '';
let freeThreadSlug = '';
let memberEmail = '';
const made: { table: string; id: string }[] = [];

async function ins(table: string, row: Record<string, unknown>) {
  const { data, error } = await stagingService().from(table).insert(row).select('id').single();
  if (error) throw new Error(`fixture ${table}: ${error.message}`);
  made.unshift({ table, id: data!.id as string });
  return data!.id as string;
}

/** The enrol call the form makes, with whatever bearer we choose. */
async function enrol(
  page: import('@playwright/test').Page,
  email: string,
  bearer: string | null,
  opts: { slug?: string; owner?: string; coupon?: string; free?: boolean } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await page.request.post(`${API}/api/v1/thread/public/enrol`, {
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    data: {
      organiser_slug: opts.owner ?? ownerSlug,
      thread_slug: opts.slug ?? threadSlug,
      ...(opts.coupon ? { coupon_code: opts.coupon } : {}),
      name: `${TAG} enroller`,
      email,
      ...(opts.free
        ? {}
        : {
            payment_method: 'invoice',
            billing: { legal_name: `${TAG} payer`, address: 'Nowhere 1', tax_no: '' },
          }),
      policy_accepted: true,
      policy_version: '2026-10-12',
      request_id: `${TAG}-${Math.random().toString(36).slice(2)}`,
    },
  });
  return { status: res.status(), body: (await res.json()) as Record<string, unknown> };
}

test.beforeAll(async () => {
  const service = stagingService();
  const fixture = await fixtureIdentity();
  ws = fixture.workspaceId;
  memberEmail = 'e2e-member@example.com'; // the member fixture's own address

  // Sweep an earlier run's rows before seeding, so the queue of fixtures
  // cannot grow and a stale thread cannot be the one under test.
  const { data: stale } = await service
    .from('thread_thread')
    .select('id, program_id')
    .eq('workspace_id', ws)
    .like('slug', `${TAG}%`);
  for (const t of stale ?? []) {
    await service.from('thread_enrolment').delete().eq('thread_id', t.id);
    await service.from('enrolment').delete().eq('program_id', t.program_id);
    await service.from('purchase').delete().eq('item_ref', t.id as string);
    await service.from('thread_ticket').delete().eq('thread_id', t.id);
    await service.from('thread_thread').delete().eq('id', t.id);
    await service.from('program').delete().eq('id', t.program_id);
  }
  await service.from('membership_access_grant').delete().eq('workspace_id', ws).eq('kind', 'team_calendar');
  const { data: staleTeams } = await service
    .from('team')
    .select('id')
    .eq('workspace_id', ws)
    .like('slug', `${TAG}%`);
  if (staleTeams?.length) {
    await service.from('team').delete().in('id', staleTeams.map((t) => t.id));
  }

  // A TEAM thread publishes under the TEAM's slug, not the organiser's
  // (lib/public-owner-slug.ts), and the public resolver only finds a team
  // that is active AND published — an unpublished team 404s on purpose since
  // 2026-10-06. Both flags, or the payload under test does not exist.
  const teamId = await ins('team', {
    workspace_id: ws,
    name: `${TAG} team`,
    slug: `${TAG}-team`,
    is_active: true,
    is_published: true,
  });
  // The owner slug every public URL and the enrol POST use for this thread.
  ownerSlug = `${TAG}-team`;
  const { data: app } = await service.from('app').select('id').eq('slug', 'the-thread').single();
  const programId = await ins('program', {
    workspace_id: ws,
    app_id: app!.id,
    title: `${TAG} priced thread`,
    format: 'journey',
    status: 'active',
  });
  // The fixture's own organiser row (created by ensureFixtureThread).
  const { data: org } = await service
    .from('thread_organiser')
    .select('id, slug')
    .eq('user_id', fixture.userRowId)
    .single();
  organiserSlug = org!.slug as string;
  threadSlug = `${TAG}-thread`;
  threadId = await ins('thread_thread', {
    workspace_id: ws,
    program_id: programId,
    organiser_id: org!.id,
    slug: threadSlug,
    team_id: teamId,
    price_cents: PRICE,
    price_currency: 'EUR',
    is_public_listed: true,
    public_enrolment_open: true,
    payment_methods: ['invoice'], // no Stripe account needed to settle a price
  });

  // The membership: a tier whose grant carries THIS team's calendar, at 100%.
  const tierId = await ins('membership_tier', { workspace_id: ws, name: `${TAG} tier` });
  await ins('membership_access_grant', {
    workspace_id: ws,
    tier_id: tierId,
    kind: 'team_calendar',
    config: { team_id: teamId, discount_pct: 100 },
  });
  // The member fixture's person row in this workspace.
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

  // A 100%-off code on the same thread, for the reason that is not a
  // membership.
  await ins('thread_coupon', {
    workspace_id: ws,
    thread_id: threadId,
    code: `${TAG.toUpperCase()}-FREE`,
    type: 'free',
  });

  // A SECOND calendar at 20%, so the reduced-but-paid case can be charged
  // rather than reasoned about: same tier, different team, different thread.
  const teamBId = await ins('team', {
    workspace_id: ws,
    name: `${TAG} team B`,
    slug: `${TAG}-team-b`,
    is_active: true,
    is_published: true,
  });
  await ins('membership_access_grant', {
    workspace_id: ws,
    tier_id: tierId,
    kind: 'team_calendar',
    config: { team_id: teamBId, discount_pct: 20 },
  });
  const partProgramId = await ins('program', {
    workspace_id: ws,
    app_id: app!.id,
    title: `${TAG} 20pc thread`,
    format: 'journey',
    status: 'active',
  });
  partialSlug = `${TAG}-partial`;
  partialOwnerSlug = `${TAG}-team-b`;
  partialThreadId = await ins('thread_thread', {
    workspace_id: ws,
    program_id: partProgramId,
    organiser_id: org!.id,
    slug: partialSlug,
    team_id: teamBId,
    price_cents: PRICE,
    price_currency: 'EUR',
    is_public_listed: true,
    public_enrolment_open: true,
    payment_methods: ['invoice'],
  });

  // And a thread that is free for EVERYBODY — the case his answer leaves
  // alone, so it must still write nothing.
  const freeProgramId = await ins('program', {
    workspace_id: ws,
    app_id: app!.id,
    title: `${TAG} free thread`,
    format: 'journey',
    status: 'active',
  });
  freeThreadSlug = `${TAG}-free`;
  freeThreadId = await ins('thread_thread', {
    workspace_id: ws,
    program_id: freeProgramId,
    organiser_id: org!.id,
    slug: freeThreadSlug,
    team_id: teamId,
    price_cents: null,
    is_public_listed: true,
    public_enrolment_open: true,
  });
}, 240_000);

test.afterAll(async () => {
  const service = stagingService();
  // Enrolments first: they reference the thread and the people.
  const { data: tes } = await service
    .from('thread_enrolment')
    .select('id, enrolment_id')
    .in('thread_id', [threadId, freeThreadId, partialThreadId].filter(Boolean));
  for (const te of tes ?? []) {
    await service.from('purchase').delete().eq('item_ref', te.id as string);
    await service.from('thread_enrolment').delete().eq('id', te.id);
    if (te.enrolment_id) await service.from('enrolment').delete().eq('id', te.enrolment_id);
  }
  await service.from('thread_coupon').delete().eq('thread_id', threadId);
  await service.from('purchase').delete().eq('workspace_id', ws).ilike('payer_email', `${TAG}%`);
  await service.from('purchase').delete().eq('workspace_id', ws).eq('payer_email', memberEmail);
  await service.from('person').delete().eq('workspace_id', ws).ilike('first_name', `${TAG}%`);
  for (const { table, id } of made) {
    const { error } = await service.from(table).delete().eq('id', id);
    if (error) console.error(`[fixtures] ${table} ${id}: ${error.message}`);
  }
}, 240_000);

test('the five cases, against the deployed API', async ({ page }) => {
  test.slow();
  const service = stagingService();

  // The OFFER is on the public payload, and says nothing about the visitor.
  const anonPayload = await page.request.get(
    `${API}/api/v1/thread/public/organiser/${ownerSlug}/thread/${threadSlug}`,
  );
  const anonBody = (await anonPayload.json()) as { member_discount_pct?: number | null };
  expect(anonBody.member_discount_pct, 'the offer is visible to a stranger').toBe(100);

  // 1. ANONYMOUS → list price. An invoice-method thread answers
  //    invoice_pending when something is owed.
  const anon = await enrol(page, `${TAG}-stranger@example.com`, null);
  expect(anon.status, JSON.stringify(anon.body)).toBe(201);
  expect(anon.body.invoice_pending, 'a stranger owes the list price').toBe(true);

  // 2. A REAL TOKEN for the member, enrolling their OWN address.
  //    Minted the way the pack mints every session: an sso_handoff code
  //    redeemed by the app, so this is the token a signed-in member has.
  await page.goto(await memberLandUrl(HOSTS.thread, 'the-thread', '/dashboard'));
  await page.waitForURL(/dashboard|no-access/, { timeout: 30_000 });
  // The session lives in a COOKIE (@supabase/ssr), which is why it is shared
  // across the apex in the first place. It may be split across `.0`/`.1`
  // chunks and prefixed `base64-`, so the parts are joined in name order
  // before decoding.
  const cookies = await page.context().cookies();
  const parts = cookies
    .filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => c.value)
    .join('');
  const decoded = parts.startsWith('base64-')
    ? Buffer.from(parts.slice(7), 'base64').toString('utf8')
    : decodeURIComponent(parts);
  let token: string | null = null;
  try {
    const parsed = JSON.parse(decoded) as { access_token?: string };
    token = parsed.access_token ?? null;
  } catch {
    token = null;
  }
  expect(token, 'the signed-in member has an access token in the browser').toBeTruthy();

  const member = await enrol(page, memberEmail, token);
  expect(member.status, JSON.stringify(member.body)).toBe(201);
  expect(
    member.body.invoice_pending,
    'a member at 100% owes nothing, so there is no invoice to wait for',
  ).toBeUndefined();
  expect(member.body.ok).toBe(true);

  // …AND THE LEDGER SAYS WHY. Sjoerd, 2026-10-12: a member's €0 join writes a
  // purchase row with the price actually paid and a reason, no invoice.
  const ledgerFor = async (payer: string) => {
    const { data } = await service
      .from('purchase')
      .select('amount_cents, status, method, discount_reason, item_label')
      .eq('workspace_id', ws)
      .eq('payer_email', payer);
    return data ?? [];
  };
  const memberRows = (await ledgerFor(memberEmail)).filter((r) => r.amount_cents === 0);
  console.log(`LEDGER membership: ${JSON.stringify(memberRows)}`);
  expect(memberRows, 'one row for the member join').toHaveLength(1);
  expect(memberRows[0]!.amount_cents, 'the price actually paid').toBe(0);
  expect(memberRows[0]!.method, 'no invoice to settle').toBe('free');
  expect(memberRows[0]!.status).toBe('paid');
  expect(memberRows[0]!.discount_reason, 'and why it was free').toBe('membership');
  expect(String(memberRows[0]!.item_label)).toContain('included in membership');

  // 3. The member's token, enrolling SOMEBODY ELSE → list price.
  const other = await enrol(page, `${TAG}-friend@example.com`, token);
  expect(other.status, JSON.stringify(other.body)).toBe(201);
  expect(other.body.invoice_pending, 'a membership is not spendable on a friend').toBe(true);

  // 3b. A 100%-OFF CODE, typed by a stranger: the same treatment, reason
  //     `coupon`. A code may be typed by anybody — that is what makes it a
  //     shared secret and an email not one.
  const couponEmail = `${TAG}-coupon@example.com`;
  const withCoupon = await enrol(page, couponEmail, null, {
    coupon: `${TAG.toUpperCase()}-FREE`,
  });
  expect(withCoupon.status, JSON.stringify(withCoupon.body)).toBe(201);
  const couponRows = await ledgerFor(couponEmail);
  console.log(`LEDGER coupon: ${JSON.stringify(couponRows)}`);
  expect(couponRows, 'one row for the code join').toHaveLength(1);
  expect(couponRows[0]!.amount_cents).toBe(0);
  expect(couponRows[0]!.method).toBe('free');
  expect(couponRows[0]!.discount_reason, 'the other reason').toBe('coupon');
  expect(String(couponRows[0]!.item_label)).toContain(TAG.toUpperCase());

  // 3c. A thread priced €0 for EVERYBODY: still no row. His answer covers a
  //     price brought down by a discount, not a thing that was never sold.
  const freeEmail = `${TAG}-freethread@example.com`;
  const freeJoin = await enrol(page, freeEmail, null, {
    slug: freeThreadSlug,
    free: true,
  });
  expect(freeJoin.status, JSON.stringify(freeJoin.body)).toBe(201);
  const freeRows = await ledgerFor(freeEmail);
  console.log(`LEDGER free thread: ${JSON.stringify(freeRows)}`);
  expect(freeRows, 'a thread that was free for everybody writes nothing').toHaveLength(0);

  // 3d. A REDUCED member price — 20%, not free. It must be CHARGED like any
  //     other paid enrolment (an invoice to settle) and still say why it was
  //     €28 rather than €35. A €0 row and a reduced row are the same rule at
  //     two ends of a range, and only one of them was ever going to be
  //     exercised by accident.
  const partial = await enrol(page, memberEmail, token, {
    slug: partialSlug,
    owner: partialOwnerSlug,
  });
  expect(partial.status, JSON.stringify(partial.body)).toBe(201);
  expect(partial.body.invoice_pending, 'a 20% member still owes 80%').toBe(true);
  const { data: partialRows } = await service
    .from('purchase')
    .select('amount_cents, status, method, discount_reason')
    .eq('workspace_id', ws)
    .eq('payer_email', memberEmail)
    .eq('amount_cents', Math.round(PRICE * 0.8));
  console.log(`LEDGER membership 20%: ${JSON.stringify(partialRows)}`);
  expect(partialRows, 'one row at 80% of the list price').toHaveLength(1);
  expect(partialRows![0]!.status, 'an ordinary invoice to settle').toBe('pending');
  expect(partialRows![0]!.method).toBe('invoice');
  expect(partialRows![0]!.discount_reason, 'and it still says why').toBe('membership');

  // 4. A FORGED bearer → list price, and no error.
  const forged = await enrol(
    page,
    `${TAG}-forged@example.com`,
    `${token}tampered`,
  );
  expect(forged.status, JSON.stringify(forged.body)).toBe(201);
  expect(forged.body.invoice_pending, 'a token that does not verify is no token').toBe(true);
});
