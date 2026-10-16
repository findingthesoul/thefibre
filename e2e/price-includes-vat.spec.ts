// "Price includes VAT" (2026-10-16), the admin switch end to end on STAGING:
// tick it in the tier dialog, save, reload — asked of the DATABASE and seen
// again — and the public card then shows the entered price "(incl. VAT)" with
// the net underneath.
//
// As the E2E FIXTURE admin, never a person. The fixture workspace is made
// VAT-registered for the run and put back EXACTLY as it was afterwards
// (invoice_details read first, restored by value); the seeded tier is removed
// by id.

import { expect, test } from '@playwright/test';
import { HOSTS, fixtureIdentity, landSignedIn, stagingService, waitForHydration } from './helpers.js';

const NAME = `e2e-inclvat-${Date.now().toString(36)}`;
let workspaceId = '';
let slug = '';
let tierId = '';
let savedInvoiceDetails: unknown = null;

test.beforeAll(async () => {
  const db = stagingService();
  workspaceId = (await fixtureIdentity()).workspaceId;
  const { data: ws } = await db.from('workspace').select('slug, invoice_details').eq('id', workspaceId).single();
  slug = ws!.slug as string;
  savedInvoiceDetails = ws!.invoice_details ?? null;
  const base = (savedInvoiceDetails && typeof savedInvoiceDetails === 'object' ? savedInvoiceDetails : {}) as Record<string, unknown>;
  await db.from('workspace').update({ invoice_details: { ...base, vat_registered: true, vat_rate_pct: 21 } }).eq('id', workspaceId);
  const { data: tier, error } = await db
    .from('membership_tier')
    .insert({ workspace_id: workspaceId, name: NAME, price_cents_year: 36300, currency: 'EUR', hidden: false, sort_order: -1 })
    .select('id')
    .single();
  if (error) throw new Error(`seed tier: ${error.message}`);
  tierId = tier!.id as string;
});

test.afterAll(async () => {
  const db = stagingService();
  if (tierId) await db.from('membership_tier').delete().eq('id', tierId);
  await db.from('workspace').update({ invoice_details: savedInvoiceDetails }).eq('id', workspaceId);
  const { data: ws } = await db.from('workspace').select('invoice_details').eq('id', workspaceId).single();
  expect(ws!.invoice_details ?? null).toEqual(savedInvoiceDetails);
  const { count } = await db.from('membership_tier').select('id', { count: 'exact', head: true }).eq('id', tierId);
  expect(count).toBe(0);
});

test('tick "Price includes VAT", save, reload: saved, and the card says incl.', async ({ page }) => {
  test.setTimeout(120_000);
  await landSignedIn(page, HOSTS.membership, 'membership', '/tiers', /\/tiers|no-access/);
  await waitForHydration(page, 'button');
  await page.getByRole('button', { name: new RegExp(NAME) }).first().click();
  const box = page.getByRole('checkbox', { name: /Price includes VAT/ });
  await expect(box).toBeVisible();
  await expect(box).not.toBeChecked();
  await box.check();
  await page.getByRole('button', { name: 'Save' }).last().click();

  // Asked of the database, not of the screen.
  await expect
    .poll(async () => (await stagingService().from('membership_tier').select('price_includes_vat').eq('id', tierId).single()).data?.price_includes_vat, { timeout: 20_000 })
    .toBe(true);

  // And still so after a reload.
  await page.reload();
  await waitForHydration(page, 'button');
  await page.getByRole('button', { name: new RegExp(NAME) }).first().click();
  await expect(page.getByRole('checkbox', { name: /Price includes VAT/ })).toBeChecked();

  // The public card: the entered price (incl. VAT), the net underneath.
  await page.goto(`${HOSTS.membership}/${slug}`);
  await waitForHydration(page, 'button');
  const card = page.locator('div').filter({ has: page.getByRole('heading', { name: NAME }) }).last();
  await expect(card).toContainText('(incl. VAT)');
  await expect(card).toContainText('300 excl. VAT');
});
