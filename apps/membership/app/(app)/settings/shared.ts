import { apiFetch, ApiError } from '@/lib/api';

// The membership settings read, shared by the subpages. Admin-only on the
// API (403 for everyone else) — callers render the adminOnly note instead
// of erroring.
export type MembershipSettings = {
  circle_community_url: string | null;
  circle_api_token_set: boolean;
  google_configured: boolean;
  google_admin_email: string | null;
  join_page: Record<string, unknown>;
  /** Public page language (i18n P1) — optional until the API ships it. */
  locale?: string | null;
  // ── member directory (docs/member-directory-spec.md §3.4) ──────────────
  /** The community's own on/off (slice 3). False until an admin turns it on:
   *  a community that never asked for a directory should not acquire one by
   *  being upgraded. Slice 2b replaces this with the 'Community landscape'
   *  product; the column survives as the workspace-level off. */
  directory_enabled?: boolean;
  /** `everybody` = every member sees every member. `category` = a member
   *  sees the members sharing at least one category with them. */
  directory_visibility?: 'everybody' | 'category';
  /** The workspace DEFAULT for showing contact points. Each member can still
   *  turn their own off — the workspace cannot turn a member's back on. */
  directory_show_contact?: boolean;
  /** Whether a member's category NAME is shown beside them. Default false,
   *  and the reason is in the UI next to the switch: a category beside a
   *  member's name tells every other member what that member holds, and a
   *  product has a price. */
  directory_show_category?: boolean;
  /** Which category a product carrying none confers (§9.3). Null = a member
   *  with no category is not listed and sees nobody, in `category` mode. */
  directory_default_category_id?: string | null;
};

/** A workspace's own directory vocabulary. Not a tier: see §9.2. */
export type DirectoryCategory = {
  id: string;
  name: string;
  sort_order: number | null;
  archived_at: string | null;
  created_at: string;
};

export async function loadSettings(): Promise<{
  settings: MembershipSettings | null;
  adminOnly: boolean;
}> {
  try {
    return { settings: await apiFetch<MembershipSettings>('/api/v1/membership/settings'), adminOnly: false };
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) return { settings: null, adminOnly: true };
    throw e;
  }
}
