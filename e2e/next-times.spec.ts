// Next lists a session at the THREAD's clock time (2026-10-17, production:
// a 17:00 Amsterdam session listed at 16:00 — the list was formatted on a
// server running in UTC). The fixture member's "Year agenda" thread
// (rehearsal-20260907@example.com) has "Conversation 1" at
// 2027-01-05T15:00Z = 16:00 in Europe/Amsterdam; the list and the dialog must
// both say 16:00. The browser is pinned to Amsterdam so no zone label is added.

import { expect, test } from '@playwright/test';
import { HOSTS, authUserByEmail, signedInLandUrlFor } from './helpers.js';

test.use({ timezoneId: 'Europe/Amsterdam', locale: 'en-GB' });

test('the list and the dialog agree on the thread’s clock time', async ({ page, context }) => {
  test.slow();
  await context.addCookies([{ name: 'thefibre.locale', value: 'en', url: HOSTS.my }]);
  const user = await authUserByEmail('rehearsal-20260907@example.com');
  await page.goto(await signedInLandUrlFor(HOSTS.thread, 'the-thread', user, '/'));
  await page.waitForLoadState('networkidle');
  await page.goto(`${HOSTS.my}/`);

  const card = page.locator('li').filter({ hasText: 'Conversation 1' }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText('16:00');
  await expect(card).not.toContainText('15:00');

  await card.getByRole('button').first().click();
  const row = page.getByRole('dialog').locator('li').filter({ hasText: 'Conversation 1' }).first();
  await expect(row).toContainText('16:00');
});

test.describe('a viewer in another zone', () => {
  test.use({ timezoneId: 'America/New_York' });

  test('still sees the thread’s time, and which zone it is in', async ({ page, context }) => {
    test.slow();
    await context.addCookies([{ name: 'thefibre.locale', value: 'en', url: HOSTS.my }]);
    const user = await authUserByEmail('rehearsal-20260907@example.com');
    await page.goto(await signedInLandUrlFor(HOSTS.thread, 'the-thread', user, '/'));
    await page.waitForLoadState('networkidle');
    await page.goto(`${HOSTS.my}/`);
    const card = page.locator('li').filter({ hasText: 'Conversation 1' }).first();
    await expect(card).toContainText(/16:00 (CET|GMT\+1)/, { timeout: 30_000 });
  });
});
