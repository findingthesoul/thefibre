// The pricing LOGIC engine (proposal §3.9, generalised 2026-09-05 —
// Sjoerd: "can we not make a logic builder… other people can build other
// logic?"). Rules are declarative rows, deliberately not a canvas: money
// logic must be auditable at a glance.
//
// A workspace stores one 'price_logic' rule set (optionally one per tier;
// tier-specific wins). Shape:
//   { rules: [{ when: { attr, op, values }, pct }], default_pct: 100 }
// Evaluation: first matching rule wins; no match → default_pct.
//
// The ATTRIBUTE vocabulary is deploy-time (like grant kinds and app-key
// scopes): 'country' today; 'interval' is wired below because it is free;
// date windows (early-bird), member status etc. are new entries here, not
// migrations. Percentages apply to the tier price at CHECKOUT — never
// silently afterwards; a member's declared-country change reprices from
// the next renewal, on purpose, via repricing code, not re-evaluation.

import { adminClient } from '../db.js';
import { rows } from './rows.js';

// THE ARITHMETIC LIVES IN @thefibre/shared/price-logic.
//
// It used to live here, and the join panel had its own copy so it could show
// a price before asking for money. The two disagreed: a 12.5% rule displayed
// 12.5 and charged 13, and a 0% rule displayed free and charged 1%. One
// implementation now, imported by both — the panel is the offer, this is the
// enforcement, and they are the same code.
//
// Re-exported under the names this module already published, so every caller
// is untouched and nothing has to know where it moved.
export {
  clampPct,
  evaluatePriceLogic,
  applyPct,
  type PriceCondition,
  type PriceRule,
  type PriceLogic,
  type PriceContext,
} from '@thefibre/shared/price-logic';
import { pickPriceLogicRow } from '@thefibre/shared/price-logic';
import type { PriceLogic } from '@thefibre/shared/price-logic';

/** Tier-specific logic wins over the workspace-wide one. */
export async function priceLogicFor(
  workspaceId: string,
  tierId: string | null,
): Promise<PriceLogic | null> {
  // Throws on a failed read: `null` here means "no rule, charge the default",
  // which is a price, not an error message. A member must not be charged the
  // default because a query broke.
  const rules = rows(
    'membership pricing rules',
    await adminClient
      .from('membership_pricing_rule')
      // `updated_at, created_at, id` are not decoration: they are what
      // `pickPriceLogicRow` sorts on. The ORDER BY is belt and braces — the
      // picking does not depend on it — but it keeps the rows stable for
      // anyone reading a log.
      .select('id, tier_id, config, updated_at, created_at')
      .eq('workspace_id', workspaceId)
      .eq('kind', 'price_logic')
      .order('updated_at', { ascending: false }),
  );
  // NEWEST WINS, and the choice is made in one place for both readers —
  // `find` on an unordered query is what charged soul.com on a five-week-old
  // rule set while six newer ones sat in the same table.
  const config = pickPriceLogicRow(rules, tierId)?.config as PriceLogic | undefined;
  return config ?? null;
}
