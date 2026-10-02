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
