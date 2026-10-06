import { test, expect } from '@playwright/test';
import { HOSTS } from './helpers.js';

// A customer's own host for the public pages (docs/domain-package.md part 2),
// walked for real on STAGING.
//
// Needs a host whose DNS we control pointing at Vercel and registered through
// Settings → Your domain for a staging workspace — the "staging twin":
// `fixture-book.thefibre.tech` (one TransIP CNAME to cname.vercel-dns.com,
// Sjoerd's hands) attached to the Meet host `sjoerd-luteijn-z5i` in the
// `default` workspace. Until that exists the spec SKIPS and says so; it
// never passes on nothing. Set:
//   E2E_TENANT_HOST=fixture-book.thefibre.tech
//   E2E_TENANT_ROOT=sjoerd-luteijn-z5i      (the owner root it was registered for)
//   E2E_TENANT_MT=zoom-test                 (a meeting type under that root)
//
// What it proves: the owner page renders at the bare host; the booking flow
// renders at /<mt>; the signed-in path /my is sent to the canonical origin;
// and the OLD link on our own host still works — the customer host is an
// extra door, never a move.

const host = process.env.E2E_TENANT_HOST;
const root = process.env.E2E_TENANT_ROOT ?? '';
const mt = process.env.E2E_TENANT_MT ?? '';

test.describe('a customer host serves the public pages', () => {
  test.skip(!host || !root || !mt, 'E2E_TENANT_HOST / E2E_TENANT_ROOT / E2E_TENANT_MT not set — the staging twin is not registered yet');

  test('the bare host is the owner page, and /<mt> is the booking flow', async ({ page }) => {
    const r1 = await page.goto(`https://${host}/`);
    expect(r1?.status()).toBe(200);
    await expect(page.locator('body')).not.toContainText(/Application error|404/);
    await expect(page.getByRole('heading').first()).toBeVisible();

    const r2 = await page.goto(`https://${host}/${mt}`);
    expect(r2?.status()).toBe(200);
    await expect(page.locator('body')).not.toContainText(/Application error|404/);
  });

  test('a path already carrying the root is left alone', async ({ page }) => {
    const r = await page.goto(`https://${host}/${root}/${mt}`);
    expect(r?.status()).toBe(200);
  });

  test('the signed-in path goes to the canonical origin', async ({ page }) => {
    await page.goto(`https://${host}/my`);
    expect(new URL(page.url()).host).toBe(new URL(HOSTS.meet).host);
  });

  test('the old link on our own host keeps working', async ({ page }) => {
    const r = await page.goto(`${HOSTS.meet}/${root}/${mt}`);
    expect(r?.status()).toBe(200);
    await expect(page.locator('body')).not.toContainText(/Application error|404/);
  });
});
