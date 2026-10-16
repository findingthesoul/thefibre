// Members → Settings → Google addresses (builder 4's routes, 2026-10-16), on
// STAGING as the FIXTURE admin. One seeded request from a fixture member is
// shown under Waiting, declined through the page with a reason, read back
// from the DATABASE, then found under Declined. The hub links to the page.
// The seeded row is removed by id before and after; nothing else is touched.
// "Mark created" is not exercised: the fixture workspace has no Google
// connected, so the page must say so and keep that button disabled — which
// is asserted instead.

import { expect, test } from '@playwright/test';
import { HOSTS, fixtureIdentity, landSignedIn, stagingService, waitForHydration } from './helpers.js';

const TAG = Date.now().toString(36);
const ADDRESS = `e2e.${TAG}@example.org`;
const REASON = `E2E reason ${TAG}`;
let rowId = '';

test.beforeAll(async () => {
  const db = stagingService();
  const { workspaceId } = await fixtureIdentity();
  // A fixture member that has no Google row yet (one row per member).
  const { data: members } = await db.from('membership_member').select('id, person_id').eq('workspace_id', workspaceId).is('deleted_at', null).limit(50);
  const { data: taken } = await db.from('membership_google_account').select('member_id').eq('workspace_id', workspaceId);
  const used = new Set((taken ?? []).map((r) => r.member_id as string));
  const m = (members ?? []).find((x) => !used.has(x.id as string));
  if (!m) throw new Error('e2e: no fixture member without a Google row to seed');
  const { data, error } = await db
    .from('membership_google_account')
    .insert({ workspace_id: workspaceId, member_id: m.id, person_id: m.person_id, status: 'requested', requested_address: ADDRESS, suggested_address: ADDRESS, note: `E2E note ${TAG}`, requested_at: new Date().toISOString() })
    .select('id')
    .single();
  if (error) throw new Error(`e2e: seed: ${error.message}`);
  rowId = data!.id as string;
});

test.afterAll(async () => {
  if (!rowId) return;
  await stagingService().from('membership_google_account').delete().eq('id', rowId);
  const { data } = await stagingService().from('membership_google_account').select('id').eq('id', rowId);
  expect(data ?? []).toHaveLength(0);
});

test('a requested address is listed, declined with a reason, and moves to Declined', async ({ page }) => {
  test.setTimeout(120_000);
  await landSignedIn(page, HOSTS.membership, 'membership', '/settings', /\/settings|no-access/);
  await expect(page.getByRole('link', { name: /Google addresses/ })).toBeVisible({ timeout: 30_000 });

  await page.goto(`${HOSTS.membership}/settings/google-accounts`);
  await waitForHydration(page, 'button, a');
  await expect(page.getByRole('tab', { selected: true })).toHaveText('Waiting', { timeout: 30_000 });
  // No Google connected on the fixture: said, and Mark created is off.
  await expect(page.getByText(/Google Workspace is not connected yet/)).toBeVisible();
  const row = page.getByRole('listitem').filter({ hasText: ADDRESS });
  await expect(row).toBeVisible();
  await expect(row.getByText(`E2E note ${TAG}`)).toBeVisible();
  await expect(row.getByRole('button', { name: 'Mark created' })).toBeDisabled();

  await row.getByRole('button', { name: 'Decline' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Reason (optional)').fill(REASON);
  await dialog.getByRole('button', { name: 'Decline' }).click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });

  await expect
    .poll(async () => (await stagingService().from('membership_google_account').select('status, decline_reason').eq('id', rowId).single()).data, { timeout: 20_000 })
    .toEqual({ status: 'declined', decline_reason: REASON });
  await expect(page.getByRole('listitem').filter({ hasText: ADDRESS })).toHaveCount(0);

  await page.goto(`${HOSTS.membership}/settings/google-accounts?status=declined`);
  await expect(page.getByRole('tab', { selected: true })).toHaveText('Declined', { timeout: 30_000 });
  const declined = page.getByRole('listitem').filter({ hasText: ADDRESS });
  await expect(declined).toBeVisible();
  await expect(declined.getByText(REASON)).toBeVisible();
});
