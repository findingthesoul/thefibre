'use server';

import { apiFetch, ApiError } from '@/lib/api';

export async function saveCurrencies(input: {
  default_currency: string;
  currencies: string[];
}): Promise<{ error?: string }> {
  try {
    await apiFetch('/api/v1/workspace', { method: 'PATCH', body: JSON.stringify(input) });
    return {};
  } catch (e) {
    if (e instanceof ApiError) {
      const body = e.body as { error?: unknown } | undefined;
      return { error: typeof body?.error === 'string' ? body.error : e.message };
    }
    return { error: e instanceof Error ? e.message : 'unknown error' };
  }
}
