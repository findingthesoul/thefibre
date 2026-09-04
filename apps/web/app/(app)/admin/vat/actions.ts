'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type VatConfig = {
  home_country: string;
  eu_b2b_reverse_charge: boolean;
  rates: Record<string, number>;
};

export async function saveVat(config: VatConfig): Promise<{ ok?: boolean; error?: string }> {
  try {
    await apiFetch('/api/v1/admin/vat', { method: 'PUT', body: JSON.stringify(config) });
  } catch (e) {
    if (e instanceof ApiError) {
      const detail =
        typeof e.body === 'object' && e.body && 'error' in e.body
          ? JSON.stringify((e.body as { error: unknown }).error).slice(0, 200)
          : '';
      return { error: `API ${e.status}${detail ? `: ${detail}` : ''}` };
    }
    return { error: 'unknown error' };
  }
  revalidatePath('/admin/vat');
  return { ok: true };
}
