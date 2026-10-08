import { test, expect } from '@playwright/test';
import { HOSTS, landSignedIn, waitForHydration } from './helpers.js';

// The member dialog, which is where an admin thinks about ONE PERSON.
//
// Sjoerd, 2026-10-08: opening a person showed only per-app ticks and no
// teams at all — on a platform where teams are now the way in. So the dialog
// leads with the teams, shows the automatic pair as fixed rows that say who
// decides them, and marks each app a team confers with "via <team>" so a
// ticked app cannot be mistaken for a deliberate exception.
//
// Signed in as the e2e fixture, which is a workspace admin in its own
// workspace. Looks and reads; presses nothing that writes.

test('a member opens with their teams above the app ticks', async ({ page }) => {
  await landSignedIn(page, HOSTS.fibre, 'fibre-platform', '/settings/members', /\/settings\/members/);
  await waitForHydration(page);

  // Open the first member row.
  await page.getByText('e2e-fixture@example.com').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await waitForHydration(page, '[role="dialog"]');

  // Teams, with the line that says what they decide.
  await expect(dialog.getByText(/^Teams$/)).toBeVisible();
  await expect(dialog.getByText(/follows from the teams they are in/i)).toBeVisible();

  // Everyone: shown, and plainly not a choice.
  await expect(dialog.getByText('Everyone', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/everybody in this workspace is in it/i)).toBeVisible();

  // THE ordering assertion. Teams must come before the apps, because that is
  // the model: the way in, then the exception.
  const body = (await dialog.textContent()) ?? '';
  expect(body.indexOf('Teams')).toBeGreaterThanOrEqual(0);
  expect(body.indexOf('Teams')).toBeLessThan(body.indexOf('Apps'));

  // And the apps section says what it is for.
  await expect(dialog.getByText(/only for exceptions/i)).toBeVisible();
});

test('an app a team confers says which team', async ({ page }) => {
  await landSignedIn(page, HOSTS.fibre, 'fibre-platform', '/settings/members', /\/settings\/members/);
  await waitForHydration(page);
  await page.getByText('e2e-fixture@example.com').first().click();
  const dialog = page.getByRole('dialog');
  await waitForHydration(page, '[role="dialog"]');

  // The fixture workspace's Everyone team grants its apps (the 2026-10-08
  // conversion), so at least one app must carry the note. If this fails with
  // none found, the API stopped returning apps_via — which is the bug this
  // line exists to catch, not a flaky selector.
  await expect(dialog.getByText(/via Everyone/i).first()).toBeVisible();
});
