import { test, expect } from '@playwright/test';
import { HOSTS, signedInLandUrl } from './helpers.js';

// Organisation names (v0.75.3), through the real signed-in screen on STAGING.
// The database side was proven with the exact filter the API builds; this is
// the layer above it — the form field, the API's term normalisation and the
// list — which only a browser can vouch for.
//
// Depends on the staging seed: the EBBF organisation (short_name "EBBF",
// name "European Bahá'í Business Forum") in the fixture user's workspace. If
// that seed is gone the first assertion says so rather than passing empty.

test.describe('organisation search answers to every name (v0.75.3)', () => {
  for (const term of ['ebbf', 'bahai', "Bahá'í", 'european bahai']) {
    test(`"${term}" finds the European Bahá'í Business Forum`, async ({ page }) => {
      await page.goto(
        await signedInLandUrl(
          HOSTS.fibre,
          'fibre-platform',
          `/organisations?q=${encodeURIComponent(term)}`,
        ),
      );
      await page.waitForURL(/\/organisations/, { timeout: 30_000 });
      await expect(page.getByText(/European Bahá.í Business Forum/).first()).toBeVisible();
    });
  }

  test('the list shows the abbreviation beside the name', async ({ page }) => {
    await page.goto(await signedInLandUrl(HOSTS.fibre, 'fibre-platform', '/organisations?q=ebbf'));
    await page.waitForURL(/\/organisations/, { timeout: 30_000 });
    // Case-insensitive: the abbreviation is data, and staging's was retyped as
    // "ebbf" on 2026-09-15. What this proves is that it sits beside the name.
    await expect(page.getByText(/Business Forum \(EBBF\)/i).first()).toBeVisible();
  });

  test('a term that matches nothing shows nothing, not everything', async ({ page }) => {
    await page.goto(
      await signedInLandUrl(HOSTS.fibre, 'fibre-platform', '/organisations?q=zz-no-such-organisation'),
    );
    await page.waitForURL(/\/organisations/, { timeout: 30_000 });
    await expect(page.getByText(/European Bahá.í Business Forum/)).toHaveCount(0);
  });
});
