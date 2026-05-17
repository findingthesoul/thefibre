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
