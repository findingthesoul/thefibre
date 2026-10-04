import { describe, expect, it } from 'vitest';
import { sanitizeRichText } from './rich-text.js';

// A contenteditable that starts empty leaves its first line as a bare text
// node: `Fixture bio….<h3>A heading</h3><div>And a closing line.</div>`.
// Stored like that, the reader's conservative plain-or-HTML detector sees
// text at the start, treats the whole value as plain and escapes it — so
// reopening the editor shows `&lt;h3&gt;` as characters, and saving again
// stores the escaped text. Found on staging by the save fixture, 2026-10-04.
//
// The fix is at the source: whatever a browser produces, the stored value
// begins with a block element. These assert the API half; the editor emits
// the same shape through the same function.

describe('what a browser leaves loose is given a shape', () => {
  it('wraps a bare first line, so the value starts with a block', () => {
    const out = sanitizeRichText('Fixture bio.<h3>A heading</h3><div>Closing line.</div>') ?? '';
    expect(out.startsWith('<p>'), out.slice(0, 40)).toBe(true);
    expect(out).toContain('<p>Fixture bio.</p>');
    expect(out).toContain('<h3>A heading</h3>');
    // Chromium's trailing <div> is a paragraph like any other.
    expect(out).toContain('<p>Closing line.</p>');
    expect(out).not.toContain('<div>');
  });

  it('keeps one line one paragraph, inline markup and all', () => {
    const out = sanitizeRichText('I am a <strong>co-founder</strong> here.') ?? '';
    expect(out).toBe('<p>I am a <strong>co-founder</strong> here.</p>');
  });

  it('leaves a well-formed bio exactly as it was', () => {
    // The ones already in the database must not be reflowed by this.
    const already = '<p>One.</p><p>Two.</p><ul><li>Three</li></ul>';
    expect(sanitizeRichText(already)).toBe(already);
  });

  it('unwraps a div that holds blocks rather than nesting a paragraph in it', () => {
    const out = sanitizeRichText('<div><h3>Title</h3><p>Body.</p></div>') ?? '';
    expect(out).toBe('<h3>Title</h3><p>Body.</p>');
  });

  it('still refuses the dangerous parts while fixing the shape', () => {
    const out = sanitizeRichText('Hello<script>alert(1)</script><div onclick="x()">there</div>') ?? '';
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out.toLowerCase()).not.toContain('onclick');
    expect(out).toContain('Hello');
    expect(out).toContain('there');
    expect(out.startsWith('<p>')).toBe(true);
  });

  it('is still nothing when there is nothing', () => {
    expect(sanitizeRichText('<div><br></div>')).toBeNull();
    expect(sanitizeRichText('   ')).toBeNull();
  });
});
