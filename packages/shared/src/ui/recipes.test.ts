// The one coupling in recipes.ts that breaks silently.
//
// ROW_LIST takes a list to the screen edges on a phone with a negative margin
// that has to cancel PAGE_PX exactly. Get it wrong in one direction and the
// list stops short of the edge — the thing Sjoerd asked for twice on
// 2026-09-21 ("full width... like a list on the iPhone itself", "the
// landscape interface: full width"). Get it wrong in the other and the list
// sticks out past the viewport and the whole page scrolls sideways, which is
// worse and is invisible on a desktop browser.
//
// Neither shows up in a typecheck, a build, or any test of behaviour. This is
// the only thing that catches it.

import { describe, expect, it } from 'vitest';
import { PAGE_PX, ROW_LIST } from './recipes.js';

/** The phone-width value of a `px-N sm:px-M` pair. */
function phonePadding(spec: string): number {
  const m = spec.match(/(?:^|\s)px-(\d+)(?:\s|$)/);
  if (!m) throw new Error(`PAGE_PX has no unprefixed px- class: ${spec}`);
  return Number(m[1]);
}

/** The phone-width bleed of ROW_LIST. */
function bleed(spec: string): number {
  const m = spec.match(/(?:^|\s)-mx-(\d+)(?:\s|$)/);
  if (!m) throw new Error(`ROW_LIST has no unprefixed -mx- class: ${spec}`);
  return Number(m[1]);
}

describe('a list that reaches the screen edge', () => {
  it('bleeds by exactly the page padding on a phone', () => {
    expect(bleed(ROW_LIST)).toBe(phonePadding(PAGE_PX));
  });

  it('stops bleeding from `sm` up, where the page becomes a card again', () => {
    expect(ROW_LIST).toContain('sm:mx-0');
    expect(ROW_LIST).toContain('sm:rounded-lg');
    // And the page's own padding grows at the same breakpoint, so the two
    // never disagree about where "a phone" ends.
    expect(PAGE_PX).toMatch(/\bsm:px-\d+\b/);
  });
});
