// The sanitiser is the only thing between an organiser's editor and a
// public page rendered with dangerouslySetInnerHTML. These lock the two
// halves: what must survive, and what must never.

import { describe, expect, it } from 'vitest';
import { sanitizeRichText } from './rich-text.js';

describe('sanitizeRichText', () => {
  it('keeps what the toolbar produces', () => {
    const html = '<p><b>Bold</b> and <i>italic</i>, a <a href="https://example.com">link</a></p>';
    const out = sanitizeRichText(html)!;
    expect(out).toContain('<b>Bold</b>');
    expect(out).toContain('<i>italic</i>');
    expect(out).toContain('href="https://example.com"');
  });

  it('keeps headings and lists', () => {
    const out = sanitizeRichText('<h3>Practical</h3><ul><li>Bring shoes</li></ul>')!;
    expect(out).toContain('<h3>');
    expect(out).toContain('<li>');
  });

  it('strips a script tag and its contents', () => {
    const out = sanitizeRichText('<p>hi</p><script>alert(1)</script>')!;
    expect(out).not.toContain('script');
    expect(out).not.toContain('alert');
  });

  it('strips event handlers', () => {
    const out = sanitizeRichText('<p onclick="alert(1)">hi</p>')!;
    expect(out).not.toContain('onclick');
  });

  it('strips a javascript: href but keeps the text', () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">click</a>')!;
    expect(out).not.toContain('javascript:');
    expect(out).toContain('click');
  });

  it('strips iframes and inline styles', () => {
    const out = sanitizeRichText('<iframe src="https://evil.test"></iframe><p style="x">hi</p>')!;
    expect(out).not.toContain('iframe');
    expect(out).not.toContain('style=');
  });

  it('reads an emptied editor as nothing, not as an empty paragraph', () => {
    // What a contentEditable leaves behind when you select all and delete.
    expect(sanitizeRichText('<p><br></p>')).toBeNull();
    expect(sanitizeRichText('   ')).toBeNull();
    expect(sanitizeRichText('')).toBeNull();
  });

  it('passes null through rather than inventing a value', () => {
    expect(sanitizeRichText(null)).toBeNull();
    expect(sanitizeRichText(undefined)).toBeNull();
  });

  it('leaves plain text alone — every intention written before today is plain', () => {
    const out = sanitizeRichText('A full year round agenda.\nSecond line.')!;
    expect(out).toContain('A full year round agenda.');
    expect(out).toContain('Second line.');
  });
});
