import { describe, expect, it } from 'vitest';
import { pickPriceLogicRow } from './price-logic.js';

// ---------------------------------------------------------------------------
// SIX ROWS, AND THE OLDEST ONE WAS CHARGING.
//
// soul.com's pricing rules, read off production on 2026-10-14. The table is
// unique on (workspace_id, kind, tier_id); Postgres treats NULLs as DISTINCT
// in a unique index; a general rule's tier_id is null — so the route's upsert
// inserted a new row on every save, and both readers did `find()` on a query
// with no ORDER BY.
//
// The row deciding what people PAID was from 7 September. Chile and El
// Salvador were charged 100% where the admin had configured 75%, and the
// admin's six saves were all in the table, unread. Nobody was mischarged only
// because the affected members happened to be on an unpriced tier.
//
// The real rows are used here rather than invented ones: a test that only
// passes against tidy data would not have caught this.
// ---------------------------------------------------------------------------

type Row = {
  id: string;
  tier_id: string | null;
  config: { rules: { when: { attr: string; op: string; values: string[] }; pct: number }[] };
  updated_at: string;
  created_at?: string;
};

const rule = (values: string[], pct: number) => ({
  when: { attr: 'country', op: 'in', values },
  pct,
});

/** soul.com, exactly as production held it, in the order PostgREST returned
 *  it — which is the order that produced the bug. */
const SOUL: Row[] = [
  {
    id: 'a238bb41',
    tier_id: null,
    config: { rules: [rule(['ZA'], 75), rule(['AO'], 50)] },
    updated_at: '2026-09-07T16:15:39.244695+00:00',
  },
  {
    id: 'bca8eb44',
    tier_id: null,
    config: { rules: [rule(['ZA', 'SV', 'BR', 'CL'], 75), rule(['AO'], 50)] },
    updated_at: '2026-09-25T13:36:58.204+00:00',
  },
  {
    id: '202d69f1',
    tier_id: null,
    config: { rules: [rule(['ZA', 'SV', 'BR', 'CL', 'CW'], 75), rule(['AO'], 50)] },
    updated_at: '2026-09-25T13:37:15.166+00:00',
  },
  {
    id: 'c5511b1c',
    tier_id: null,
    config: { rules: [rule(['BR'], 65), rule(['AO', 'ZA', 'SV'], 40)] },
    updated_at: '2026-10-07T08:27:12.811+00:00',
  },
  {
    id: 'a824b3d9',
    tier_id: null,
    config: { rules: [rule(['ZA', 'CL', 'SV'], 75), rule(['AO'], 50)] },
    updated_at: '2026-10-14T08:25:47.822+00:00',
  },
];

describe("soul.com's six general rules", () => {
  it('uses the newest, not the first', () => {
    // `find(r => r.tier_id === null)` returned a238bb41 here. That is the bug.
    expect(pickPriceLogicRow(SOUL, null)?.id).toBe('a824b3d9');
  });

  it('is not fooled by the order the rows arrive in', () => {
    // The whole fault was depending on an order nothing guaranteed, so the
    // answer must not change when the order does.
    const shuffles = [
      [...SOUL].reverse(),
      [SOUL[2]!, SOUL[4]!, SOUL[0]!, SOUL[3]!, SOUL[1]!],
      [SOUL[4]!, ...SOUL.slice(0, 4)],
    ];
    for (const rows of shuffles) {
      expect(pickPriceLogicRow(rows, null)?.id).toBe('a824b3d9');
    }
  });

  it('picks the rule set that gives Chile and El Salvador their 75%', () => {
    // The consequence, stated as money rather than as an id.
    const picked = pickPriceLogicRow(SOUL, null)!;
    const seventyFive = picked.config.rules.find((r) => r.pct === 75)!.when.values;
    expect(seventyFive).toContain('CL');
    expect(seventyFive).toContain('SV');
    expect(seventyFive).toContain('ZA');
  });
});

describe('two general rows, which is the minimum that breaks', () => {
  const older = { id: 'a', tier_id: null, config: { rules: [] }, updated_at: '2026-01-01T00:00:00Z' };
  const newer = { id: 'b', tier_id: null, config: { rules: [] }, updated_at: '2026-02-01T00:00:00Z' };

  it('takes the newer one whichever way round they come', () => {
    expect(pickPriceLogicRow([older, newer], null)?.id).toBe('b');
    expect(pickPriceLogicRow([newer, older], null)?.id).toBe('b');
  });
});

describe('a tier-specific rule', () => {
  const general = { id: 'g', tier_id: null, config: { rules: [] }, updated_at: '2026-10-14T00:00:00Z' };
  const forTier = { id: 't', tier_id: 'tier-1', config: { rules: [] }, updated_at: '2026-09-01T00:00:00Z' };

  it('wins over a NEWER general one', () => {
    // Unchanged behaviour, and the reason this is not just "the newest row":
    // a general rule saved today must not override a tier's own rule.
    expect(pickPriceLogicRow([general, forTier], 'tier-1')?.id).toBe('t');
  });

  it('does not apply to another tier', () => {
    expect(pickPriceLogicRow([general, forTier], 'tier-2')?.id).toBe('g');
  });

  it('falls back to the general one when the tier has none', () => {
    expect(pickPriceLogicRow([general], 'tier-9')?.id).toBe('g');
  });

  it('is itself de-duplicated by date', () => {
    const newerForTier = { ...forTier, id: 't2', updated_at: '2026-10-01T00:00:00Z' };
    expect(pickPriceLogicRow([forTier, newerForTier, general], 'tier-1')?.id).toBe('t2');
  });
});

describe('the sort keys', () => {
  it('falls back to created_at when updated_at is missing', () => {
    // A writer that forgets `updated_at` is how a display bug becomes a
    // charging bug, so the database's own default is the second key.
    const a = { id: 'a', tier_id: null, config: { rules: [] }, created_at: '2026-01-01T00:00:00Z' };
    const b = { id: 'b', tier_id: null, config: { rules: [] }, created_at: '2026-05-01T00:00:00Z' };
    expect(pickPriceLogicRow([b, a], null)?.id).toBe('b');
    expect(pickPriceLogicRow([a, b], null)?.id).toBe('b');
  });

  it('breaks a full tie on id, so the order is total', () => {
    const a = { id: 'aaa', tier_id: null, config: { rules: [] }, updated_at: '2026-01-01T00:00:00Z' };
    const b = { id: 'bbb', tier_id: null, config: { rules: [] }, updated_at: '2026-01-01T00:00:00Z' };
    expect(pickPriceLogicRow([a, b], null)?.id).toBe('bbb');
    expect(pickPriceLogicRow([b, a], null)?.id).toBe('bbb');
  });
});

describe('nothing to pick', () => {
  it('answers null rather than guessing', () => {
    expect(pickPriceLogicRow([], null)).toBeNull();
    expect(pickPriceLogicRow([], 'tier-1')).toBeNull();
    // Only another tier's rule exists: this tier has no logic, and inventing
    // one would be inventing a price.
    expect(
      pickPriceLogicRow(
        [{ id: 'x', tier_id: 'other', config: { rules: [] }, updated_at: '2026-01-01T00:00:00Z' }],
        'tier-1',
      ),
    ).toBeNull();
  });
});
