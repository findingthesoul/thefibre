// The member directory's admin surfaces, measured rather than eyeballed.
//
// WHY A MEASUREMENT AND NOT A SCREENSHOT. On 2026-10-04 Sjoerd made four
// categories on staging and reported he could not select them in a product.
// They were there the whole time — rendering correctly, in the right
// workspace, from a successful fetch — 610px down a dialog whose visible area
// is 492px. Present, populated, and off-screen. A control nobody scrolls to
// is a control that does not exist, so "it renders" is the wrong assertion:
// the one that would have caught it is "it is visible without scrolling".
//
// Signs in as the E2E FIXTURE identity, never the owner (e2e/identities.ts),
// and seeds its own community — the fixture deliberately ships without one.
// Everything it creates, it removes.

import { expect, test } from '@playwright/test';
import {
  HOSTS,
  fixtureIdentity,
  landSignedIn,
  stagingService,
  waitForHydration,
} from './helpers.js';

const TAG = 'e2e-directory';
let workspaceId = '';
let categoryId = '';
let productId = '';

test.beforeAll(async () => {
  const service = stagingService();
  const identity = await fixtureIdentity();
  workspaceId = identity.workspaceId;

  const { data: cat, error: catErr } = await service
    .from('membership_directory_category')
    .insert({ workspace_id: workspaceId, name: `${TAG} category` })
    .select('id')
    .single();
  if (catErr) throw new Error(`seed category: ${catErr.message}`);
  categoryId = cat.id as string;

  const { data: prod, error: prodErr } = await service
    .from('membership_product')
    .insert({ workspace_id: workspaceId, name: `${TAG} product` })
    .select('id')
    .single();
  if (prodErr) throw new Error(`seed product: ${prodErr.message}`);
  productId = prod.id as string;
});

test.afterAll(async () => {
  const service = stagingService();
  if (productId) {
    await service.from('membership_product_category').delete().eq('product_id', productId);
    await service.from('membership_product').delete().eq('id', productId);
  }
  if (categoryId) {
    await service.from('membership_directory_category').delete().eq('id', categoryId);
  }
});

test('the settings screen renders both sections', async ({ page }) => {
  await landSignedIn(
    page,
    HOSTS.membership,
    'membership',
    '/settings/directory',
    /\/settings\/directory|no-access/,
  );
  await waitForHydration(page, 'select, input[type="checkbox"]');

  const selects = await page.locator('select').count();
  const checkboxes = await page.locator('input[type="checkbox"]').count();
  expect(selects, 'the visibility-mode select should render').toBeGreaterThan(0);
  expect(checkboxes, 'the two workspace switches should render').toBeGreaterThanOrEqual(2);
  await expect(page.getByText(`${TAG} category`)).toBeVisible();
});

test('the product dialog offers categories WITHOUT scrolling', async ({ page }) => {
  await landSignedIn(page, HOSTS.membership, 'membership', '/products', /\/products|no-access/);
  await waitForHydration(page, 'button');

  await page.getByText(`${TAG} product`, { exact: true }).first().click();
  await page.getByText(/Directory categories/i).first().waitFor({ state: 'attached' });

  // The assertion the original bug would have failed. Not "is it in the DOM"
  // — it always was — but "can a person see it without being told to scroll".
  const geometry = await page.evaluate(() => {
    const label = [...document.querySelectorAll('label')].find((l) =>
      /Directory categories/i.test(l.textContent || ''),
    );
    if (!label) return null;
    const scroller = label.closest('[class*="overflow"]');
    const r = label.getBoundingClientRect();
    const sr = scroller ? scroller.getBoundingClientRect() : null;
    if (!sr) return null;
    return {
      offsetInsideDialog: Math.round(r.top - sr.top),
      visibleAreaHeight: Math.round(sr.height),
      visibleWithoutScrolling: r.top >= sr.top && r.bottom <= sr.top + sr.height,
    };
  });
  console.log(`[directory] categories geometry: ${JSON.stringify(geometry)}`);

  expect(geometry, 'the categories label should be found inside the dialog').not.toBeNull();
  expect(
    geometry!.visibleWithoutScrolling,
    `the categories section must be visible without scrolling — it sat at ${geometry!.offsetInsideDialog}px in a ${geometry!.visibleAreaHeight}px window when Sjoerd could not find it`,
  ).toBe(true);

  await expect(page.getByText(`${TAG} category`)).toBeVisible();
});
