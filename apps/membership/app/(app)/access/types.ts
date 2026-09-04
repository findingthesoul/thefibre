// Local shapes for the access surface (GET /api/v1/membership/grants).

export const GRANT_KINDS = ['circle', 'thread'] as const;
export type GrantKind = (typeof GRANT_KINDS)[number];

export const GRANT_KIND_LABELS: Record<GrantKind, string> = {
  circle: 'Circle space',
  thread: 'Thread',
};

export type Grant = {
  id: string;
  tier_id: string;
  kind: GrantKind;
  // Non-secret targeting only: {space_id} for circle, {thread_slug} for thread.
  config: Record<string, unknown>;
  created_at: string;
  // tier embeds can come back as object OR single-element array from PostgREST.
  tier: { name: string } | { name: string }[] | null;
};

export function grantTierName(t: Grant['tier']): string {
  const one = Array.isArray(t) ? t[0] : t;
  return one?.name ?? 'Unknown tier';
}
