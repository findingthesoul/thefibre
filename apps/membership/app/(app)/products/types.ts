// Local shapes for the products surface (GET /api/v1/membership/products).

export const LINK_KINDS = ['thread', 'meet', 'circle_space', 'url'] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

// Link-kind display labels moved into lib/i18n-ui.ts (link_kind_* keys) —
// UI renders them per locale, so no English map lives here any more.

export type ProductLink = {
  kind: LinkKind;
  ref: string;
  label?: string;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  characteristics: string[] | null;
  price_cents: number | null;
  currency: string;
  /** À-la-carte (2026-09-06): can be bought standalone on the public page. */
  purchasable: boolean;
  links: ProductLink[] | null;
  sort_order: number | null;
  archived_at: string | null;
};
