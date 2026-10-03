// Local shapes for the products surface (GET /api/v1/membership/products).

// LINK_KINDS is the ONE list the API validates against (@thefibre/shared/link-kinds);
// re-exported so the dialog keeps its import path.
export { LINK_KINDS, type LinkKind } from '@thefibre/shared/link-kinds';
import type { LinkKind } from '@thefibre/shared/link-kinds';

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
  price_interval?: 'once' | 'week' | 'month' | 'year' | null;
  currency: string;
  /** À-la-carte (2026-09-06): can be bought standalone on the public page. */
  purchasable: boolean;
  links: ProductLink[] | null;
  sort_order: number | null;
  archived_at: string | null;
};

/** A product->category link for the member directory (slice 1). No
 *  workspace_id: it is the product's, and two places able to disagree about
 *  which workspace a link belongs to is worse than one join. */
export type ProductCategoryLink = { product_id: string; category_id: string };
