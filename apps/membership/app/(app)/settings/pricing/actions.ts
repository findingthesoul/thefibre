'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export async function savePricingRules(config: {
  rules: unknown[];
  default_pct: number;
}): Promise<{ error?: string }> {
  try {
    await apiFetch('/api/v1/membership/pricing-rules', {
      method: 'PUT',
      body: JSON.stringify({ tier_id: null, config }),
    });
    revalidatePath('/settings/pricing');
    return {};
  } catch (e) {
    if (e instanceof ApiError) {
      const body = e.body as { error?: unknown } | undefined;
      return { error: typeof body?.error === 'string' ? body.error : e.message };
    }
    return { error: e instanceof Error ? e.message : 'unknown error' };
  }
}
