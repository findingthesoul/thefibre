import { describe, expect, it } from 'vitest';
import { bioToHtml, bioToPlain, looksLikeStoredHtml } from './bio-html.js';
import { richTextToPlain } from './rich-text-plain.js';

describe('a bio that is still plain text', () => {
  it('keeps its line breaks, which an HTML renderer would otherwise swallow', () => {
    expect(bioToHtml('One line\nAnother line')).toBe('<p>One line<br>Another line</p>');
  });

  it('turns a blank line into a new paragraph, as the old box looked', () => {
    expect(bioToHtml('First para.\n\nSecond para.')).toBe('<p>First para.</p><p>Second para.</p>');
  });

  it('escapes what somebody TYPED, rather than rendering it', () => {
    // The old field was plain text, so "<3" and "A & B" are characters a real
    // person put in a real bio. They must survive as characters.
    expect(bioToHtml('I <3 facilitating & listening')).toBe(
      '<p>I &lt;3 facilitating &amp; listening</p>',
    );
  });

  it('escapes an attempt at markup rather than honouring it', () => {
    const out = bioToHtml('<script>alert(1)</script>');
    expect(out).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    expect(out).not.toContain('<script>');
  });

  it('escapes an img with an onerror handler', () => {
    const out = bioToHtml('<img src=x onerror=alert(1)>');
    expect(out).not.toMatch(/<img/i);
    expect(out).toContain('&lt;img');
  });

  it('escapes a javascript: link', () => {
    const out = bioToHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toMatch(/<a /i);
    expect(out).toContain('&lt;a href=&quot;javascript:');
  });
});

describe('a bio the editor has written', () => {
  it('passes HTML through — it was sanitised where it entered', () => {
    expect(bioToHtml('<p>Hello <strong>there</strong></p>')).toBe(
      '<p>Hello <strong>there</strong></p>',
    );
  });

  it('recognises each opener the sanitiser allows at the start', () => {
    for (const html of [
      '<p>x</p>',
      '<div>x</div>',
      '<ul><li>x</li></ul>',
      '<ol><li>x</li></ol>',
      '<h2>x</h2>',
      '<blockquote>x</blockquote>',
      '<br>',
    ]) {
      expect(looksLikeStoredHtml(html)).toBe(true);
    }
  });

  it('does NOT mistake a sentence that merely contains a tag-like word', () => {
    // The guess has to be conservative: wrong here means somebody's text is
    // rendered as markup on a public page.
    expect(looksLikeStoredHtml('I work with <people> in groups')).toBe(false);
    expect(looksLikeStoredHtml('a < b, usually')).toBe(false);
    expect(bioToHtml('I work with <people> in groups')).toContain('&lt;people&gt;');
  });
});

describe('nothing to show', () => {
  it('is null for empty, blank and absent, so no element is rendered', () => {
    expect(bioToHtml(null)).toBeNull();
    expect(bioToHtml(undefined)).toBeNull();
    expect(bioToHtml('')).toBeNull();
    expect(bioToHtml('   \n  ')).toBeNull();
  });
});

describe('the published plain-text field', () => {
  it('leaves plain text exactly as it is', () => {
    // Stripping HTML from "a < b, usually" is not a no-op, and during the
    // transition most bios are still plain.
    expect(bioToPlain('a < b, usually', richTextToPlain)).toBe('a < b, usually');
    expect(bioToPlain('Tea & biscuits', richTextToPlain)).toBe('Tea & biscuits');
  });

  it('flattens HTML once the editor has written some', () => {
    expect(bioToPlain('<p>One.</p><p>Two.</p>', richTextToPlain)).toBe('One.\nTwo.');
  });

  it('is null for nothing', () => {
    expect(bioToPlain(null, richTextToPlain)).toBeNull();
    expect(bioToPlain('  ', richTextToPlain)).toBeNull();
  });
});
