import { describe, expect, it } from 'vitest';
import { groupOwnedProducts, type BoughtRow } from './portal.js';

// ---------------------------------------------------------------------------
// "YOUR PRODUCTS" — the list that was keyed on the wrong thing.
//
// Until 2026-10-14 a person's purchases were assembled inside the membership
// loop and filtered to the workspaces they held a membership in. So somebody
// who bought a product from a community they had never joined owned it, was
// granted access by it, and could see no sign of it anywhere — and the one
// page that should have shown it told them "You are not a member anywhere
// yet."
//
// That matters more now that the Members app's `/my` redirects to my.thread:
// this page is where a product-only buyer lands.
// ---------------------------------------------------------------------------

const name = (id: string) => ({ name: id, description: null, url: null });

const row = (ws: string, product: string, created_at: string): BoughtRow => ({
  workspace_id: ws,
  product_id: product,
  created_at,
});

describe('a person who bought from a community they never joined', () => {
  it('still gets a group for it', () => {
    // The whole point. No membership appears anywhere in this function's
    // inputs, which is the fix: the purchase is the person's.
    const out = groupOwnedProducts([row('ws-never-joined', 'p1', '2026-10-01T00:00:00Z')], name);
    expect([...out.keys()]).toEqual(['ws-never-joined']);
    expect(out.get('ws-never-joined')).toEqual([
      { name: 'p1', description: null, url: null, bought_on: '2026-10-01T00:00:00Z' },
    ]);
  });
});

describe('the order', () => {
  it('is the caller\'s — newest first, not re-sorted', () => {
    // The query orders by created_at desc. Re-sorting here would be a second
    // opinion about the order, and the two would eventually disagree.
    const out = groupOwnedProducts(
      [
        row('ws', 'newest', '2026-10-10T00:00:00Z'),
        row('ws', 'middle', '2026-06-01T00:00:00Z'),
        row('ws', 'oldest', '2026-01-01T00:00:00Z'),
      ],
      name,
    );
    expect(out.get('ws')!.map((p) => p.name)).toEqual(['newest', 'middle', 'oldest']);
  });
});

describe('the same product bought twice', () => {
  it('is listed once, keeping the most recent date', () => {
    // A second seat or a repeat year is real, and "What you paid" is where
    // each payment belongs — with its own date and amount. Two identical
    // lines in a list of what you own reads as a bug.
    const out = groupOwnedProducts(
      [
        row('ws', 'seat', '2026-10-10T00:00:00Z'),
        row('ws', 'seat', '2025-10-10T00:00:00Z'),
      ],
      name,
    );
    expect(out.get('ws')).toHaveLength(1);
    expect(out.get('ws')![0]!.bought_on).toBe('2026-10-10T00:00:00Z');
  });

  it('is still two rows when the communities differ', () => {
    const out = groupOwnedProducts(
      [row('ws-a', 'p', '2026-10-10T00:00:00Z'), row('ws-b', 'p', '2026-10-09T00:00:00Z')],
      name,
    );
    expect(out.size).toBe(2);
  });
});

describe('a product that cannot be named', () => {
  it('is dropped, not shown as a blank line', () => {
    // An archived row, or one the resolver has no record of. A line with no
    // name is worse than no line: it tells somebody they own something and
    // refuses to say what.
    const out = groupOwnedProducts(
      [row('ws', 'gone', '2026-10-10T00:00:00Z'), row('ws', 'ok', '2026-10-09T00:00:00Z')],
      (id) => (id === 'gone' ? null : name(id)),
    );
    expect(out.get('ws')!.map((p) => p.name)).toEqual(['ok']);
  });

  it('leaves the workspace out entirely when nothing resolves', () => {
    // And therefore gives it no group — a community heading with nothing
    // under it is the empty page in a smaller frame.
    expect(groupOwnedProducts([row('ws', 'gone', '2026-10-10T00:00:00Z')], () => null).size).toBe(0);
  });
});

describe('nothing bought', () => {
  it('is an empty map, so no group is invented', () => {
    expect(groupOwnedProducts([], name).size).toBe(0);
  });
});
