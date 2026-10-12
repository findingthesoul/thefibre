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
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await page.request.post(`${API}/api/v1/thread/public/enrol`, {
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    data: {
      organiser_slug: ownerSlug,
      thread_slug: threadSlug,
      name: `${TAG} enroller`,
      email,
      payment_method: 'invoice',
      billing: { legal_name: `${TAG} payer`, address: 'Nowhere 1', tax_no: '' },
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
}, 240_000);

test.afterAll(async () => {
  const service = stagingService();
  // Enrolments first: they reference the thread and the people.
  const { data: tes } = await service.from('thread_enrolment').select('id, enrolment_id').eq('thread_id', threadId);
  for (const te of tes ?? []) {
    await service.from('purchase').delete().eq('item_ref', te.id as string);
    await service.from('thread_enrolment').delete().eq('id', te.id);
    if (te.enrolment_id) await service.from('enrolment').delete().eq('id', te.enrolment_id);
  }
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

  // …and the ledger says WHY it was free.
  const { data: purchases } = await service
    .from('purchase')
    .select('amount_cents, status, payer_email')
    .eq('workspace_id', ws)
    .eq('payer_email', memberEmail);
  const rows = purchases ?? [];
  // Printed, because which branch the product is in is the OPEN decision —
  // "does a €0 enrolment write a ledger row?" — and a run that answers it
  // silently in an annotation is a run nobody reads.
  console.log(
    `LEDGER after a €0 member join: ${rows.length} purchase row(s)` +
      (rows.length ? ` → ${JSON.stringify(rows)}` : ' → none'),
  );
  if (rows.length) {
    expect(rows[0]!.amount_cents, 'the ledger records what was actually paid').toBe(0);
  } else {
    // A €0 enrolment writing no ledger row at all is the open decision
    // (build-plan: "€0-with-code enrolments in the ledger?"), so this says
    // which branch the product is in rather than asserting one.
    test.info().annotations.push({
      type: 'open decision',
      description: 'a €0 member join wrote NO purchase row — the parked ledger question',
    });
  }

  // THE OFFER IS THE SAME FOR EVERY CALLER. `member_discount_pct` is a fact
  // about the product, so the payload must not vary with who is asking —
  // otherwise the field becomes the oracle the member price was kept away
  // from: "does this response change when I send my token?" would answer
  // whether that token belongs to a member.
  const withToken = await page.request.get(
    `${API}/api/v1/thread/public/organiser/${ownerSlug}/thread/${threadSlug}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const withForged = await page.request.get(
    `${API}/api/v1/thread/public/organiser/${ownerSlug}/thread/${threadSlug}`,
    { headers: { Authorization: `Bearer ${token}tampered` } },
  );
  const asMember = (await withToken.json()) as { member_discount_pct?: number | null };
  const asForged = (await withForged.json()) as { member_discount_pct?: number | null };
  expect(asMember.member_discount_pct, 'identical for a signed-in member').toBe(100);
  expect(asForged.member_discount_pct, 'identical for a forged token').toBe(100);
  expect(anonBody.member_discount_pct, 'and for a stranger').toBe(100);

  // 3. The member's token, enrolling SOMEBODY ELSE → list price.
  const other = await enrol(page, `${TAG}-friend@example.com`, token);
  expect(other.status, JSON.stringify(other.body)).toBe(201);
  expect(other.body.invoice_pending, 'a membership is not spendable on a friend').toBe(true);

  // 4. A FORGED bearer → list price, and no error.
  const forged = await enrol(
    page,
    `${TAG}-forged@example.com`,
    `${token}tampered`,
  );
  expect(forged.status, JSON.stringify(forged.body)).toBe(201);
  expect(forged.body.invoice_pending, 'a token that does not verify is no token').toBe(true);
});
