// The sheet's dismiss threshold, as a rule rather than a number in a handler.
//
// Sjoerd, 2026-09-24: "why not also slide down on a swipe from the top bar?"
// The gesture itself needs a finger and cannot be unit-tested here, so what is
// locked is the judgement inside it: how far is far enough, and what happens
// to an upward drag.
//
// Extracted because a threshold buried in a touch handler is invisible — the
// only way to find out it was wrong would be somebody's thumb.

import { describe, expect, it } from 'vitest';
import { dismissThreshold, dragOffset } from './dialog-swipe.js';

describe('dragOffset', () => {
  it('follows a downward finger', () => {
    expect(dragOffset(40)).toBe(40);
  });

  it('ignores an upward one', () => {
    // Dragging UP would lift the sheet off the bottom of the screen and show
    // the page behind it, which looks like a bug rather than a gesture.
    expect(dragOffset(-40)).toBe(0);
    expect(dragOffset(0)).toBe(0);
  });
});

describe('dismissThreshold', () => {
  it('is a fifth of a short sheet', () => {
    expect(dismissThreshold(300)).toBe(60);
  });

  it('caps at 120px, so a tall sheet needs no longer push than a short one', () => {
    expect(dismissThreshold(1000)).toBe(120);
  });

  it('never demands more than the sheet is tall', () => {
    // A sheet shorter than the cap must still be dismissable.
    expect(dismissThreshold(100)).toBeLessThan(100);
  });
});
