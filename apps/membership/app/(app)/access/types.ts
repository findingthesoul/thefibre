// Local shapes for the access surface (GET /api/v1/membership/grants).

export const GRANT_KINDS = ['circle', 'thread', 'fibre_seat', 'google_user'] as const;
export type GrantKind = (typeof GRANT_KINDS)[number];

// Grant-kind display labels moved into lib/i18n-ui.ts (grant_kind_* keys) —
// UI renders them per locale, so no English map lives here any more.

export type Grant = {
  id: string;
  tier_id: string | null;
  product_id: string | null;
  kind: GrantKind;
  // Non-secret targeting only: {space_id} for circle, {thread_slug} for thread.
  config: Record<string, unknown>;
  created_at: string;
  // embeds can come back as object OR single-element array from PostgREST.
  tier: { name: string } | { name: string }[] | null;
  product: { name: string } | { name: string }[] | null;
};

// `unknown` lets callers pass a translated fallback (i18n P3).
export function grantTierName(t: Grant['tier'], unknown = 'Unknown tier'): string {
  const one = Array.isArray(t) ? t[0] : t;
  return one?.name ?? unknown;
}
