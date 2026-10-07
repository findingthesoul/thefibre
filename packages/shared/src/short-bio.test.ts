import { describe, expect, it } from 'vitest';
import { excerptAtWord, fullBioAddsMore, resolveShortBio, SHORT_BIO_FALLBACK_CHARS } from './short-bio.js';
import { FIELD_LIMITS } from './field-limits.js';

const LONG_PLAIN =
  'I facilitate conversations between people who would rather not have them. ' +
  'Twenty years of board rooms, village halls and kitchen tables have taught me ' +
  'that most conflict is a story nobody has finished telling. My work is helping ' +
  'people finish it together, out loud, with somebody listening.';

describe('a short bio the person wrote', () => {
  it('is shown as written, never cut', () => {
    const own = 'x '.repeat(130).trim(); // 259 chars: under the limit, over the fallback
    expect(resolveShortBio({ short_bio: own, bio: LONG_PLAIN })).toBe(own);
  });

  it('wins over the full bio', () => {
    expect(resolveShortBio({ short_bio: 'Facilitator.', bio: LONG_PLAIN })).toBe('Facilitator.');
  });

  it('counts as unwritten when it is only whitespace', () => {
    expect(resolveShortBio({ short_bio: '   \n ', bio: 'Short and sweet.' })).toBe(
      'Short and sweet.',
    );
  });
});

describe('the fallback: the opening of the full bio', () => {
  it('is the whole bio when it already fits', () => {
    expect(resolveShortBio({ short_bio: null, bio: 'I listen for a living.' })).toBe(
      'I listen for a living.',
    );
  });

  it('cuts at a word boundary, with an ellipsis, within the fallback budget', () => {
    const out = resolveShortBio({ short_bio: null, bio: LONG_PLAIN })!;
    expect(out.length).toBeLessThanOrEqual(SHORT_BIO_FALLBACK_CHARS);
    expect(out.endsWith('…')).toBe(true);
    const body = out.slice(0, -1);
    // Every word in the excerpt is a whole word of the original.
    expect(LONG_PLAIN.startsWith(body)).toBe(true);
    expect(LONG_PLAIN[body.length]).toBe(' ');
  });

  it('reads a rich-text bio as text — no tags reach a compact spot', () => {
    const html = '<p>I <strong>facilitate</strong> conversations.</p><ul><li>Boards</li><li>Villages</li></ul>';
    const out = resolveShortBio({ bio: html })!;
    expect(out).not.toMatch(/[<>]/);
    expect(out).toBe('I facilitate conversations. • Boards • Villages');
  });

  it('flattens line breaks, which would spend a compact spot on blank lines', () => {
    expect(resolveShortBio({ bio: 'First line.\n\nSecond line.' })).toBe('First line. Second line.');
  });

  it('leaves a typed angle bracket alone in a plain bio', () => {
    expect(resolveShortBio({ bio: 'I <3 facilitating & listening' })).toBe(
      'I <3 facilitating & listening',
    );
  });

  it('is null when there is neither', () => {
    expect(resolveShortBio({ short_bio: null, bio: null })).toBeNull();
    expect(resolveShortBio({ short_bio: '', bio: '   ' })).toBeNull();
    expect(resolveShortBio({})).toBeNull();
    expect(resolveShortBio({ bio: '<p></p>' })).toBeNull();
  });
});

describe('excerptAtWord', () => {
  it('never returns more than the budget, ellipsis included', () => {
    for (let max = 5; max < 120; max += 7) {
      expect(excerptAtWord(LONG_PLAIN, max).length).toBeLessThanOrEqual(max);
    }
  });

  it('does not leave a dangling comma before the ellipsis', () => {
    expect(excerptAtWord('rooted in listening, and in patience', 22)).toBe('rooted in listening…');
  });

  it('cuts a single over-long word rather than showing nothing', () => {
    expect(excerptAtWord('Supercalifragilistic', 10)).toBe('Supercali…');
  });

  it('leaves text that fits untouched apart from whitespace', () => {
    expect(excerptAtWord('  a   b  ', 10)).toBe('a b');
  });
});

describe('the limits agree with each other', () => {
  it('the fallback excerpt fits in the space a written short bio may take', () => {
    expect(SHORT_BIO_FALLBACK_CHARS).toBeLessThanOrEqual(FIELD_LIMITS.short_bio);
  });

  it('a short bio is short', () => {
    expect(FIELD_LIMITS.short_bio).toBe(280);
  });
});

describe('fullBioAddsMore — is there anything behind "more about"?', () => {
  it('no, when the short bio is the whole bio', () => {
    const bio = 'First line.\n\nSecond line.';
    expect(fullBioAddsMore(resolveShortBio({ bio }), bio)).toBe(false);
  });

  it('yes, when the short bio is an excerpt of it', () => {
    expect(fullBioAddsMore(resolveShortBio({ bio: LONG_PLAIN }), LONG_PLAIN)).toBe(true);
  });

  it('yes, when the person wrote their own short bio', () => {
    expect(fullBioAddsMore('Facilitator.', 'I listen for a living.')).toBe(true);
  });

  it('no, when there is no full bio at all', () => {
    expect(fullBioAddsMore('Facilitator.', null)).toBe(false);
    expect(fullBioAddsMore(null, '<p></p>')).toBe(false);
  });
});
