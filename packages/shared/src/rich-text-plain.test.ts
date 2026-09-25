// The case that reached a real calendar: a `<div>` read as part of the
// sentence, in an invitation somebody had already received.

import { describe, expect, it } from 'vitest';
import { richTextToPlain } from './rich-text-plain.js';

describe('richTextToPlain', () => {
  it('removes the tags that showed up in a participant’s calendar', () => {
    expect(
      richTextToPlain('<div>We will share learning from Cycle 1 with members.</div>'),
    ).toBe('We will share learning from Cycle 1 with members.');
  });

  // ONE newline between blocks, not two — matching the `stripHtml` in
  // routes/thread.ts that this replaces, so converting the email path is a
  // move and not a change to what thousands of already-sent messages look
  // like. A blank line would read slightly better and is not worth a silent
  // difference in live mail.
  it('keeps paragraphs apart rather than running sentences together', () => {
    expect(richTextToPlain('<p>One.</p><p>Two.</p>')).toBe('One.\nTwo.');
    expect(richTextToPlain('Line one<br>Line two')).toBe('Line one\nLine two');
  });

  it('marks list items, because a calendar has no bullets of its own', () => {
    expect(richTextToPlain('<ul><li>Bring a pen</li><li>Bring a friend</li></ul>')).toBe(
      '• Bring a pen\n• Bring a friend',
    );
  });

  it('turns entities back into the characters somebody typed', () => {
    expect(richTextToPlain('Tea &amp; biscuits &lt;at 3&gt; &quot;sharp&quot;')).toBe(
      'Tea & biscuits <at 3> "sharp"',
    );
    expect(richTextToPlain('it&#39;s here')).toBe("it's here");
  });

  it('is empty for nothing, rather than the string "null"', () => {
    expect(richTextToPlain(null)).toBe('');
    expect(richTextToPlain(undefined)).toBe('');
    expect(richTextToPlain('')).toBe('');
  });

  it('leaves plain text alone', () => {
    expect(richTextToPlain('Just a sentence.')).toBe('Just a sentence.');
  });
});
