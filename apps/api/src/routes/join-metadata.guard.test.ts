import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// THE TWO SIDES OF THE JOIN METADATA MUST AGREE.
//
// The welcome email is composed inside `ensureMemberFromSubscription`, which
// reads `sub.metadata` — the SUBSCRIPTION's. The checkout session writes
// metadata in two places, its own and `subscription_data`, and only the
// second one reaches the subscription.
//
// `option_product_ids` was on the session's metadata alone. The purchase rows
// it names are inserted by `checkout.session.completed`, BEFORE that handler
// converges the member — deliberately. But `invoice.paid` reaches the same
// converge through `memberForInvoice`, and Stripe promises no order between
// the two events. If `invoice.paid` lands first, the welcome is composed
// while the purchase rows do not exist, and the bought calendar is missing
// for exactly the first member who bought one.
//
// A test, not a comment, because the failure is invisible in every local run:
// it needs two Stripe events in an order you cannot ask for.
// ---------------------------------------------------------------------------

const SRC = readFileSync(new URL('./membership.ts', import.meta.url), 'utf8');

/** The `subscription_data: { … }` block of the join checkout, by brace
 *  matching rather than by a regex over nested objects — a regex that walks
 *  into the wrong closing brace would pass for the wrong reason. */
function subscriptionDataBlock(src: string): string {
  const at = src.indexOf('subscription_data: {');
  expect(at, 'subscription_data not found in membership.ts').toBeGreaterThan(-1);
  let depth = 0;
  for (let i = src.indexOf('{', at); i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(at, i + 1);
    }
  }
  throw new Error('subscription_data block never closes');
}

describe('what the join writes onto the subscription', () => {
  const block = subscriptionDataBlock(SRC);

  it('includes every key the webhook reads back off sub.metadata', () => {
    // Each of these is read as `meta.<key>` inside
    // `ensureMemberFromSubscription` or the welcome it composes. A key the
    // webhook reads and the checkout never writes is silently undefined.
    for (const key of [
      'workspace_id',
      'person_id',
      'tier_id',
      'locale',
      'option_product_ids',
    ]) {
      expect(block, `subscription_data.metadata is missing ${key}`).toContain(key);
    }
  });

  it('carries the ticked extras, which the purchase table cannot be relied on for', () => {
    // The specific regression. Stated on its own so a failure names the
    // reason rather than a list of keys.
    expect(block).toContain('option_product_ids');
  });
});

describe('the welcome composes the calendars from both sources', () => {
  it('unions the metadata ids with whatever the table holds', () => {
    // Either source alone drops a calendar somebody paid for: the metadata
    // knows only this join, the table only the earlier ones.
    expect(SRC).toContain('alsoBought');
    expect(SRC).toMatch(/option_product_ids\s*\?\?\s*''\)\.split\(','\)/);
  });
});
