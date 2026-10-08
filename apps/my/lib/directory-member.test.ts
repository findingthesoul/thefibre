import { describe, expect, it } from 'vitest';
import { pickMember } from './directory-member';
import type { DirectoryList, DirectoryMember } from './portal-api';

const member = (person_id: string): DirectoryMember => ({
  person_id,
  display_name: 'A Member',
  photo_url: null,
  bio: null,
  city: null,
  country: null,
  tags: [],
  categories: [],
  email: null,
  phone: null,
  linkedin_url: null,
  website_url: null,
});

const ok = (items: DirectoryMember[], you_are_listed = true): DirectoryList =>
  ({ state: 'ok', items, you_are_listed }) as DirectoryList;

describe('who a member page may show', () => {
  it('shows a member the list returned', () => {
    const r = pickMember(ok([member('p1'), member('p2')]), 'p2');
    expect(r.kind).toBe('member');
    expect(r.kind === 'member' && r.member.person_id).toBe('p2');
  });

  // THE one that matters. Everybody the list filtered out — lapsed, never
  // listed, in another category, soft-deleted, or simply not a person —
  // arrives here as "not in items", and must not be rendered.
  it('refuses anybody the list did not return', () => {
    for (const id of ['lapsed', 'not-listed', 'other-category', 'deleted', 'nonsense']) {
      expect(pickMember(ok([member('p1')]), id).kind, id).toBe('unavailable');
    }
  });

  it('shows nobody when the viewer is not listed themselves', () => {
    // Being in a directory and reading one are the same bargain, and it has
    // to hold on the detail page too — otherwise a direct link is a way
    // round the deal.
    expect(pickMember(ok([member('p1')], false), 'p1').kind).toBe('unavailable');
  });

  it('keeps a failed load apart from an absent member', () => {
    // Our outage must never read as a statement about somebody's
    // membership. These two render different sentences.
    expect(pickMember({ state: 'failed' } as DirectoryList, 'p1').kind).toBe('failed');
    expect(pickMember(ok([]), 'p1').kind).toBe('unavailable');
  });

  it('shows nobody when the community has no directory', () => {
    expect(pickMember({ state: 'none' } as DirectoryList, 'p1').kind).toBe('unavailable');
  });
});
