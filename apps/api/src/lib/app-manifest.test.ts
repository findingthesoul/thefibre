// What a manifest PUT may do to the scopes a key is capped by
// (settleRequestedScopes): after approval, more waits for review; the same or
// fewer applies at once; before review, and for the reviewer, the request is
// the cap. apps-manifest-review.int.test.ts proves the route on staging.
import { describe, expect, it } from 'vitest';
import { readPendingScopes, sameSet, settleRequestedScopes } from './app-manifest.js';

const APPROVED = ['read:persons', 'read:organisations'];

describe('settleRequestedScopes', () => {
  it('an approved app asking for more: the extra waits, the cap does not rise', () => {
    expect(
      settleRequestedScopes({ approved: APPROVED, requested: ['read:persons', 'write:persons'], reviewed: true, byReviewer: false }),
    ).toEqual({ scopes_requested: ['read:persons'], scopes_pending_review: ['write:persons'] });
  });

  it('the same or fewer applies at once', () => {
    expect(settleRequestedScopes({ approved: APPROVED, requested: APPROVED, reviewed: true, byReviewer: false })).toEqual({
      scopes_requested: APPROVED,
      scopes_pending_review: [],
    });
    expect(settleRequestedScopes({ approved: APPROVED, requested: ['read:persons'], reviewed: true, byReviewer: false })).toEqual({
      scopes_requested: ['read:persons'],
      scopes_pending_review: [],
    });
  });

  it('before review, and for the reviewer, the request is the cap', () => {
    const wide = ['read:persons', 'write:persons'];
    expect(settleRequestedScopes({ approved: APPROVED, requested: wide, reviewed: false, byReviewer: false }).scopes_requested).toEqual(wide);
    expect(settleRequestedScopes({ approved: APPROVED, requested: wide, reviewed: true, byReviewer: true }).scopes_requested).toEqual(wide);
  });

  it('an app that declared no scopes is uncapped, so any list narrows it', () => {
    expect(settleRequestedScopes({ approved: null, requested: ['read:persons'], reviewed: true, byReviewer: false })).toEqual({
      scopes_requested: ['read:persons'],
      scopes_pending_review: [],
    });
  });

  it('drops what is not a scope at all, and repeats', () => {
    expect(
      settleRequestedScopes({ approved: APPROVED, requested: ['read:persons', 'read:persons', 'root:everything'], reviewed: true, byReviewer: false }),
    ).toEqual({ scopes_requested: ['read:persons'], scopes_pending_review: [] });
  });
});

describe('readPendingScopes / sameSet', () => {
  it('reads only real scopes, and nothing from a manifest without the field', () => {
    expect(readPendingScopes({ scopes_pending_review: ['write:persons', 'nope', 'write:persons'] })).toEqual(['write:persons']);
    expect(readPendingScopes({})).toEqual([]);
    expect(readPendingScopes(null)).toEqual([]);
  });

  it('order does not matter; null is empty', () => {
    expect(sameSet(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameSet(['a'], ['a', 'b'])).toBe(false);
    expect(sameSet(null, [])).toBe(true);
  });
});
