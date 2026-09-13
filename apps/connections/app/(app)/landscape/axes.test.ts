// Which readings of the landscape a workspace shows, and what it calls them.
//
// Sjoerd, 2026-09-13: *"the whole categorisation should be editible. Which
// charatceristics and how many"* and *"And the title too"*.
//
// Two functions, and the interesting one is `visibleAxes`, because it carries
// a guard that exists for a failure nobody would notice until it stranded
// somebody: a workspace with every axis hidden has a landscape page with no
// landscape on it, and the control that would put one back is on a different
// screen. The settings form refuses to untick the last one; this is the
// second guard, for a row written by anything other than that form.
//
// Mutation-checked, each fix separately:
//   - drop the `shown.length ? … : AXES` fallback → "never hides everything"
//     fails (it returns an empty list).
//   - make `axisTitle` return the stored value without the trim check →
//     "whitespace is not a name" fails.
//   - make `axisTitle` ignore the config → "the workspace's word wins" fails.
//
// What these do NOT cover: that the landscape PAGE picks a visible axis when
// the URL names a hidden one. That is in the page's own await chain, not in
// this module, and it is checked in the browser rather than here.

import { describe, expect, it } from 'vitest';
import { AXES, axisTitle, visibleAxes, type AxisConfig } from './axes';

describe('which readings a workspace shows', () => {
  it('shows all five when nobody has chosen', () => {
    expect(visibleAxes(undefined)).toEqual(AXES);
    expect(visibleAxes({})).toEqual(AXES);
  });

  it('leaves out the ones switched off, keeping the shipped order', () => {
    const config: AxisConfig = {
      closeness: { title: null, hidden: true },
      contribution: { title: null, hidden: true },
    };
    expect(visibleAxes(config)).toEqual(['maturity', 'cadence', 'opportunity']);
  });

  it('never hides everything, however the rows got that way', () => {
    // Not reachable through the settings form, which refuses to untick the
    // last one. Reachable through the API, a script, or SQL — and the result
    // would be a page with no landscape and no way back from it.
    const allHidden = Object.fromEntries(
      AXES.map((a) => [a, { title: null, hidden: true }]),
    ) as AxisConfig;
    expect(visibleAxes(allHidden)).toEqual(AXES);
  });

  it('treats an axis with a title but no hiding as visible', () => {
    expect(visibleAxes({ opportunity: { title: 'Pipeline', hidden: false } })).toEqual(AXES);
  });
});

describe('what a workspace calls a reading', () => {
  it('uses the shipped title when the workspace has not chosen one', () => {
    expect(axisTitle('en', undefined, 'opportunity')).toBe('Opportunity');
    expect(axisTitle('en', {}, 'opportunity')).toBe('Opportunity');
    expect(axisTitle('en', { opportunity: { title: null, hidden: false } }, 'opportunity')).toBe(
      'Opportunity',
    );
  });

  it("uses the workspace's own word when there is one", () => {
    expect(axisTitle('en', { opportunity: { title: 'Pipeline', hidden: false } }, 'opportunity')).toBe(
      'Pipeline',
    );
  });

  it('shows the workspace word whatever the reading language — a typed name is content', () => {
    // The same rule that leaves note bodies and budget line names alone. A
    // word somebody chose is not machine-translated, so the Dutch reader sees
    // the word the workspace picked, not a translation of it.
    const config: AxisConfig = { maturity: { title: 'Betrokkenheid', hidden: false } };
    expect(axisTitle('en', config, 'maturity')).toBe('Betrokkenheid');
    expect(axisTitle('nl', config, 'maturity')).toBe('Betrokkenheid');
  });

  it('falls back when the stored title is only whitespace', () => {
    // A row like this should not exist — the API trims and deletes an empty
    // title rather than storing one — but a blank axis heading is a bad way
    // to find that out.
    expect(axisTitle('en', { cadence: { title: '   ', hidden: false } }, 'cadence')).toBe(
      axisTitle('en', undefined, 'cadence'),
    );
  });

  it('translates the shipped title, so an untouched axis still speaks the reader’s language', () => {
    expect(axisTitle('nl', {}, 'maturity')).not.toBe(axisTitle('en', {}, 'maturity'));
  });
});
