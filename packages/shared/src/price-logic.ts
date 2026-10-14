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

/** Apply a pct to integer cents, rounded to the nearest cent. */
export function applyPct(amountCents: number, pct: number): number {
  return Math.max(0, Math.round((amountCents * clampPct(pct)) / 100));
}
