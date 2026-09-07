// The golden paths (testing approach §3.5) — the handful of flows that
// must simply work, exercised in a real browser against staging.

import { expect, test } from '@playwright/test';
import { HOSTS, signedInLandUrl } from './helpers.js';

test.describe('public surfaces', () => {
  test('the Fibre landing renders with a way in', async ({ page }) => {
    await page.goto(HOSTS.fibre);
    await expect(page).toHaveTitle(/The Fibre/);
    await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible();
  });

  test('the public pricing page lists the plans, Free first', async ({ page }) => {
    await page.goto(`${HOSTS.fibre}/pricing`);
    await expect(page.getByText('Free', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/starter/i).first()).toBeVisible();
    await expect(page.getByText(/pro/i).first()).toBeVisible();
  });

  test('the sign-in page offers Google and the email code', async ({ page }) => {
    await page.goto(`${HOSTS.fibre}/sign-in`);
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
    await expect(page.getByText(/email/i).first()).toBeVisible();
  });

  test('the Thread embed loader serves parseable JavaScript', async ({ request }) => {
    const r = await request.get(`${HOSTS.thread}/embed.js`);
    expect(r.ok()).toBe(true);
    const js = await r.text();
    expect(js).toContain('thread-embed');
    expect(() => new Function(js)).not.toThrow();
  });
});

test.describe('signed-in golden path (session via the SSO landing route)', () => {
  test('a minted handoff code signs the browser into Meet and shows the dashboard', async ({
    page,
  }) => {
    const url = await signedInLandUrl(HOSTS.meet, 'fibre-meet', '/dashboard');
    await page.goto(url);
    // Land → redeem → verifyOtp → /auth/callback → dashboard.
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await expect(page.getByText(/welcome/i).first()).toBeVisible();
    // The shell is up: app switcher present with the current app's name.
    await expect(page.getByRole('button', { name: 'Meet' })).toBeVisible();
  });

  test('an expired/bogus code degrades to the sign-in page — no error surface', async ({
    page,
  }) => {
    await page.goto(`${HOSTS.meet}/sso/land?code=e2e-bogus-code&next=/dashboard`);
    await page.waitForURL(/\/\?next=/, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });
});
