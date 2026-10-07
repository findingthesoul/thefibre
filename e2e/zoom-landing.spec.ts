import { test, expect } from '@playwright/test';
import { HOSTS } from './helpers.js';

// The URL on our Zoom Marketplace listing.
//
// Zoom's review (2026-10-08) requires that it take somebody STRAIGHT to
// connecting Zoom: signed in, the Connect button; signed OUT, through sign-in
// and BACK to the same page. The second half is the one that fails silently —
// every other page in this app bounces an unsigned visit to the landing page,
// where a reviewer is simply stranded with no way back, and the listing is
// rejected for that alone.
//
// No session needed, which is the point: this is exactly what the reviewer
// does, from exactly their starting position.

const LANDING = `${HOSTS.fibre}/integrations/zoom`;

test('signed out, the Zoom landing URL goes to sign-in and keeps the way back', async ({ page }) => {
  const res = await page.goto(LANDING, { waitUntil: 'domcontentloaded' });

  // FIRST, and not a formality: a 404 here is the whole failure. This spec
  // was briefly written as two tests, and the second one — "does not strand a
  // visitor on the marketing page" — PASSED against a 404, because a missing
  // page's path is not `/` either. One test, status checked before anything
  // else, so there is no way to be green while the route does not exist.
  expect(res?.status(), `the landing URL must exist; got ${res?.status()}`).toBeLessThan(400);

  // Landed on sign-in…
  expect(page.url()).toContain('/sign-in');
  // …carrying the destination, so the far side can return. Without this the
  // reviewer signs in and lands on a dashboard, having never seen Zoom.
  expect(decodeURIComponent(page.url())).toContain('next=/integrations/zoom');
  // and it really is the sign-in screen, not a redirect that happens to match
  // the string.
  await expect(page.getByText(/sign in/i).first()).toBeVisible();
  // Which also settles the other half: landing here is not being dumped on
  // the marketing page, which is what every other (app) path does signed out.
  expect(new URL(page.url()).pathname).not.toBe('/');
});
