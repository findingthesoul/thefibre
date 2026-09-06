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
  archived_at: string | null;
  product_ids: string[];
  optional_product_ids?: string[];
};
