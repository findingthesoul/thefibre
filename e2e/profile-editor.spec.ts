import { test, expect } from '@playwright/test';
import { HOSTS, landSignedIn, waitForHydration } from './helpers.js';

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
//
// And it only looks AFTER hydration — landSignedIn now waits for it. Reading
// this page before React attaches shows an empty editor every time, which is
// the false alarm that produced v1.100.2.

test('the bio editor opens with the stored bio in it', async ({ page }) => {
  await landSignedIn(page, HOSTS.fibre, 'fibre-platform', '/settings/profile', /\/settings\/profile/);

  // THE RICH EDITOR, named exactly.
  //
  // `{ name: /bio/i }` used to be enough and stopped being so when a "Short
  // bio" textarea joined the profile form: the regex then matched BOTH it and
  // the contenteditable, and Playwright's strict mode failed with "resolved to
  // 2 elements" — which reads like the editor being broken and is nothing of
  // the kind. Found 2026-10-11 by running the whole fixture suite; two specs
  // had been red since the short-bio field landed.
  //
  // An exact name is also the honest selector: these specs are about the rich
  // editor specifically, and a loose match that happens to find it today is one
  // field away from finding something else.
  const editor = page.getByRole('textbox', { name: 'Bio', exact: true });
  await expect(editor).toBeVisible();
  // The editor's OWN tree, not just something on the page: the chrome
  // hydrates well before this form does, and reading in between is exactly
  // the mistake this spec exists to prevent.
  await waitForHydration(page, '[contenteditable]');

  const state = await editor.evaluate((el) => {
    const hidden = document.querySelector('input[name="bio"]') as HTMLInputElement | null;
    return {
      shown: (el as HTMLElement).innerText.trim().length,
      held: hidden?.value.length ?? 0,
      paragraphs: el.querySelectorAll('p').length,
      rawTags: (el as HTMLElement).innerText.includes('<p>'),
    };
  });

  // The two halves must agree: whatever the form is holding, the person must
  // be able to see and edit. They are not identical — the held value carries
  // the tags — so this compares presence and structure, not length.
  if (state.held > 0) {
    expect(state.shown, 'the editor shows nothing while the form holds a bio').toBeGreaterThan(0);
    expect(state.paragraphs, 'markup arrived as paragraphs').toBeGreaterThan(0);
  }
  // And it is an editor, not a view of the markup.
  expect(state.rawTags).toBe(false);
});
