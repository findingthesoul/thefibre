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
