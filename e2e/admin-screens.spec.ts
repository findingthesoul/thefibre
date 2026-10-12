import { test, expect } from '@playwright/test';
import { HOSTS, landSignedIn, waitForListLoaded } from './helpers.js';

// The platform's admin screens, seen WITHOUT signing in as a person.
//
// /admin/* is for the platform super admin, and until 2026-10-04 the only
// account that was one on staging was Sjoerd's own: to look at the invoices
// list or an invoice dialog, a session had to be minted for him. The fixture
// account is now a super admin on staging (e2e/identities.ts, behind a guard
// that refuses any other project), and its workspace holds two seeded
// purchases, so these screens can simply be opened.
//
// Looks only: nothing here presses a control that commits.

const ADMIN = ['/admin/invoices', '/admin/workspaces', '/admin/plans', '/admin/economics', '/admin/apps', '/admin/vat', '/admin/access-requests'];

for (const path of ADMIN) {
  test(`${path} opens for the fixture, and renders`, async ({ page }) => {
    await landSignedIn(page, HOSTS.fibre, 'fibre-platform', path, new RegExp(path.replace(/\//g, '\\/')));
    const body = page.locator('body');
    await expect(body).not.toContainText('Application error');
    await expect(body).not.toContainText(/API (4|5)\d\d/);
    await expect(page.getByRole('heading').first()).toBeVisible();
  });
}

test('the platform invoices list shows the fixture workspace’s seeded platform purchase', async ({ page }) => {
  await landSignedIn(page, HOSTS.fibre, 'fibre-platform', '/admin/invoices', /\/admin\/invoices/);
  // The list fills client-side, so WAIT FOR IT TO FINISH before reading it —
  // this spec's one recorded flake was this assertion racing that fetch
  // (helpers.ts: waitForListLoaded says why a longer text timeout is worse).
  await waitForListLoaded(page);
  // /admin/invoices is what workspaces pay the platform: the paid platform row.
  // Two seconds, not the default five: the list has FINISHED loading, so the
  // row is there or it is not, and the text arrived 4-9ms after the busy
  // region cleared in every measured run. A short budget after a state wait
  // is what makes a missing row fail quickly instead of looking slow.
  await expect(page.locator('body')).toContainText(
    'E2E fixture: platform subscription (do not edit)',
    { timeout: 2_000 },
  );
});

test('Thread’s Invoices page shows the pending invoice-method purchase, with something to act on', async ({ page }) => {
  await landSignedIn(page, HOSTS.thread, 'the-thread', '/invoices', /\/invoices/);
  const body = page.locator('body');
  await expect(body).not.toContainText('Application error');
  await waitForListLoaded(page);
  // The pending row a "Send payment link" would act on. Looked at, not pressed.
  await expect(body).toContainText('E2E fixture: ticket on invoice (do not edit)', {
    timeout: 2_000,
  });
});
