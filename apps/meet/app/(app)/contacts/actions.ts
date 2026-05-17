'use server';

import { apiFetch, ApiError } from '@/lib/api';
import type { BookingForDialog } from '@/components/booking-details-dialog';

// Server action: fetch this contact's bookings via the API so the
// contact popup can render an appointments list without exposing the
// JWT to the client.
export async function listContactBookings(
  email: string,
): Promise<{ items: BookingForDialog[]; error?: string }> {
  const safe = email.trim().toLowerCase();
  if (!safe) return { items: [] };
  try {
    const r = await apiFetch<{ items: BookingForDialog[] }>(
      `/api/v1/meet/bookings?scope=all&include_cancelled=1&invitee_email=${encodeURIComponent(safe)}`,
    );
    return { items: r.items ?? [] };
  } catch (e) {
    return {
      items: [],
      error: e instanceof ApiError ? `API ${e.status}` : 'unknown error',
    };
  }
}
