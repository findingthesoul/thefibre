import { describe, expect, it } from 'vitest';
// THE function the dialog calls, not a copy of the rule.
import { tierJoinLink } from './tier-link';

describe('the link to an unlisted tier', () => {
  it('is the join page with the tier named', () => {
    expect(
      tierJoinLink({
        origin: 'https://membership.thefibre.tech',
        workspaceSlug: 'soul',
        tierId: 'c0ffee00-0000-4000-8000-000000000001',
      }),
    ).toBe('https://membership.thefibre.tech/soul?tier=c0ffee00-0000-4000-8000-000000000001');
  });

  it('carries the origin it was given, so a staging screen gives a staging link', () => {
    // The dialog passes `window.location.origin`, which is the stack it is
    // being served from. The alternative — an environment variable — is how
    // a staging screen has handed out a production link before.
    expect(
      tierJoinLink({ origin: 'https://members.example.test', workspaceSlug: 'a', tierId: 'b' }),
    ).toBe('https://members.example.test/a?tier=b');
  });

  it('has no double slash when the origin ends in one', () => {
    expect(tierJoinLink({ origin: 'https://x.test/', workspaceSlug: 'a', tierId: 'b' })).toBe(
      'https://x.test/a?tier=b',
    );
  });

  it('encodes a slug that needs it', () => {
    // Slugs are user-chosen. One with a space produces a link that breaks in
    // some clients and not others, which is the worst kind of broken.
    expect(tierJoinLink({ origin: 'https://x.test', workspaceSlug: 'a b', tierId: 'c' })).toBe(
      'https://x.test/a%20b?tier=c',
    );
  });
});

describe('when there is no honest link to give', () => {
  // NULL IS THE ANSWER, and the dialog shows "save the tier first" rather
  // than an address. A URL with `undefined` in it is worse than no URL,
  // because an admin would copy it and send it.
  it('is null without a tier id — a tier that was never saved', () => {
    expect(tierJoinLink({ origin: 'https://x.test', workspaceSlug: 'a', tierId: null })).toBeNull();
    expect(tierJoinLink({ origin: 'https://x.test', workspaceSlug: 'a', tierId: '' })).toBeNull();
    expect(
      tierJoinLink({ origin: 'https://x.test', workspaceSlug: 'a', tierId: undefined }),
    ).toBeNull();
  });

  it('is null without a slug — the workspace read failed', () => {
    expect(tierJoinLink({ origin: 'https://x.test', workspaceSlug: null, tierId: 'b' })).toBeNull();
  });

  it('is null without an origin — server-rendered, before the browser knows', () => {
    expect(tierJoinLink({ origin: null, workspaceSlug: 'a', tierId: 'b' })).toBeNull();
    expect(tierJoinLink({ origin: '   ', workspaceSlug: 'a', tierId: 'b' })).toBeNull();
  });
});
