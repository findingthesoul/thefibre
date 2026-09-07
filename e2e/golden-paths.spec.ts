// The golden paths (testing approach §3.5) — the handful of flows that
// must simply work, exercised in a real browser against staging.

import { expect, test } from '@playwright/test';
import { HOSTS, authUserByEmail, createPublicThread, signedInLandUrl, signedInLandUrlFor } from './helpers.js';

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

test.describe('enrolment golden path (free ticket, permanent fixture workspace)', () => {
  // The Stripe-card variant is deliberately NOT automated: it needs the
  // rehearsal workspace's wired test account, which is Sjoerd's supervised
  // rig (see docs/testing-approach.md). Free path covers page → enrol →
  // /my; the card adds only Stripe's own hosted form on top.
  test('a published thread renders publicly and /my shows a fresh enrolment', async ({
    page,
    request,
  }) => {
    const fixture = await createPublicThread('golden');
    const participantEmail = `e2e-enrolee-${Date.now()}@example.com`;
    try {
      // 1 · The public page renders with the thread's substance.
      await page.goto(`${HOSTS.thread}/${fixture.organiserSlug}/${fixture.threadSlug}`);
      await expect(page.getByText(fixture.title).first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(fixture.intention).first()).toBeVisible();

      // 2 · Enrol through the public API (the browser form posts the same
      // payload; the UI-driven variant can join later without changing this).
      const r = await request.post(
        'https://thefibre-api-staging.fly.dev/api/v1/thread/public/enrol',
        {
          data: {
            organiser_slug: fixture.organiserSlug,
            thread_slug: fixture.threadSlug,
            name: 'E2E Enrolee',
            email: participantEmail,
            request_id: `e2e-${Date.now()}`,
            policy_accepted: true,
          },
        },
      );
      expect(r.status()).toBe(201);
      expect((await r.json()).has_account).toBe(true);

      // 3 · The auto-created participant signs in via a minted handoff and
      // sees the enrolment on /my.
      const participant = await authUserByEmail(participantEmail);
      const url = await signedInLandUrlFor(HOSTS.thread, 'the-thread', participant, '/my');
      await page.goto(url);
      await page.waitForURL(/\/my/, { timeout: 30_000 });
      await expect(page.getByText(fixture.title).first()).toBeVisible({ timeout: 30_000 });
    } finally {
      await fixture.cleanup([participantEmail]);
    }
  });
});
