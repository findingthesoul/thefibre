// The switch's one subtle state: NULL.
//
// A page whose row predates the question IS public right now. Showing that
// as "off" would be a lie told by a checkbox, and the person would leave the
// screen believing they had no page while strangers could read it.

import { describe, expect, it } from 'vitest';
// THE component's own function, not a copy of it. The first version of this
// file restated the rule here and would have passed no matter what the
// component did.
import { publicPageState as switchState } from './public-page-switch.js';

describe('what the switch shows', () => {
  it('NULL reads as ON, with the notice', () => {
    // Because that is what is true: the page is serving.
    expect(switchState(null)).toEqual({ on: true, notice: true });
  });

  it('true reads as on, with no notice — they already answered', () => {
    expect(switchState(true)).toEqual({ on: true, notice: false });
  });

  it('false reads as off', () => {
    expect(switchState(false)).toEqual({ on: false, notice: false });
  });
});
