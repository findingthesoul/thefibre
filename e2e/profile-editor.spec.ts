import { test, expect } from '@playwright/test';
import { HOSTS, landSignedIn } from './helpers.js';

// The editor rendered EMPTY on this screen while its value sat intact in
// state — toolbar there, counter reading 3,567 / 8,000, box blank. Typing one
// character into it would then have replaced a 3,500-character bio with that
// character, because the first keystroke makes the editor report its own
// contents.
//
// READ ONLY, deliberately: it opens the page and looks. Until staging has a
// dedicated e2e account, signing in here signs in as a real person
// (helpers.ts takes the oldest confirmed account, which is Sjoerd's), so a
// spec that TYPES is not something to run against it.

test('the bio editor opens with the stored bio in it', async ({ page }) => {
  await landSignedIn(page, HOSTS.fibre, 'fibre-platform', '/settings/profile', /\/settings\/profile/);

  const editor = page.getByRole('textbox', { name: /bio/i });
  await expect(editor).toBeVisible();

  const state = await editor.evaluate((el) => {
    const hidden = document.querySelector('input[name="bio"]') as HTMLInputElement | null;
    return {
      shown: (el as HTMLElement).innerText.trim().length,
      held: hidden?.value.length ?? 0,
      paragraphs: el.querySelectorAll('p').length,
      rawTags: (el as HTMLElement).innerText.includes('<p>'),
    };
  });

  // The two halves must agree. The bug was precisely that they did not: the
  // hidden input held everything and the editor showed nothing.
  if (state.held > 0) {
    expect(state.shown, 'the editor shows nothing while the form holds a bio').toBeGreaterThan(0);
    expect(state.paragraphs).toBeGreaterThan(0);
  }
  // And it is an editor, not a view of the markup.
  expect(state.rawTags).toBe(false);
});
