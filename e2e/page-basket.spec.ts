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
  await open(page, `?tier=${tierId}`);
  const bar = page.getByRole('button', { name: /Your basket/ });
  await expect(bar).toBeVisible();
  await expect(bar).toContainText('€');
  await bar.click();
  await expect(page.getByText('Subtotal excl. VAT')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' }).last()).toBeVisible();
});
