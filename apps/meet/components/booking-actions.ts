'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ApproveResult = { ok?: boolean; error?: string };

function formatError(e: unknown): string {
  if (!(e instanceof ApiError)) return 'unknown error';
  const body = e.body as { error?: unknown } | undefined;
  const raw = body?.error;
  if (typeof raw === 'string') return `API ${e.status}: ${raw}`;
  return `API ${e.status}`;
}

export async function approveBooking(id: string): Promise<ApproveResult> {
  try {
    await apiFetch(`/api/v1/meet/bookings/${id}/approve`, { method: 'POST' });
  } catch (e) {
    return { error: formatError(e) };
  }
  revalidatePath('/bookings');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function rejectBooking(
  id: string,
  reason?: string,
): Promise<ApproveResult> {
  try {
    await apiFetch(`/api/v1/meet/bookings/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  } catch (e) {
    return { error: formatError(e) };
  }
  revalidatePath('/bookings');
  revalidatePath('/dashboard');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// The payment behind a booking. Meet does NOT keep its own refund path: the
// purchase ledger is the record and POST /purchases/:id/refund is the single
// implementation (it reverses the Stripe charge, returns the platform fee and
// flips meet_booking.payment_status). This is just the lookup + the call.
// ---------------------------------------------------------------------------

export type BookingPurchase = {
  id: string;
  payer_name: string;
  payer_email: string | null;
  amount_cents: number;
  currency: string;
  method: 'stripe' | 'invoice' | 'free';
  status: 'pending' | 'paid' | 'refunded' | 'failed';
  refunded_at: string | null;
};

export async function loadBookingPurchase(
  bookingId: string,
): Promise<{ purchase?: BookingPurchase | null; error?: string }> {
  try {
    const r = await apiFetch<{ purchase: BookingPurchase | null }>(
      `/api/v1/purchases/by-ref?app=fibre-meet&item_ref=${encodeURIComponent(bookingId)}`,
    );
    return { purchase: r.purchase };
  } catch (e) {
    return { error: formatError(e) };
  }
}

export async function refundBookingPurchase(
  purchaseId: string,
): Promise<ApproveResult> {
  try {
    await apiFetch(`/api/v1/purchases/${purchaseId}/refund`, { method: 'POST' });
  } catch (e) {
    return { error: formatError(e) };
  }
  revalidatePath('/bookings');
  revalidatePath('/invoices');
  revalidatePath('/dashboard');
  return { ok: true };
}
