// Members → Settings → Emails (Sjoerd 2ix), on STAGING as the FIXTURE admin:
// write a welcome subject and intro, preview it (the real template, rendered
// by the API), save, reload — asked of the DATABASE and seen again — then
// reset to the standard text. Removes what it made, by workspace + kind.

import { expect, test } from '@playwright/test';
import { HOSTS, fixtureIdentity, landSignedIn, stagingService, waitForHydration } from './helpers.js';

const SUBJECT = `E2E welcome ${Date.now().toString(36)} {first_name}`;
let workspaceId = '';

const rows = () =>
  stagingService().from('membership_email_template').select('id, subject, locale, tier_id').eq('workspace_id', workspaceId).eq('kind', 'welcome').is('tier_id', null).eq('locale', 'en');

test.beforeAll(async () => {
  workspaceId = (await fixtureIdentity()).workspaceId;
  await stagingService().from('membership_email_template').delete().eq('workspace_id', workspaceId).eq('kind', 'welcome').is('tier_id', null).eq('locale', 'en');
});
test.afterAll(async () => {
  await stagingService().from('membership_email_template').delete().eq('workspace_id', workspaceId).eq('kind', 'welcome').is('tier_id', null).eq('locale', 'en');
  expect((await rows()).data ?? []).toHaveLength(0);
});

test('write, preview, save, reload, reset', async ({ page }) => {
  test.setTimeout(120_000);
  await landSignedIn(page, HOSTS.membership, 'membership', '/settings/emails', /\/settings\/emails|no-access/);
  await waitForHydration(page, 'button, input, select');
  await page.getByRole('button', { name: /^English/ }).click();
  await page.getByLabel('Subject').fill(SUBJECT);

  await page.getByRole('button', { name: 'Preview' }).click();
  // Tokens filled with the sample member, in the real template.
  await expect(page.getByText(SUBJECT.replace('{first_name}', 'Marja'))).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Save' }).click();
  await expect.poll(async () => (await rows()).data?.[0]?.subject ?? null, { timeout: 20_000 }).toBe(SUBJECT);

  await page.reload();
  await waitForHydration(page, 'button, input, select');
  await page.getByRole('button', { name: /^English/ }).click();
  await expect(page.getByLabel('Subject')).toHaveValue(SUBJECT);

  await page.getByRole('button', { name: 'Reset to the standard text' }).click();
  await expect.poll(async () => ((await rows()).data ?? []).length, { timeout: 20_000 }).toBe(0);
});
