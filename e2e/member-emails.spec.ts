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

// The SIGNATURE (2ix): write a sign-off, preview it on a renewal reminder,
// save, read it from the DATABASE, reload, reset. Its own row (kind
// signature, EN), removed by workspace + kind + locale before and after.
const SIGN = `E2E sign-off ${Date.now().toString(36)}`;
const sigRows = () => stagingService().from('membership_email_template').select('id, intro_html, subject').eq('workspace_id', workspaceId).eq('kind', 'signature').eq('locale', 'en');

test('signature: write, preview on a renewal reminder, save, reload, reset', async ({ page }) => {
  test.setTimeout(120_000);
  await stagingService().from('membership_email_template').delete().eq('workspace_id', workspaceId).eq('kind', 'signature').eq('locale', 'en');
  try {
    await landSignedIn(page, HOSTS.membership, 'membership', '/settings/emails', /\/settings\/emails|no-access/);
    await waitForHydration(page, 'button, input, select');
    await page.locator('select').first().selectOption('signature');
    await page.getByRole('button', { name: /^English/ }).click();
    // A signature has no subject or image of its own.
    await expect(page.getByLabel('Subject')).toHaveCount(0);
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await page.keyboard.type(SIGN);

    await page.getByRole('button', { name: 'Preview' }).click();
    const frame = page.frameLocator('iframe[title="Preview"]');
    await expect(frame.getByText(SIGN)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Save' }).click();
    await expect.poll(async () => (await sigRows()).data?.[0]?.intro_html ?? '', { timeout: 20_000 }).toContain(SIGN);
    expect((await sigRows()).data?.[0]?.subject ?? null).toBeNull();

    await page.reload();
    await waitForHydration(page, 'button, input, select');
    await page.locator('select').first().selectOption('signature');
    await page.getByRole('button', { name: /^English/ }).click();
    await expect(page.locator('[contenteditable="true"]').first()).toContainText(SIGN);

    await page.getByRole('button', { name: 'Reset to the standard text' }).click();
    await expect.poll(async () => ((await sigRows()).data ?? []).length, { timeout: 20_000 }).toBe(0);
  } finally {
    await stagingService().from('membership_email_template').delete().eq('workspace_id', workspaceId).eq('kind', 'signature').eq('locale', 'en');
    expect((await sigRows()).data ?? []).toHaveLength(0);
  }
});
