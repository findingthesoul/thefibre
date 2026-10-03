import { describe, expect, it } from 'vitest';
import { ProfilePatch } from './profile.js';

// The two halves of saving a profile are a form and a schema, and each is
// correct about itself while the feature is broken between them. On
// 2026-10-03 Sjoerd hit `API 400` saving a bio on production, during a demo:
// the schema said 2000 characters, the form had no idea there was a limit,
// and the screen showed a number.
//
// So this asserts the payload the shared ProfileForm actually produces — it
// sends every field on every save, with `|| null` for the empty ones — rather
// than the fields a test author would think to try.

const asFormSends = (over: Record<string, unknown> = {}) => ({
  display_name: 'Sjoerd',
  bio: 'A paragraph about me.',
  photo_url: null,
  timezone: 'Europe/Amsterdam',
  ...over,
});

describe('the profile save accepts what the form sends', () => {
  it('takes a full payload', () => {
    expect(ProfilePatch.safeParse(asFormSends()).success).toBe(true);
  });

  it('takes null for every field the form empties', () => {
    // `v.display_name || null`, `v.bio || null`, `v.timezone || null` — the
    // wrappers all do this. `timezone` refused null until 2026-10-03, which
    // made an empty picker a 400 with no explanation.
    for (const field of ['display_name', 'bio', 'photo_url', 'timezone']) {
      const r = ProfilePatch.safeParse(asFormSends({ [field]: null }));
      expect(r.success, `${field} must accept null`).toBe(true);
    }
  });

  it('takes a real written bio — the kind people paste in', () => {
    // ~2,400 characters: longer than the old 2000 limit, which is what
    // rejected the save that started this.
    const bio = 'Zeriekzee, Netherlands. Co-founder. '.repeat(67);
    expect(bio.length).toBeGreaterThan(2000);
    expect(ProfilePatch.safeParse(asFormSends({ bio })).success).toBe(true);
  });

  it('takes that bio again once it is HTML, which costs characters', () => {
    // The point of the raised limit: the same words wrapped in markup are
    // longer, so a bio that saves today must still save after the editor
    // flips. Paragraphs, a bold phrase and a three-item list on top.
    const words = 'Zeriekzee, Netherlands. Co-founder. '.repeat(67);
    const html =
      `<p>${words}</p><p><strong>About me</strong></p>` +
      `<ul><li>Systems thinking</li><li>Community building</li><li>Strategy</li></ul>`;
    expect(html.length).toBeGreaterThan(words.length);
    expect(ProfilePatch.safeParse(asFormSends({ bio: html })).success).toBe(true);
  });
});

describe('when it does refuse, it says why in words', () => {
  it('names the limit instead of leaving a status code to explain itself', () => {
    const r = ProfilePatch.safeParse(asFormSends({ bio: 'x'.repeat(8001) }));
    expect(r.success).toBe(false);
    const message = r.success ? '' : r.error.flatten().fieldErrors.bio?.[0];
    // What the person reads. Not "Invalid input", not "String must contain…".
    expect(message).toBe('A bio can be at most 8000 characters.');
  });

  it('puts the reason under the FIELD, which is what the form renders', () => {
    const r = ProfilePatch.safeParse(asFormSends({ display_name: 'n'.repeat(201) }));
    expect(r.success).toBe(false);
    const flat = r.success ? null : r.error.flatten();
    expect(flat?.fieldErrors.display_name?.[0]).toBe(
      'A display name can be at most 200 characters.',
    );
  });
});
