// The Purchases page — where a member finds the invoice for what they paid.
//
// The welcome email tells every new member that "Purchases — every invoice,
// to download whenever you need it" is waiting for them, so the page has to
// actually show one. Nothing checked that: the ledger write is covered by
// `stress-webhook-shapes.mjs` and the API by the portal's own tests, but
// whether the ROW reaches the screen, with its amount and its label, was
// unverified on either stack.
//
// It seeds the ledger row directly rather than paying for one. A real
// payment here would mean a Stripe charge and an append-only activity row
// that pins its workspace forever; the question this answers is about the
// PAGE, and the row's shape is the same whoever wrote it.
//
// Everything it creates it removes.
import { expect, test } from '@playwright/test';
import { HOSTS, fixtureIdentity, landSignedIn, stagingService } from './helpers.js';

const TAG = 'e2e-portal-purchases';
const AMOUNT_CENTS = 349320; // the cohort-with-extras basket, in cents
const LABEL = `${TAG} membership — Community member (until 2026-12-31)`;

let personId = '';
let purchaseId = '';
let appId = '';

test.beforeAll(async () => {
  const service = stagingService();
  const fixture = await fixtureIdentity();

  // The fixture's own person row, by the email its session carries — the
  // portal resolves what to show from the PROVEN email, so a purchase
  // attached to any other person would simply not appear and the test would
  // fail for the wrong reason.
  const { data: person, error: pErr } = await service
    .from('person')
    .select('id, workspace_id')
    .ilike('email', fixture.email)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (pErr) throw new Error(`fixture person: ${pErr.message}`);
  if (!person) throw new Error(`no person row for ${fixture.email}`);
  personId = person.id as string;

  const { data: app, error: aErr } = await service
    .from('app')
    .select('id')
    .eq('slug', 'membership')
    .single();
  if (aErr) throw new Error(`membership app: ${aErr.message}`);
  appId = app.id as string;

  const { data: row, error } = await service
    .from('purchase')
    .insert({
      workspace_id: person.workspace_id,
      app_id: appId,
      person_id: personId,
      item_ref: `${TAG}-${Date.now()}`,
      item_label: LABEL,
      amount_cents: AMOUNT_CENTS,
      currency: 'EUR',
      method: 'stripe',
      status: 'paid',
    })
    .select('id')
    .single();
  if (error) throw new Error(`seed purchase: ${error.message}`);
  purchaseId = row.id as string;
}, 60_000);

test.afterAll(async () => {
  if (purchaseId) {
    const r = await stagingService().from('purchase').delete().eq('id', purchaseId);
    if (r.error) console.warn(`[e2e] purchase ${purchaseId} NOT removed: ${r.error.message}`);
  }
});

for (const [label, width, height] of [
  ['phone', 375, 812],
  ['desktop', 1280, 900],
] as const) {
  test(`${label}: a member finds what they paid, with the amount`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width, height });
    // The portal has no /sso/land of its own — it is a participant surface.
    // A session minted on thread.thefibre.tech carries to my.thefibre.tech on
    // the shared apex cookie, which is how a member reaches it from the
    // welcome email.
    await landSignedIn(page, HOSTS.thread, 'the-thread', '/dashboard', /\/dashboard/);
    await page.goto(`${HOSTS.my}/purchases`);
    await page.waitForURL(/\/purchases/, { timeout: 30_000 });

    // THE LABEL, so this is the row and not merely a page that rendered.
    await expect(page.getByText(new RegExp(TAG))).toBeVisible({ timeout: 30_000 });

    // AND THE AMOUNT, formatted. The row is useless without it — "every
    // invoice, to download" means nothing if the page cannot say what was
    // paid. Either separator: the portal formats by locale and the point is
    // the number, not the punctuation.
    await expect(page.getByText(/3[.,]493[.,]20/).first()).toBeVisible();
  });
}
