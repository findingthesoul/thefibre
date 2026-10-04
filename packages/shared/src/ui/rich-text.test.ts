import { describe, expect, it } from 'vitest';
import { RICH_TEXT_TYPOGRAPHY } from './rich-text.js';

// A Tailwind class that is present in the DOM and generates no rule is
// invisible to every check we have: typecheck passes, the class string is
// right there in the markup, and the page merely looks slightly wrong in a
// way nobody attributes to a missing rule. `[&_ul,&_ol]:pl-5` was exactly
// that — it sat in this component from the day it was extracted, and bullet
// lists on the public thread page, in the portal and in a bio all rendered
// with their markers outside the text column.
//
// This cannot assert what the browser computes, so it asserts the shape that
// made it inert: one selector per variant, which Tailwind definitely emits.
describe('the shared rich-text typography', () => {
  it('indents BOTH list kinds, each as its own variant', () => {
    expect(RICH_TEXT_TYPOGRAPHY).toContain('[&_ul]:pl-5');
    expect(RICH_TEXT_TYPOGRAPHY).toContain('[&_ol]:pl-5');
  });

  it('contains no comma inside an arbitrary variant', () => {
    // `[&_ul,&_ol]:pl-5` — the form that produced no rule at all.
    const commaVariants = RICH_TEXT_TYPOGRAPHY.match(/\[[^\]]*,[^\]]*\]/g);
    expect(commaVariants).toBeNull();
  });

  it('still gives lists their markers', () => {
    expect(RICH_TEXT_TYPOGRAPHY).toContain('[&_ul]:list-disc');
    expect(RICH_TEXT_TYPOGRAPHY).toContain('[&_ol]:list-decimal');
  });

  it('keeps links underlined — a link a reader cannot see is not a link', () => {
    expect(RICH_TEXT_TYPOGRAPHY).toContain('[&_a]:underline');
  });

  it('gives a list room above and below', () => {
    // Every caller sets paragraph margins and no caller sets list margins.
    expect(RICH_TEXT_TYPOGRAPHY).toMatch(/\[&_ul\]:my-\d/);
    expect(RICH_TEXT_TYPOGRAPHY).toMatch(/\[&_ol\]:my-\d/);
  });
});

// Tailwind's preflight sets `h1..h6 { font-size: inherit; font-weight:
// inherit }`, so a heading renders exactly like a paragraph unless this
// string puts it back. Sjoerd pressed the heading button on his bio, saw
// nothing happen, and reported the button as broken — it was working, and
// producing invisible headings in the editor and on the published page.
//
// Measured in the live editor before the fix: an <h3> computed to
// `14px / 400`, identical to the <p> beside it.
describe('a heading looks like a heading', () => {
  it('gives every heading the sanitiser allows a size of its own', () => {
    // apps/api/src/lib/rich-text.ts permits h1-h4, so all four can arrive.
    for (const h of ['h1', 'h2', 'h3', 'h4']) {
      expect(RICH_TEXT_TYPOGRAPHY, `${h} has no size`).toMatch(
        new RegExp(`\\[&_${h}\\]:text-\\[1\\.\\d+em\\]`),
      );
      expect(RICH_TEXT_TYPOGRAPHY, `${h} has no weight`).toContain(`[&_${h}]:font-semibold`);
    }
  });

  it('sizes them in em, so one string works at every scale', () => {
    // A fixed px size would make a heading in a 14px form field the same size
    // as one on a public page, which is the wrong relationship.
    expect(RICH_TEXT_TYPOGRAPHY).not.toMatch(/\[&_h[1-4]\]:text-\[\d+px\]/);
  });

  it('gives a heading room above it, so it reads as a new section', () => {
    expect(RICH_TEXT_TYPOGRAPHY).toMatch(/\[&_h3\]:mt-\d/);
  });
});
