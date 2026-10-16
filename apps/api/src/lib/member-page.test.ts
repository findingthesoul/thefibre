// Member page per tier (Sjoerd 2jj): who sees a document. Pinned because the
// coordinator asked for it — a document written before tiers existed (no
// tier_ids) or saved as "every member" (an empty list) keeps today's
// behaviour: every member sees it.

import { describe, expect, it } from 'vitest';
import { visibleTo } from './member-page.js';

const SINGER = 'a0000000-0000-4000-8000-000000000001';
const FRIEND = 'a0000000-0000-4000-8000-000000000002';

describe('visibleTo', () => {
  it('no tier_ids: every member, whatever they hold (today’s behaviour)', () => {
    expect(visibleTo({}, [SINGER])).toBe(true);
    expect(visibleTo({}, [])).toBe(true);
    expect(visibleTo({ tier_ids: null }, [FRIEND])).toBe(true);
  });

  it('an empty list: every member too', () => {
    expect(visibleTo({ tier_ids: [] }, [SINGER])).toBe(true);
    expect(visibleTo({ tier_ids: [] }, [])).toBe(true);
  });

  it('a list: only members holding one of those tiers', () => {
    expect(visibleTo({ tier_ids: [SINGER] }, [SINGER])).toBe(true);
    expect(visibleTo({ tier_ids: [SINGER] }, [FRIEND])).toBe(false);
    expect(visibleTo({ tier_ids: [SINGER, FRIEND] }, [FRIEND])).toBe(true);
    // A member whose row has no tier holds nothing a list can match.
    expect(visibleTo({ tier_ids: [SINGER] }, [])).toBe(false);
  });

  it('two tiers held (two person rows): either one opens it', () => {
    expect(visibleTo({ tier_ids: [FRIEND] }, [SINGER, FRIEND])).toBe(true);
  });
});
