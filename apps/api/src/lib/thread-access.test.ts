import { describe, it, expect } from 'vitest';
import { threadSlugFromConfig } from './thread-access.js';

// The parser is the only pure part of the worker, and it is the part that
// decides whether a grant resolves at all. soul.com's real grant stores a
// full public URL, not a slug — which is why this exists.
describe('threadSlugFromConfig', () => {
  it('takes the last segment of a full public URL', () => {
    expect(
      threadSlugFromConfig({
        thread_slug: 'https://app.thethread.app/soul/community-member-year-agenda',
      }),
    ).toBe('community-member-year-agenda');
  });

  it('accepts a bare slug', () => {
    expect(threadSlugFromConfig({ thread_slug: 'dagje-delft-2' })).toBe('dagje-delft-2');
  });

  it('ignores a query string and a fragment', () => {
    expect(threadSlugFromConfig({ thread_slug: '/soul/year-agenda?lang=nl#top' })).toBe(
      'year-agenda',
    );
  });

  it('tolerates a trailing slash', () => {
    expect(threadSlugFromConfig({ thread_slug: 'https://app.thethread.app/soul/year-agenda/' })).toBe(
      'year-agenda',
    );
  });

  it('lowercases, because slugs are stored lowercase', () => {
    expect(threadSlugFromConfig({ thread_slug: 'Year-Agenda' })).toBe('year-agenda');
  });

  it('returns null for anything unusable rather than guessing', () => {
    expect(threadSlugFromConfig(null)).toBeNull();
    expect(threadSlugFromConfig({})).toBeNull();
    expect(threadSlugFromConfig({ thread_slug: '' })).toBeNull();
    expect(threadSlugFromConfig({ thread_slug: '   ' })).toBeNull();
    expect(threadSlugFromConfig({ thread_slug: 42 })).toBeNull();
  });
});
