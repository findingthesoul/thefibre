import { apiFetch, ApiError } from '@/lib/api';

// The membership settings read, shared by the subpages. Admin-only on the
// API (403 for everyone else) — callers render the adminOnly note instead
// of erroring.
export type MembershipSettings = {
  circle_community_url: string | null;
  circle_api_token_set: boolean;
  join_page: Record<string, unknown>;
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
