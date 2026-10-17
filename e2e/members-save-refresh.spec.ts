// MEMBERS: A CLICK SHOWS THAT IT TOOK (2026-10-17, Sjoerd: "very often I have
// to click twice or three times, or I don't see what is happening").
//
// Guards v1.275.0's claims on STAGING, as the fixture admin:
//  · a Save closes its dialog only once the new data is on screen — checked
//    by creating a tier and finding it in the list AT the moment the dialog
//    closes, no polling, no reload. This is also what keeps the removal of
//    revalidatePath from the tier actions honest: if the refresh ever stops
//    bringing the new row, this fails;
//  · a members filter chip lights before the server answers.
// The tier is removed by name afterwards, and read back gone.
// MEM_BASE points it at another build (a local production build).

import { expect, test } from '@playwright/test';
import { HOSTS, landSignedIn, stagingService, waitForHydration } from './helpers.js';

const BASE = process.env.MEM_BASE ?? HOSTS.membership;

async function signIn(page: import('@playwright/test').Page, path: string) {
  await landSignedIn(page, HOSTS.membership, 'membership', path, new RegExp(`${path}|no-access`));
  if (BASE !== HOSTS.membership) {
    const cookies = (await page.context().cookies()).filter((c) => c.name.startsWith('sb-'));
    await page.context().addCookies(cookies.map((c) => ({ name: c.name, value: c.value, domain: 'localhost', path: '/' })));
  }
  await page.goto(`${BASE}${path}`, { timeout: 120_000 });
  await waitForHydration(page, 'button');
}

test('a new tier is in the list at the moment its dialog closes', async ({ page }) => {
  test.setTimeout(180_000);
  const NAME = `e2e-refresh-proof ${Date.now().toString(36)}`;
  try {
    await signIn(page, '/tiers');
    await page.getByRole('button', { name: 'New tier' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name', { exact: true }).fill(NAME);
    const t0 = Date.now();
    await dialog.getByRole('button', { name: /^Save/ }).click();
    await dialog.waitFor({ state: 'hidden', timeout: 60_000 });
    const closed = Date.now() - t0;
    // Counted at once: the dialog may only close once the row is there.
    const atClose = await page.locator('main').getByText(NAME).count();
    console.log(`tier Save: dialog closed at ${closed} ms, new row present at close: ${atClose > 0}`);
    expect(atClose, 'the list had the new tier when the dialog closed').toBeGreaterThan(0);
  } finally {
    const db = stagingService();
    await db.from('membership_tier').delete().eq('name', NAME);
    const { count } = await db.from('membership_tier').select('id', { count: 'exact', head: true }).eq('name', NAME);
    expect(count ?? 0, 'the proof tier was removed').toBe(0);
  }
});

test('a members filter chip lights at once', async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, '/members');
  const t0 = Date.now();
  await page.getByRole('button', { name: 'Lapsed', exact: true }).click();
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some((b) => b.textContent === 'Lapsed' && b.className.includes('bg-ink')),
    null,
    { timeout: 5_000 },
  );
  const lit = Date.now() - t0;
  await page.waitForURL(/status=lapsed/, { timeout: 30_000 });
  console.log(`members chip: lit at ${lit} ms, filtered list at ${Date.now() - t0} ms`);
  // Before v1.275.0 the chip waited for the server (~0.3–1 s).
  expect(lit).toBeLessThan(250);
});
