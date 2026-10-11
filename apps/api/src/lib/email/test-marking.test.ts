// The promise this feature makes is one-sided, and the one-sided half is the
// one worth testing: PRODUCTION MAIL IS UNTOUCHED.
//
// Everything else here is a label. That one is a receipt arriving at a paying
// customer saying their transaction may not have been real.

import { describe, expect, it } from 'vitest';
import {
  isProductionApi,
  markHtml,
  marksMailAsTest,
  markSubject,
  markText,
  TEST_SUBJECT_PREFIX,
} from './test-marking.js';

const PROD = { FLY_APP_NAME: 'thefibre-api' };
const STAGING = { FLY_APP_NAME: 'thefibre-api-staging' };

describe('which deployment marks its mail', () => {
  it('staging does', () => {
    expect(marksMailAsTest(STAGING)).toBe(true);
  });

  // THE case. If this ever goes green-to-red, nothing else in this file
  // matters.
  it('production does NOT', () => {
    expect(marksMailAsTest(PROD)).toBe(false);
    expect(isProductionApi(PROD)).toBe(true);
  });

  // The default points at "do nothing", so an environment nobody thought
  // about sends unmarked mail rather than marking a real one. That is the
  // deliberate opposite of the environment bar, whose unknown means "show
  // the bar" — see the file comment for why the costs differ.
  it('an unknown or absent app name marks nothing', () => {
    expect(marksMailAsTest({})).toBe(false);
    expect(marksMailAsTest({ FLY_APP_NAME: '' })).toBe(false);
    expect(marksMailAsTest({ FLY_APP_NAME: 'thefibre-api-pr-42' })).toBe(false);
    expect(marksMailAsTest({ FLY_APP_NAME: 'something-else' })).toBe(false);
  });

  // A near-miss that would be easy to write with a `startsWith` or an
  // `includes`, and that would mark production.
  it('does not mark production by matching loosely', () => {
    expect(marksMailAsTest({ FLY_APP_NAME: 'thefibre-api' })).toBe(false);
    // The staging name CONTAINS the production name; the production name
    // does not contain the staging one. A substring test in either direction
    // gets one of these wrong.
    expect(STAGING.FLY_APP_NAME.includes(PROD.FLY_APP_NAME)).toBe(true);
  });
});

describe('the subject', () => {
  it('is prefixed', () => {
    expect(markSubject('Your ticket')).toBe('[STAGING] Your ticket');
  });

  // A retry marking an already-marked subject would stack prefixes, which
  // reads as a bug in the product rather than as a label.
  it('is prefixed once, however many times it passes through', () => {
    const once = markSubject('Your ticket');
    expect(markSubject(markSubject(once))).toBe(once);
    expect(once.startsWith(TEST_SUBJECT_PREFIX)).toBe(true);
  });
});

describe('the banner', () => {
  const DOC =
    '<html lang="en">\n<body style="margin: 0; padding: 0; background: #ffffff;">\n<p>Hello</p>\n</body></html>';

  it('goes INSIDE the body, not before the document', () => {
    const out = markHtml(DOC);
    const bodyAt = out.indexOf('<body');
    const bannerAt = out.indexOf('data-test-banner');
    const contentAt = out.indexOf('<p>Hello</p>');
    expect(bodyAt).toBeGreaterThanOrEqual(0);
    expect(bannerAt).toBeGreaterThan(bodyAt);
    expect(bannerAt).toBeLessThan(contentAt);
  });

  it('says what it is', () => {
    expect(markHtml(DOC)).toContain('not a real transaction');
  });

  it('keeps the whole original document', () => {
    const out = markHtml(DOC);
    expect(out).toContain('<p>Hello</p>');
    expect(out).toContain('</body></html>');
    expect(out.length).toBeGreaterThan(DOC.length);
  });

  // A template without a body tag still gets marked rather than silently
  // going out bare.
  it('falls back to the front when there is no body tag', () => {
    const out = markHtml('<p>Bare fragment</p>');
    expect(out.indexOf('data-test-banner')).toBeLessThan(out.indexOf('<p>Bare'));
  });

  it('is added once', () => {
    const once = markHtml(DOC);
    expect(markHtml(once)).toBe(once);
  });
});

describe('the plain-text part', () => {
  // Not in the original ask. Without it, whether a test email looks like a
  // test depends on which half of the multipart message the reader's client
  // decides to show.
  it('carries the same sentence', () => {
    expect(markText('Hello')).toContain('not a real transaction');
    expect(markText('Hello')).toContain('Hello');
  });

  it('is added once', () => {
    const once = markText('Hello');
    expect(markText(once)).toBe(once);
  });
});
