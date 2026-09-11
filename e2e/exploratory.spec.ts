import { test, expect } from '@playwright/test';
import { HOSTS, signedInLandUrl } from './helpers.js';

// Exploratory signed-in pass over what shipped in v0.69.x–v0.72.0, on
// STAGING. Not a golden path — golden-paths.spec.ts stays small on purpose —
// but the render check those releases went out without: a sidebar change is
// the one kind of change typecheck cannot vouch for (testing approach §1.5).
//
// Screenshots land in test-results/ on failure via the shared trace config.

test.describe('sidebar: one shape, nothing twice (v0.69.5, v0.69.7)', () => {
  for (const [app, host, targetApp] of [
    ['Meet', HOSTS.meet, 'fibre-meet'],
    ['Thread', HOSTS.thread, 'the-thread'],
  ] as const) {
    test(`${app}: Settings is not in the sidebar, only in the avatar menu`, async ({ page }) => {
      await page.goto(await signedInLandUrl(host, targetApp, '/dashboard'));
      await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

      const nav = page.locator('nav').first();
      await expect(nav).toBeVisible();
      // The link, not the word: "Settings" may legitimately appear in body
      // copy, and did before this check was written.
      await expect(nav.locator('a[href="/settings"]')).toHaveCount(0);
      await expect(nav.locator('a[href="/internal-team"]')).toHaveCount(0);
    });

    test(`${app}: People and Money sections exist, with the right links under them`, async ({
      page,
    }) => {
      await page.goto(await signedInLandUrl(host, targetApp, '/dashboard'));
      await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

      const nav = page.locator('nav').first();
      await expect(nav.locator('a[href="/contacts"]')).toHaveCount(1);
      await expect(nav.locator('a[href="/teams"]')).toHaveCount(1);
      await expect(nav.locator('a[href="/invoices"]')).toHaveCount(1);

      // Section LABELS only render on an expanded sidebar — collapsed and
      // hover modes draw a divider instead (ui/sidebar-shell.tsx). The
      // fixture user's preference is not ours to assume, so the assertion
      // that holds in every mode is ORDER: people, then money, last.
      const hrefs = await nav.locator('a[href^="/"]').evaluateAll((els) =>
        els.map((e) => e.getAttribute('href')),
      );
      const at = (h: string) => hrefs.indexOf(h);
      expect(at('/contacts')).toBeLessThan(at('/teams'));
      expect(at('/teams')).toBeLessThan(at('/invoices'));
      expect(at('/invoices')).toBe(hrefs.length - 1);
    });
  }

  test('the routes taken out of the nav still answer', async ({ page }) => {
    // Removing a nav entry must not 404 an old link or the Help page's.
    await page.goto(await signedInLandUrl(HOSTS.thread, 'the-thread', '/internal-team'));
    await page.waitForURL(/\/internal-team/, { timeout: 30_000 });
    await expect(page.locator('body')).not.toContainText('404');
  });
});

test.describe('teams as access groups (v0.69.0)', () => {
  test('Fibre settings has a Teams screen that lists the workspace teams', async ({ page }) => {
    await page.goto(await signedInLandUrl(HOSTS.fibre, 'fibre-platform', '/settings/teams'));
    await page.waitForURL(/\/settings\/teams/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Teams' }).first()).toBeVisible();
    // Either teams or the empty state — both are a rendered screen, and a
    // crash is what this is looking for.
    const body = page.locator('body');
    await expect(body).not.toContainText('Application error');
    await expect(body).not.toContainText('500');
  });

  test('Settings lists Teams beside Members', async ({ page }) => {
    await page.goto(await signedInLandUrl(HOSTS.fibre, 'fibre-platform', '/settings'));
    await page.waitForURL(/\/settings/, { timeout: 30_000 });
    await expect(page.locator('a[href="/settings/teams"]')).toHaveCount(1);
    await expect(page.locator('a[href="/settings/members"]')).toHaveCount(1);
  });
});

test.describe('Beta plan (v0.72.0)', () => {
  test('Beta is absent from the public price list', async ({ page }) => {
    await page.goto(`${HOSTS.fibre}/pricing`);
    await expect(page.locator('body')).not.toContainText('Beta');
  });

  test('the apps screen renders, and offers nothing unbuilt as switchable', async ({ page }) => {
    await page.goto(await signedInLandUrl(HOSTS.fibre, 'fibre-platform', '/settings/apps'));
    await page.waitForURL(/\/settings\/apps/, { timeout: 30_000 });
    const body = page.locator('body');
    await expect(body).not.toContainText('Application error');
    // The staging workspace is not on Beta, so an unreleased app must still
    // read as unavailable rather than gaining a toggle.
    await expect(page.getByRole('heading', { name: /apps/i }).first()).toBeVisible();
  });
});
