// The page basket on the public join page (2026-10-16), on STAGING, as an
// anonymous visitor — no sign-in, no person. The staging fixture community
// `basket-demo` (a tier with an add-on, a standalone product, VAT on).
//
//   · add a tier and a product → the basket says so; reload → still there
//   · ?tier=<id> (an invitation) on an empty basket → that tier IS in it
//   · ?cancelled=1&tier=… with a basket → it comes back exactly as it was
//   · a phone width shows the bar with the total

import { expect, test, type Page } from '@playwright/test';
import { HOSTS, stagingService, waitForHydration } from './helpers.js';

const SLUG = 'basket-demo';
const KEY = `thefibre.basket.${SLUG}`;
let tierId = '';

test.beforeAll(async () => {
  const db = stagingService();
  const { data: ws } = await db.from('workspace').select('id').eq('slug', SLUG).single();
  const { data: tier } = await db.from('membership_tier').select('id').eq('workspace_id', ws!.id).eq('name', 'Member').single();
  tierId = tier!.id as string;
});

const stored = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);
async function open(page: Page, query = '') {
  await page.goto(`${HOSTS.membership}/${SLUG}${query}`);
  await waitForHydration(page, 'button');
}

test('add, reload, still there', async ({ page }) => {
  await open(page);
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await open(page);
  await page.getByRole('button', { name: 'Add to basket' }).first().click();
  await page.getByRole('button', { name: 'Add to basket' }).first().click();
  await expect(page.getByText('In your basket').first()).toBeVisible();
  const before = await stored(page);
  expect(before.tierId).toBe(tierId);
  expect(before.productIds).toHaveLength(1);
  await page.reload();
  await waitForHydration(page, 'button');
  await expect(page.getByText('In your basket')).toHaveCount(2);
  expect(await stored(page)).toEqual(before);
});

test('?tier= lands with that tier in an empty basket', async ({ page }) => {
  await open(page);
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await open(page, `?tier=${tierId}`);
  await expect(page.getByText('In your basket').first()).toBeVisible();
  expect((await stored(page)).tierId).toBe(tierId);
});

test('a cancelled checkout comes back to the basket as it was', async ({ page }) => {
  await open(page);
  await page.evaluate(
    ([k, t]) => localStorage.setItem(k, JSON.stringify({ tierId: t, interval: 'month', productIds: [] })),
    [KEY, tierId] as const,
  );
  await open(page, `?cancelled=1&tier=${tierId}`);
  expect(await stored(page)).toEqual({ tierId, interval: 'month', productIds: [] });
});

test('a phone shows the bar with the total', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  // Not via ?tier= — that opens the sheet on arrival, by design, over the bar.
  await open(page);
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await open(page);
  await page.getByRole('button', { name: 'Add to basket' }).first().click();
  const bar = page.getByRole('button', { name: /Your basket/ });
  await expect(bar).toBeVisible();
  await expect(bar).toContainText('€');
  await bar.click();
  // The sheet (the wide panel is hidden at this width).
  await expect(page.getByRole('dialog').getByText('Subtotal excl. VAT')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Continue' })).toBeVisible();
});

