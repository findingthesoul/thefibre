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

// Release 2: the pages beyond Next, in the same member's Dutch.
test('the other pages follow: Files, Notifications, Help, Upcoming, Members', async ({ page, context }) => {
  test.slow();
  await context.addCookies([{ name: 'thefibre.locale', value: 'nl', url: HOSTS.my }]);
  await landPortalAsUpcoming(page, '/files');
  await expect(page.getByRole('heading', { level: 1, name: 'Bestanden' })).toBeVisible({ timeout: 30_000 });
  await page.goto(`${HOSTS.my}/notifications`);
  await expect(page.getByRole('heading', { level: 1, name: 'Meldingen' })).toBeVisible();
  await page.goto(`${HOSTS.my}/help`);
  await expect(page.getByRole('heading', { level: 1, name: 'Help' })).toBeVisible();
  await expect(page.getByText('Je ticket en de check-incode vinden')).toBeVisible();
  await page.goto(`${HOSTS.my}/upcoming`);
  await expect(page.getByText('Waar je lidmaatschap je toegang toe geeft, tegen jouw prijs.')).toBeVisible();
  // Members: whichever state this fixture's communities put it in (one list,
  // a choice of lists, or none), the heading is Dutch — "Leden" or
  // "Leden van <community>" — and no English heading is left.
  await page.goto(`${HOSTS.my}/members`);
  await expect(page.getByRole('heading', { level: 1, name: /^Leden( van .+)?$/ })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: /^Members/ })).toHaveCount(0);
});

// Phase 2: You (its tabs) and Purchases, in the same member's Dutch.
test('You and Purchases follow too', async ({ page, context }) => {
  test.slow();
  await context.addCookies([{ name: 'thefibre.locale', value: 'nl', url: HOSTS.my }]);
  await landPortalAsUpcoming(page, '/you');
  await expect(page.getByRole('heading', { level: 1, name: 'Jij' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: 'Profiel' }).or(page.getByRole('tab', { name: 'Profiel' })).first()).toBeVisible();
  await page.goto(`${HOSTS.my}/you?tab=notifications`);
  await expect(page.getByRole('heading', { name: 'Je agenda' })).toBeVisible();
  await page.goto(`${HOSTS.my}/purchases`);
  await expect(page.getByRole('heading', { level: 1, name: 'Aankopen' })).toBeVisible();
});
