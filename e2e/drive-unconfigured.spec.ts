// Google Drive folders (2026-10-17) on STAGING, as the FIXTURE, BEFORE a
// service-account key exists there — the state every stack is in until
// Sjoerd sets one. The real wiring answers `drive_not_configured`, and both
// screens must SAY so rather than look broken or empty:
//   · Members → Settings → Member page → "Google Drive folder": the form
//     says Drive isn't set up, and offers no link field;
//   · my.thread → a Drive browser address: a sentence, not an empty folder
//     and not "Application error".
// Read-only. Once a key and a shared test folder exist, the full e2e
// (connect → browse → download) replaces the stubbed render.

import { expect, test } from '@playwright/test';
import { HOSTS, landSignedIn, waitForHydration } from './helpers.js';

test('Members: the connect form says Drive is not set up here', async ({ page }) => {
  test.setTimeout(120_000);
  await landSignedIn(page, HOSTS.membership, 'membership', '/settings/member-page', /\/settings\/member-page|no-access/);
  await waitForHydration(page, 'button');
  await page.getByRole('radio', { name: 'Google Drive folder' }).click();
  await expect(page.getByText('Google Drive isn’t set up for this platform yet.')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('Folder link')).toHaveCount(0);
});

test('my.thread: a Drive browser address answers in words, not with an error page', async ({ page }) => {
  test.setTimeout(120_000);
  await landSignedIn(page, HOSTS.thread, 'the-thread', '/dashboard', /\/dashboard/);
  await page.goto(`${HOSTS.my}/files/drive/00000000-0000-0000-0000-000000000000/no-such-entry`);
  await expect(page.getByText(/Application error/)).toHaveCount(0);
  // Not configured, or (for an entry that does not exist) not available — either is a sentence.
  await expect(page.getByText(/Google Drive isn’t set up here yet\.|This folder isn’t available to you\./)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: 'All files' })).toBeVisible();
});
