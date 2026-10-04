import { test, expect } from '@playwright/test';
import { HOSTS, landSignedIn, stagingService, waitForHydration } from './helpers.js';
import { E2E_FIXTURE } from './identities.js';

// Somebody actually SAVES through the rich-text bio editor.
//
// The editor shipped on 2026-10-04 (v1.100.1 → v1.100.4) and until this spec
// nobody had pressed Save in it on a deployed stack: every check either
// looked without typing, or typed without a real person's account to spare.
// The pack now signs in as the fixture account (e2e/identities.ts), which is
// nobody, so this one writes:
//
//   type a paragraph, a heading and another paragraph → Save → reload →
//   the text and the heading are back in the editor, the form holds markup
//   with an <h3> in it, the database row holds the same, and the character
//   counter reads the same number as before the save.
//
// It puts the fixture's bio back as it found it, by the row, when it is done.

const counter = /(\d[\d,]*) \/ 8,000/;

// The finding this spec was written for, kept because the history is the
// point. The first time it ran (2026-10-04,
// staging at v1.101.1) the save worked and the reload did not: the editor
// came back showing `<h3>A heading</h3><div>…</div>` as TEXT. An editor that
// starts empty gives its first line as a bare text node, so the stored value
// opens with text; packages/shared/src/bio-html.ts (HTML_OPENERS /
// looksLikeStoredHtml) only counts a value as markup when it OPENS with a
// block tag, so the whole bio is judged plain and escaped — for every person
// writing a first bio, and anyone who clears theirs. Pressing Save again
// would then store the escaped tags for good.
//
// Fixed in v1.101.3: the shape is normalised where it is produced and again
// where it is stored (packages/shared/src/rich-text-normalise.ts), so a value
// always opens with a block and reads back as markup. The reader's detector
// was deliberately NOT made cleverer. This spec is the regression test.
test('a bio typed with a heading is saved, and comes back as it was written', async ({ page }) => {
  test.slow();
  const service = stagingService();
  const stamp = Date.now().toString(36);
  const first = `Fixture bio, first paragraph ${stamp}.`;
  const heading = `A heading ${stamp}`;
  const last = `And a closing line ${stamp}.`;

  const { data: before, error: readErr } = await service
    .from('identity_profile')
    .select('bio')
    .eq('email', E2E_FIXTURE.email)
    .single();
  expect(readErr, 'the fixture has a profile row').toBeNull();

  try {
    await landSignedIn(page, HOSTS.fibre, 'fibre-platform', '/settings/profile', /\/settings\/profile/);
    const editor = page.getByRole('textbox', { name: /bio/i });
    await expect(editor).toBeVisible();
    await waitForHydration(page, '[contenteditable]');

    // Empty the editor the way a person would, then write.
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(first);
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /^(heading|kop)/i }).click();
    await page.keyboard.type(heading);
    await page.keyboard.press('Enter');
    // Enter after a heading may keep the block a heading; press the button
    // again only if it did, so the last line is body text either way.
    const stillHeading = await page.evaluate(() => document.queryCommandValue('formatBlock').toLowerCase().includes('h3'));
    if (stillHeading) await page.getByRole('button', { name: /^(heading|kop)/i }).click();
    await page.keyboard.type(last);

    // What the form is about to send, and what the counter says about it.
    const held = await page.locator('input[name="bio"]').inputValue();
    expect(held, 'the form holds markup, with the heading as an h3').toMatch(/<h3[^>]*>[^<]*A heading/);
    await expect(page.getByText(counter).first()).toBeVisible();
    const countBefore = (await page.getByText(counter).first().innerText()).match(counter)![1];

    await page.getByRole('button', { name: /^(save|opslaan)/i }).click();
    await expect(page.getByText(/saved|opgeslagen/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/API \d{3}/)).toHaveCount(0);

    // The row, not the screen: this is what "saved" has to mean.
    const { data: stored, error: storedErr } = await service
      .from('identity_profile')
      .select('bio')
      .eq('email', E2E_FIXTURE.email)
      .single();
    expect(storedErr).toBeNull();
    expect(stored!.bio).toContain(first);
    expect(stored!.bio).toMatch(/<h3[^>]*>[^<]*A heading/);
    expect(stored!.bio).toContain(last);
    expect(stored!.bio, 'no script, no style survived the save').not.toMatch(/<script|style=/i);

    // And it comes back: a fresh load, after hydration, shows what was written.
    await page.reload();
    const again = page.getByRole('textbox', { name: /bio/i });
    await expect(again).toBeVisible();
    await waitForHydration(page, '[contenteditable]');
    await expect(again).toContainText(first);
    await expect(again.locator('h3')).toHaveText(heading);
    await expect(again).toContainText(last);
    expect(await again.evaluate((el) => (el as HTMLElement).innerText.includes('<h3>'))).toBe(false);
    const countAfter = (await page.getByText(counter).first().innerText()).match(counter)![1];
    expect(countAfter, 'the counter agrees with itself across a save and a reload').toBe(countBefore);
  } finally {
    const { error } = await service
      .from('identity_profile')
      .update({ bio: before?.bio ?? null })
      .eq('email', E2E_FIXTURE.email);
    if (error) console.warn(`e2e: could not put the fixture's bio back: ${error.message}`);
  }
});
