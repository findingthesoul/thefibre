'use server';

import { publicFetch, PublicApiError } from '@/lib/public-api';

export type CancelResult = { ok?: boolean; error?: string };

export async function cancelBooking(bookingId: string): Promise<CancelResult> {
  try {
    await publicFetch(`/api/v1/meet/public/bookings/${encodeURIComponent(bookingId)}/cancel`, {
      method: 'POST',
    });
    return { ok: true };
  } catch (e) {
    return {
      error: e instanceof PublicApiError ? `API ${e.status}` : 'unknown error',
    };
  }
}