// (a) The embed (a website iframe). Third-party storage can THROW there; the
// basket must still work — it just does not remember.
test('the embed works when storage throws', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${HOSTS.membership}/embed/page?workspace=${SLUG}`);
  await waitForHydration(page, 'button');
  await page.getByRole('button', { name: 'Add to basket' }).first().click();
  await expect(page.getByText('In your basket').first()).toBeVisible();
  expect(errors.filter((m) => /localStorage|SecurityError/.test(m))).toEqual([]);
});

// (b) A basket line the buyer already owns: the answer names it, and the
// viewer can take it out.
test('a line already owned is named, and can be removed', async ({ page }) => {
  const db = stagingService();
  const { data: ws } = await db.from('workspace').select('id').eq('slug', SLUG).single();
  const { data: prod } = await db.from('membership_product').select('id, name').eq('workspace_id', ws!.id).eq('name', 'Weekend workshop').single();
  const email = `e2e-basket-owned-${Date.now()}@example.com`;
  const { data: person } = await db.from('person').insert({ workspace_id: ws!.id, email, first_name: 'Owned' }).select('id').single();
  await db.from('membership_product_purchase').insert({ workspace_id: ws!.id, person_id: person!.id, product_id: prod!.id, stripe_session_id: `e2e-owned-${Date.now()}`, amount_cents: 8000, currency: 'EUR', status: 'paid' });
  try {
    await open(page);
    await page.evaluate(
      ([k, p]) => {
        localStorage.setItem(k, JSON.stringify({ tierId: null, interval: 'year', productIds: [p] }));
        localStorage.setItem('thefibre.join.country', 'NL');
      },
      [KEY, prod!.id] as const,
    );
    await open(page);
    await page.getByRole('button', { name: 'Continue' }).last().click();
    await page.getByPlaceholder('Your name').last().fill('Owned Buyer');
    await page.getByPlaceholder('you@example.com').last().fill(email);
    await page.getByRole('button', { name: 'Continue to payment' }).last().click();
    await expect(page.getByText(`You already have: ${prod!.name}`).first()).toBeVisible();
    await page.getByRole('button', { name: 'Back to your basket' }).last().click();
    await page.getByRole('button', { name: `Remove ${prod!.name}` }).last().click();
    await expect.poll(async () => (await stored(page)).productIds).toEqual([]);
  } finally {
    await db.from('membership_product_purchase').delete().eq('person_id', person!.id);
    await db.from('person').update({ deleted_at: new Date().toISOString() }).eq('id', person!.id);
  }
});

// A RECURRING product sold on its own, WITHOUT a membership (2026-10-16): it
// goes in the basket and checks out as a SUBSCRIBE — the page posts to
// /public/subscribe and leaves for Stripe's checkout. A product of its own,
// seeded and removed by id; the person the checkout creates is soft-deleted.
test('a recurring product without a membership checks out as a subscription', async ({ page }) => {
  test.setTimeout(120_000);
  const db = stagingService();
  const { data: ws } = await db.from('workspace').select('id').eq('slug', SLUG).single();
  const name = `E2E monthly circle ${Date.now().toString(36)}`;
  // Opened to non-members explicitly — members only is the default.
  const { data: prod } = await db.from('membership_product').insert({ workspace_id: ws!.id, name, price_cents: 1500, price_interval: 'month', purchasable: true, sold_without_membership: true }).select('id').single();
  const email = `e2e-basket-sub-${Date.now()}@example.com`;
  try {
    await open(page);
    await page.evaluate(([k]) => {
      localStorage.removeItem(k);
      localStorage.setItem('thefibre.join.country', 'NL');
    }, [KEY] as const);
    await open(page);
    // The card offers it — no "With a membership".
    const card = page.locator('div').filter({ has: page.getByRole('heading', { name }) }).last();
    await card.getByRole('button', { name: 'Add to basket' }).click();
    await expect.poll(async () => (await stored(page))?.productIds ?? []).toEqual([prod!.id]);
    await page.getByRole('button', { name: 'Continue' }).last().click();
    await page.getByPlaceholder('Your name').last().fill('Sub Scriber');
    await page.getByPlaceholder('you@example.com').last().fill(email);
    const [req] = await Promise.all([
      page.waitForRequest((r) => r.url().includes('/membership/public/subscribe') && r.method() === 'POST', { timeout: 30_000 }),
      page.getByRole('button', { name: 'Continue to payment' }).last().click(),
    ]);
    expect(JSON.parse(req.postData() ?? '{}')).toMatchObject({ product_ids: [prod!.id], workspace_slug: SLUG });
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  } finally {
    const { data: persons } = await db.from('person').select('id').eq('workspace_id', ws!.id).eq('email', email);
    for (const p of persons ?? []) await db.from('person').update({ deleted_at: new Date().toISOString() }).eq('id', p.id);
    await db.from('membership_product').delete().eq('id', prod!.id);
    const { count } = await db.from('membership_product').select('id', { count: 'exact', head: true }).eq('id', prod!.id);
    expect(count).toBe(0);
  }
});

// MEMBERS ONLY by default (2026-10-16, production soul.com): a purchasable
// renewing product the community did NOT open says "With a membership" to a
// visitor with no membership in the basket, and cannot be added.
test('a members-only renewing product says "With a membership" without one', async ({ page }) => {
  const db = stagingService();
  const { data: ws } = await db.from('workspace').select('id').eq('slug', SLUG).single();
  const name = `E2E members email ${Date.now().toString(36)}`;
  const { data: prod } = await db.from('membership_product').insert({ workspace_id: ws!.id, name, price_cents: 20000, price_interval: 'year', purchasable: true }).select('id').single();
  try {
    await open(page);
    await page.evaluate(([k]) => localStorage.removeItem(k), [KEY] as const);
    await open(page);
    const card = page.locator('div').filter({ has: page.getByRole('heading', { name }) }).last();
    const button = card.getByRole('button', { name: 'With a membership' });
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
  } finally {
    await db.from('membership_product').delete().eq('id', prod!.id);
    const { count } = await db.from('membership_product').select('id', { count: 'exact', head: true }).eq('id', prod!.id);
    expect(count).toBe(0);
  }
});

