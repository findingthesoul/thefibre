// A session's calendar icon in a thread's dialog (my.thread → Next):
// Google / Outlook.com / .ics, remembered on this device after the first
// pick (2026-10-17). The fixture member with a dated session on staging
// (rehearsal-20260907@example.com). The remembered choice lives in this
// browser's localStorage only. For "Add all to calendar" the run adds a
// second dated session to that member's thread and deletes it afterwards.

import { expect, test } from '@playwright/test';
import { HOSTS, authUserByEmail, signedInLandUrlFor, stagingService } from './helpers.js';

const EMAIL = 'rehearsal-20260907@example.com';
const SHOTS = process.env.SHOTS_DIR;
let seeded: string | null = null;

test.beforeAll(async () => {
  const s = stagingService();
  const { data: persons } = await s.from('person').select('id').eq('email', EMAIL);
  const { data: enrol } = await s
    .from('thread_enrolment')
    .select('thread_id, thread:thread_id (workspace_id)')
    .in('person_id', (persons ?? []).map((p) => p.id))
    .limit(1)
    .single();
  if (!enrol) throw new Error(`${EMAIL} has no thread on staging`);
  const ws = (Array.isArray(enrol.thread) ? enrol.thread[0] : enrol.thread) as { workspace_id: string };
  const { data, error } = await s
    .from('thread_engagement')
    .insert({
      workspace_id: ws.workspace_id,
      thread_id: enrol.thread_id,
      type: 'event',
      title: 'e2e: Conversation 2',
      status: 'published',
      starts_at: '2027-01-12T15:00:00Z',
      ends_at: '2027-01-12T16:00:00Z',
      position: 998,
    })
    .select('id')
    .single();
  if (error) throw new Error(`seed session: ${error.message}`);
  seeded = data.id as string;
});

test.afterAll(async () => {
  if (seeded) await stagingService().from('thread_engagement').delete().eq('id', seeded);
});

async function openDialog(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext) {
  await context.addCookies([{ name: 'thefibre.locale', value: 'en', url: HOSTS.my }]);
  const user = await authUserByEmail(EMAIL);
  await page.goto(await signedInLandUrlFor(HOSTS.thread, 'the-thread', user, '/'));
  await page.waitForLoadState('networkidle');
  await page.goto(`${HOSTS.my}/`);
  await page.evaluate(() => localStorage.removeItem('my.calendar.choice'));
  await page.reload();
  const cards = page.locator('ul li button.min-w-0');
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  const dlg = page.getByRole('dialog');
  const trigger = dlg.getByRole('button', { name: 'Add to calendar' }).first();
  const n = await cards.count();
  for (let i = 0; i < n; i++) {
    await cards.nth(i).click();
    await dlg.waitFor({ timeout: 10_000 });
    if (await trigger.count()) break;
    await page.keyboard.press('Escape');
  }
  await expect(trigger, 'a thread with a dated session').toBeVisible();
  return { dlg, trigger };
}

test('"Add all to calendar" offers subscribing, or a file of every session', async ({ page, context }) => {
  test.slow();
  await page.setViewportSize({ width: 430, height: 900 });
  const { dlg } = await openDialog(page, context);
  await dlg.getByRole('button', { name: 'Add all to calendar' }).click();
  await expect(page.getByRole('menuitem', { name: 'Subscribe: Google, Outlook or Apple' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Download all sessions (.ics)' })).toBeVisible();
  await expect(page.getByRole('menu')).toContainText('Subscribing follows every session');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/calmenu-all-en.png` });
  await page.getByRole('menuitem', { name: 'Subscribe: Google, Outlook or Apple' }).click();
  await page.waitForURL(/\/you\?tab=notifications/);
});

test('first click shows the menu; Google is remembered; "Other calendar…" brings the menu back', async ({ page, context }) => {
  test.slow();
  const { dlg, trigger } = await openDialog(page, context);

  // First time: the menu, with the honest line about copies.
  await trigger.click();
  await expect(page.getByRole('menuitem', { name: 'Google Calendar' })).toBeVisible();
  await expect(page.getByRole('menu')).toContainText('A copy');

  // Pick Google: Google's own sign-in entry, carrying the event.
  const [pop] = await Promise.all([page.waitForEvent('popup'), page.getByRole('menuitem', { name: 'Google Calendar' }).click()]);
  expect(new URL(pop.url()).host).toBe('accounts.google.com');
  expect(decodeURIComponent(decodeURIComponent(pop.url()))).toContain('action=TEMPLATE');
  await pop.close();

  // Next click: straight to Google, no menu.
  const direct = dlg.getByRole('button', { name: 'Add to Google Calendar' }).first();
  const [pop2] = await Promise.all([page.waitForEvent('popup'), direct.click()]);
  expect(new URL(pop2.url()).host).toBe('accounts.google.com');
  await pop2.close();
  await expect(page.getByRole('menu')).toHaveCount(0);

  // "Other calendar…" is the way back to the menu.
  await dlg.getByRole('button', { name: 'Other calendar…' }).first().click();
  await expect(page.getByRole('menuitem', { name: 'Outlook.com' })).toBeVisible();
});
