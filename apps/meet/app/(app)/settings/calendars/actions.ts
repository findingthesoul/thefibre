'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export async function setCalendarRole(
  id: string,
  role: 'primary' | 'conflict_check' | 'write_target' | 'ignore',
): Promise<{ ok?: boolean; error?: string }> {
  try {
    await apiFetch(`/api/v1/meet/calendars/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
  revalidatePath('/settings/calendars');
  return { ok: true };
}

export async function resyncCalendars(): Promise<{
  ok?: boolean;
  error?: string;
  found?: number;
  added?: number;
}> {
  try {
    const r = await apiFetch<{ found: number; added: number }>(
      '/api/v1/meet/calendars/sync',
      { method: 'POST' },
    );
    revalidatePath('/settings/calendars');
    return { ok: true, found: r.found, added: r.added };
  } catch (e) {
    return { error: e instanceof ApiError ? `API ${e.status}` : 'unknown error' };
  }
}
