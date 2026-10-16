// my.thread → You as TABS (Sjoerd, 2026-10-16: the page "has become highly
// complicated"). Each tab is a deep link that opens THAT tab — selected in the
// bar, its panel's content on the page — and an unknown tab falls back to
// Profile, never a blank page. As the E2E FIXTURE, read-only.

import { expect, test } from '@playwright/test';
import { HOSTS, landSignedIn } from './helpers.js';

const CASES: [string, string, RegExp][] = [
  ['', 'Profile', /Name|Being found by other members|Editing is not reachable/],
  ['memberships', 'Memberships & purchases', /under\s+Purchases/],
  ['billing', 'Billing', /billing details|Billing details/i],
  ['notifications', 'Notifications', /calendar/i],
  ['privacy', 'Privacy', /Sign out/],
  ['nonsense', 'Profile', /Name|Being found by other members|Editing is not reachable/],
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
