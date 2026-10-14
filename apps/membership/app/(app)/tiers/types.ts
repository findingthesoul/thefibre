// Local shapes for the tiers surface (GET /api/v1/membership/tiers).

export type Tier = {
  id: string;
  name: string;
  description: string | null;
  characteristics: string[] | null;
  price_cents_year: number | null;
  price_cents_month: number | null;
  currency: string;
  sort_order: number | null;
  /** The launch cohort's one date (2026-10-13): while it is in the future, a
   *  join pays the whole period now and renews the day after. Null is the
   *  normal case — renewal on the anniversary of joining. */
  first_period_ends_on?: string | null;
  archived_at: string | null;
  /** Not listed on the public join page (2026-10-14). Still joinable by its
   *  direct link, and existing members are unaffected — which is what makes
   *  it different from `archived_at`. */
  hidden?: boolean;
  product_ids: string[];
  optional_product_ids?: string[];
};
