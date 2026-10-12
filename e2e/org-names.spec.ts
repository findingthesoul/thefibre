import { test, expect } from '@playwright/test';
import { HOSTS, landSignedInAsOwner } from './helpers.js';

// Organisation names (v0.75.3), through the real signed-in screen on STAGING.
// The database side was proven with the exact filter the API builds; this is
// the layer above it — the form field, the API's term normalisation and the
// list — which only a browser can vouch for.
//
// Depends on the staging seed: the EBBF organisation (short_name "EBBF",
// name "European Bahá'í Business Forum") in the fixture user's workspace. If
// that seed is gone the first assertion says so rather than passing empty.

// WHY THE HELPER, not page.goto of a land URL (2026-10-12): all five tests
// here sign the SAME owner account in, and two workers run them beside the
// rest of the suite. That is the race landSignedInAsOwner already handles —
// one landing in a parallel run occasionally ends somewhere other than the
// page asked for, which is why `land()` retries once and logs it. Landing by
// hand here cost a 30-second navigation timeout in the full suite on
// 2026-10-12, read as a product failure until the trace showed the hop.
test.describe('organisation search answers to every name (v0.75.3)', () => {
  for (const term of ['ebbf', 'bahai', "Bahá'í", 'european bahai']) {
    test(`"${term}" finds the European Bahá'í Business Forum`, async ({ page }) => {
      await landSignedInAsOwner(
        page,
        HOSTS.fibre,
        'fibre-platform',
        `/organisations?q=${encodeURIComponent(term)}`,
        /\/organisations/,
      );
      await expect(page.getByText(/European Bahá.í Business Forum/).first()).toBeVisible();
    });
  }

  test('the list shows the abbreviation beside the name', async ({ page }) => {
    await landSignedInAsOwner(
      page,
      HOSTS.fibre,
      'fibre-platform',
      '/organisations?q=ebbf',
      /\/organisations/,
    );
    // Case-insensitive: the abbreviation is data, and staging's was retyped as
    // "ebbf" on 2026-09-15. What this proves is that it sits beside the name.
    await expect(page.getByText(/Business Forum \(EBBF\)/i).first()).toBeVisible();
  });

  test('a term that matches nothing shows nothing, not everything', async ({ page }) => {
    await landSignedInAsOwner(
      page,
      HOSTS.fibre,
      'fibre-platform',
      '/organisations?q=zz-no-such-organisation',
      /\/organisations/,
    );
    // The POSITIVE half first. A count of zero is also what an unrendered
    // list gives you, so this test could pass while proving nothing — the
    // empty state is the page saying it searched and found nothing.
    await expect(page.getByText('No organisations yet.')).toBeVisible();
    await expect(page.getByText(/European Bahá.í Business Forum/)).toHaveCount(0);
  });
});
