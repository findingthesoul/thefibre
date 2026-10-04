import { test, expect } from '@playwright/test';
import { HOSTS, landSignedIn } from './helpers.js';

// Sjoerd saved a bio on production and got `API 400`. Nothing was broken: the
// bio was over a limit that lived only in a server-side schema, so the form
// let him type past it, discovered it after the press, and showed him a
// number. The only remedy within his reach was to shorten his own writing —
// 2026-10-03, his words: that "creates a bad legacy".
//
// The fix is that the form reads the same limit the API enforces. Whether a
// person SEES that is a question about a rendered page, and the session that
// wrote it had no staging credentials to sign in with, so it is written here
// rather than claimed. Run with the rest: `pnpm test:e2e`.

test.describe('the profile form shows its own limits', () => {
  test('refuses an over-limit bio in words, before the save', async ({ page }) => {
    await landSignedIn(page, HOSTS.fibre, 'fibre-platform', '/settings/profile', /\/settings\/profile/);

    // A contenteditable, not a textarea — Playwright's fill() handles both,
    // but only if the element can be found, hence the aria-label on it.
    const bio = page.getByRole('textbox', { name: /bio/i });
    await expect(bio).toBeVisible();
    const original = await bio.inputValue();

    // Visible from the start, not only once you are nearly over: Sjoerd asked
    // for the count outright after the limit caught him silently.
    await expect(page.getByText(new RegExp(`\\d[\\d,]* / 8,000`))).toBeVisible();

    try {
      // One character past the shared limit (FIELD_LIMITS.bio = 8000).
      await bio.fill('x'.repeat(8001));

      // The count is on screen while typing, BEFORE anything is submitted —
      // the thing whose absence made 2,400 characters feel fine.
      await expect(page.getByText('8,001 / 8,000')).toBeVisible();

      await page.getByRole('button', { name: /save|opslaan/i }).click();

      // A sentence naming the limit, not a status code — and ONCE. It was
      // on screen three times before this spec was first run: the client
      // guard, the API's answer and the banner all saying the same thing.
      await expect(page.getByText(/at most 8,?000 characters/i)).toHaveCount(1);
      await expect(page.getByText(/API 400/)).toHaveCount(0);
    } finally {
      // Leave the fixture's profile as we found it: this edits a real row.
      await bio.fill(original);
      await page.getByRole('button', { name: /save|opslaan/i }).click();
    }
  });

  test('a bio longer than the OLD limit saves normally', async ({ page }) => {
    // 2,400 characters — what was rejected on production. The regression this
    // guards is somebody "tidying" the limit back down.
    await landSignedIn(page, HOSTS.fibre, 'fibre-platform', '/settings/profile', /\/settings\/profile/);
    // A contenteditable, not a textarea — Playwright's fill() handles both,
    // but only if the element can be found, hence the aria-label on it.
    const bio = page.getByRole('textbox', { name: /bio/i });
    const original = await bio.inputValue();
    try {
      await bio.fill('Zeriekzee, Netherlands. Co-founder. '.repeat(67));
      await page.getByRole('button', { name: /save|opslaan/i }).click();
      await expect(page.getByText(/saved|opgeslagen/i)).toBeVisible();
    } finally {
      await bio.fill(original);
      await page.getByRole('button', { name: /save|opslaan/i }).click();
    }
  });
});
