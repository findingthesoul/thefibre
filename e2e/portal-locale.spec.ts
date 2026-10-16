// my.thread in six languages (2026-10-16): the reader's language decides the
// page, by the shared rule (resolvePortalLocale) — this browser's cookie,
// then the person's own choice, then the browser's Accept-Language, then
// English. These look at the deployed staging portal, as the fixture member
// and as a stranger; nothing is written to staging.

import { expect, test } from '@playwright/test';
import { HOSTS, landPortalAsUpcoming } from './helpers.js';

test.describe('a stranger, by their browser', () => {
  test.use({ locale: 'fr-FR' });

  test('the sign-in screen is in French, and says so in <html lang>', async ({ page }) => {
    await page.goto(`${HOSTS.my}/`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByText('Ton adresse e-mail')).toBeVisible();
    // The shared participant-auth copy, not a second translation of it.
    await expect(page.getByRole('button', { name: 'Recevoir un code par e-mail' })).toBeVisible();
  });

  test('the menu on that screen switches it, for this browser', async ({ page }) => {
    await page.goto(`${HOSTS.my}/`);
    await page.getByLabel('Langue').selectOption('nl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'nl', { timeout: 15_000 });
    await expect(page.getByText('Je e-mailadres')).toBeVisible();
  });
});

test('a signed-in member’s cookie wins over their browser', async ({ page, context }) => {
  test.slow();
  await context.addCookies([{ name: 'thefibre.locale', value: 'nl', url: HOSTS.my }]);
  await landPortalAsUpcoming(page, '/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl', { timeout: 30_000 });
  // The nav, the frame's own words.
  await expect(page.getByRole('link', { name: 'Leden' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Meldingen' }).first()).toBeVisible();
});

test('English stays English', async ({ page, context }) => {
  test.slow();
  await context.addCookies([{ name: 'thefibre.locale', value: 'en', url: HOSTS.my }]);
  await landPortalAsUpcoming(page, '/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: 30_000 });
  await expect(page.getByRole('link', { name: 'Members' }).first()).toBeVisible();
});
