// What a membership costs in one country, at one interval — decided once.
//
// WHY THIS IS SHARED. The arithmetic existed twice: the API's `lib/pricing.ts`
// evaluated the rules and clamped the result, and the join panel's
// `previewPct` / `adjust` did it again so it could show a price before asking
// for money. Two implementations of one price, and they disagreed:
//
//   a rule of 12.5%  →  the panel showed 12.5, the server charged 13
//   a rule of 0%     →  the panel showed free, the server charged 1%
//
// Nobody had hit it because every rule so far has been a whole number between
// 1 and 100. That is not a reason to keep two copies of a number somebody is
// charged. "The offer and the enforcement share code" — the panel is the
// offer, the API is the enforcement, and this is the code.
//
// Pure, no I/O: the API reads the rules from the database and passes them in,
// the panel gets them from the public catalogue. Which rules apply to whom is
// still the API's business; what they MEAN is here.

// DELIBERATELY PERMISSIVE on `attr` and `op`. This logic is stored as JSON in
// `membership_pricing_rule.config` and arrives again through the public
// catalogue, so it is untrusted input, not a validated enum — narrowing the
// type here would only move the lie from the data to the compiler. The
// evaluator checks both at runtime instead: an unrecognised `attr` yields no
// context and therefore never matches, and an `op` that is neither 'in' nor
// 'not_in' simply does not fire. A rule nobody can read is a rule that does
// not discount.
export type PriceCondition = {
  /** 'country' or 'interval' today; anything else never matches. */
  attr: string;
  /** 'in' or 'not_in'; anything else never matches. */
  op: string;
  values: string[];
};

export type PriceRule = {
  when: PriceCondition;
  pct: number;
};

export type PriceLogic = {
  rules?: PriceRule[];
  default_pct?: number;
};

export type PriceContext = {
  country?: string | null;
  interval?: 'year' | 'month' | string | null;
};

/** The percentage actually charged, with the bounds the charge applies.
 *
 *  1 is the floor rather than 0: a priced tier must not resolve to nothing by
 *  way of a pricing rule — a free tier is a tier with no price, which is a
 *  different thing an admin says deliberately. 1000 is the ceiling, so a
 *  typo'd 10000 cannot charge a hundred times the price. Rounded, because a
 *  percentage of a cent is not a thing anybody can pay. */
export function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 100;
  return Math.min(1000, Math.max(1, Math.round(pct)));
}

/** The first rule whose condition matches, else the default. Always clamped,
 *  so a caller cannot show one number and charge another. */
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
        ? (ctx.country ?? '')
        : w.attr === 'interval'
          ? (ctx.interval ?? '')
          : '';
    // An unknown context never matches, so a missing country cannot win
    // somebody an accidental discount.
    if (!actual) continue;
    const values = w.values.map((v) => v.toUpperCase());
    const inSet = values.includes(String(actual).toUpperCase());
    if ((w.op === 'in' && inSet) || (w.op === 'not_in' && !inSet)) {
      return { pct: clampPct(rule.pct), matched: rule };
    }
  }
  return { pct: clampPct(logic.default_pct ?? 100), matched: null };
}

// ---------------------------------------------------------------------------
// WHICH stored rule set applies. (Found on production 2026-10-14.)
//
// `membership_pricing_rule` is unique on (workspace_id, kind, tier_id), and
// Postgres treats NULLs as DISTINCT in a unique index — so a GENERAL rule,
// whose tier_id is null, never conflicts, and the route's upsert inserted a
// new row on every save. soul.com accumulated six, and both readers did
// `rows.find(r => r.tier_id === null)` on a query with no ORDER BY. The row
// that decided what people were CHARGED was five weeks old: Chile and El
// Salvador were being charged 100% where the admin had configured 75%.
//
// Adding an ORDER BY to each query would have fixed the symptom and left the
// real fault in place, which is that nobody had SAID which row wins. This
// says it, once, as a pure function both readers call — so the answer no
// longer depends on what a query happens to return, and a third reader
// cannot get it wrong a third way.
// ---------------------------------------------------------------------------

/** A stored rule row, as little of it as the choice needs. */
export type PriceLogicRow = {
  tier_id: string | null;
  config?: unknown;
  /** Moved by every write. Null-safe: a row with none sorts oldest. */
  updated_at?: string | null;
  /** The database's own default, so it is right even if a writer forgets
   *  `updated_at` — which is how this became a charging bug rather than a
   *  display one. */
  created_at?: string | null;
  id?: string | null;
};

/** Newest first: updated_at, then created_at, then id.
 *
 *  Three keys because the two eras of this table need different ones. While
 *  every save INSERTS, `created_at` is the save time and is set by the
 *  database. Once the unique constraint is fixed and saves UPDATE, only
 *  `updated_at` moves. `id` breaks the remaining tie so the order is TOTAL —
 *  an order that is merely good enough is what produced the bug. */
function newestFirst(a: PriceLogicRow, b: PriceLogicRow): number {
  return (
    (b.updated_at ?? '').localeCompare(a.updated_at ?? '') ||
    (b.created_at ?? '').localeCompare(a.created_at ?? '') ||
    (b.id ?? '').localeCompare(a.id ?? '')
  );
}

/**
 * The rule row that applies to this tier, or null.
 *
 * A tier-specific row wins over the workspace-wide one — unchanged, and the
 * reason this is not simply "the newest row": a general rule saved this
 * morning must not override a tier's own rule from last month.
 *
 * Within each kind, the newest wins. Duplicates are a bug being fixed
 * separately, and until the data is cleaned up this is what makes the most
 * recent save the one that takes effect.
 */
export function pickPriceLogicRow<T extends PriceLogicRow>(
  rows: T[],
  tierId: string | null,
): T | null {
  const specific = tierId ? rows.filter((r) => r.tier_id === tierId).sort(newestFirst)[0] : undefined;
  if (specific) return specific;
  return rows.filter((r) => r.tier_id === null).sort(newestFirst)[0] ?? null;
}

/** Apply a pct to integer cents, rounded to the nearest cent. */
export function applyPct(amountCents: number, pct: number): number {
  return Math.max(0, Math.round((amountCents * clampPct(pct)) / 100));
}
