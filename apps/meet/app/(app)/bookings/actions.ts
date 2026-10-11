'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type NewBookingResult = { id?: string; payment_url?: string | null; error?: string };

/** Add an appointment yourself. The API decides what the payment choice
 *  means — and ignores it entirely for a free meeting type. */
export async function createHostBooking(input: {
  meeting_type_id: string;
  invitee_name: string;
  invitee_email: string;
  starts_at: string;
  payment?: 'link' | 'invoice' | 'comp';
  notify?: boolean;
}): Promise<NewBookingResult> {
  try {
    const r = await apiFetch<{ booking: { id: string }; payment_url?: string | null }>(
      '/api/v1/meet/bookings',
      { method: 'POST', body: JSON.stringify(input) },
    );
    revalidatePath('/bookings');
    revalidatePath('/dashboard');
    return { id: r.booking.id, payment_url: r.payment_url ?? null };
  } catch (e) {
    if (e instanceof ApiError) {
      const d = (e as unknown as { data?: { error?: unknown } }).data;
      const msg = typeof d?.error === 'string' ? d.error : `API ${e.status}`;
      return { error: msg };
    }
    return { error: 'unknown error' };
  }
}

/**
 * How many seats this slot has left, from the API.
 *
 * The New-booking dialog shows it and caps the picker with it. Deliberately
 * the API's number rather than one the client works out: the booking route
 * enforces with `slotSeats()`, and a second calculation here would be the
 * same rule written twice, free to drift. Returns null when the lookup fails,
 * and the form then stops capping rather than inventing a limit.
 */
export async function slotSeats(
  meetingTypeId: string,
  startsAt: string,
): Promise<{ capacity: number; taken: number; left: number } | null> {
  try {
    return await apiFetch<{ capacity: number; taken: number; left: number }>(
      `/api/v1/meet/slot-seats?meeting_type_id=${encodeURIComponent(meetingTypeId)}&starts_at=${encodeURIComponent(startsAt)}`,
    );
  } catch {
    return null;
  }
}
