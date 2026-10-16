'use server';

// "Email me a link to manage this booking" — for a page opened without the
// booking's manage token (an older email, a forwarded invitation). The API
// sends a fresh link to the address ON FILE and never says which.
import { publicFetch, PublicApiError } from '@/lib/public-api';

export type ManageLinkResult = { ok: true } | { ok: false; rateLimited: boolean; error: string };

export async function requestManageLink(bookingId: string): Promise<ManageLinkResult> {
  try {
    await publicFetch(`/api/v1/meet/public/bookings/${encodeURIComponent(bookingId)}/manage-link`, { method: 'POST' });
    return { ok: true };
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 429) return { ok: false, rateLimited: true, error: 'rate_limited' };
    return { ok: false, rateLimited: false, error: e instanceof PublicApiError ? `API ${e.status}` : 'unknown error' };
  }
}
