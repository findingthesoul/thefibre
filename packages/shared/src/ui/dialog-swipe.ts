// The two judgements inside the bottom sheet's swipe-to-dismiss, pulled out of
// the touch handlers so they can be tested and read.
//
// The gesture needs a finger; these do not. See dialog-swipe.test.ts.

/** How far the sheet has moved, given how far the finger has. Downward only:
 *  dragging UP would lift the sheet off the bottom of the screen and show the
 *  page behind it, which reads as a bug rather than a gesture. */
export function dragOffset(deltaY: number): number {
  return deltaY > 0 ? deltaY : 0;
}

/** Far enough to mean it. A fifth of the sheet, capped at 120px — a tall
 *  sheet should not need a longer push than a short one, and a short sheet
 *  must still be dismissable. */
export function dismissThreshold(sheetHeight: number): number {
  return Math.min(120, sheetHeight * 0.2);
}
