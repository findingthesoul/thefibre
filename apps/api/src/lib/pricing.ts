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

export type PriceCondition = {
  attr: 'country' | 'interval';
  op: 'in' | 'not_in';
  values: string[];
};

export type PriceRule = {
  when: PriceCondition;
  pct: number; // 1..1000 — percent of the base price
  label?: string; // optional display note ("Purchasing-power adjusted")
};

export type PriceLogic = {
  rules: PriceRule[];
  default_pct: number;
};

export type PriceContext = {
  country?: string | null; // ISO 3166-1 alpha-2, SELF-DECLARED
  interval?: 'year' | 'month';
};

export function evaluatePriceLogic(
  logic: PriceLogic | null | undefined,
  ctx: PriceContext,
): { pct: number; matched: PriceRule | null } {
  if (!logic) return { pct: 100, matched: null };
  for (const rule of logic.rules ?? []) {
    const w = rule.when;
    if (!w || !Array.isArray(w.values)) continue;
    const actual =
      w.attr === 'country'
        ? (ctx.country ?? '').toUpperCase()
        : w.attr === 'interval'
          ? (ctx.interval ?? '')
          : '';
    if (!actual) continue; // unknown context never matches — no accidental discounts
    const values = w.values.map((v) => v.toUpperCase());
    const inSet = values.includes(actual.toUpperCase());
    if ((w.op === 'in' && inSet) || (w.op === 'not_in' && !inSet)) {
      return { pct: clampPct(rule.pct), matched: rule };
    }
  }
  return { pct: clampPct(logic.default_pct ?? 100), matched: null };
}

function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 100;
  return Math.min(1000, Math.max(1, Math.round(pct)));
}

/** Tier-specific logic wins over the workspace-wide one. */
export async function priceLogicFor(
  workspaceId: string,
  tierId: string | null,
): Promise<PriceLogic | null> {
  const { data } = await adminClient
    .from('membership_pricing_rule')
    .select('tier_id, config')
    .eq('workspace_id', workspaceId)
    .eq('kind', 'price_logic');
  const rows = data ?? [];
  const specific = tierId ? rows.find((r) => r.tier_id === tierId) : null;
  const general = rows.find((r) => r.tier_id === null);
  const config = (specific ?? general)?.config as PriceLogic | undefined;
  return config ?? null;
}

/** Apply a pct to integer cents; round to the nearest cent. */
export function applyPct(amountCents: number, pct: number): number {
  return Math.max(0, Math.round((amountCents * clampPct(pct)) / 100));
}
