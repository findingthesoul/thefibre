// my.thread → You as TABS (Sjoerd, 2026-10-16: the page "has become highly
// complicated"). Each tab is a deep link that opens THAT tab — selected in the
// bar, its panel's content on the page — and an unknown tab falls back to
// Profile, never a blank page. As the E2E FIXTURE, read-only.

import { expect, test } from '@playwright/test';
import { HOSTS, landSignedIn } from './helpers.js';

const CASES: [string, string, RegExp][] = [
  ['', 'Profile', /Name|Being found by other members|Editing is not reachable/],
  ['notifications', 'Notifications', /calendar/i],
  ['privacy', 'Privacy', /Sign out/],
  ['nonsense', 'Profile', /Name|Being found by other members|Editing is not reachable/],
];

// Memberships and Billing left the You page on 2026-10-16 (they repeated the
// sidebar's pages). Their old links must land on those pages, not on Profile.
const MOVED: [string, RegExp][] = [
  ['memberships', /\/memberships$/],
  ['billing', /\/purchases$/],
];

test('each You tab is a deep link to that tab', async ({ page }) => {
  test.setTimeout(120_000);
  await landSignedIn(page, HOSTS.thread, 'the-thread', '/dashboard', /\/dashboard/);
  for (const [tab, label, content] of CASES) {
    await page.goto(`${HOSTS.my}/you${tab ? `?tab=${tab}` : ''}`);
    const selected = page.getByRole('tab', { selected: true });
    await expect(selected, `?tab=${tab}`).toHaveText(label, { timeout: 30_000 });
    await expect(page.getByText(content).first(), `?tab=${tab} shows its panel`).toBeVisible();
  }
});

test('the removed tabs redirect to the pages they repeated', async ({ page }) => {
  test.setTimeout(120_000);
  await landSignedIn(page, HOSTS.thread, 'the-thread', '/dashboard', /\/dashboard/);
  for (const [tab, lands] of MOVED) {
    await page.goto(`${HOSTS.my}/you?tab=${tab}`);
    await expect(page, `?tab=${tab}`).toHaveURL(lands, { timeout: 30_000 });
  }
  await page.goto(`${HOSTS.my}/you`);
  await expect(page.getByRole('tab')).toHaveText(['Profile', 'Notifications', 'Privacy'], { timeout: 30_000 });
});
