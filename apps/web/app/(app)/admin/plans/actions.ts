'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type SaveResult = { ok?: boolean; error?: string };

export type PlanPatch = {
  name?: string;
  price_cents_month?: number;
  price_cents_year?: number | null;
  included_seats?: number | null;
  extra_seat_cents_month?: number | null;
  included_emails_month?: number | null;
  included_storage_gb?: number | null;
  email_overage_cents_per_1000?: number | null;
  storage_overage_cents_per_gb?: number | null;
  retention_months?: number | null;
  meet_paid_pct?: number;
  meet_paid_cap_cents?: number | null;
  features?: Record<string, boolean | number | null>;
};

export async function savePlan(id: string, patch: PlanPatch): Promise<SaveResult> {
  try {
    await apiFetch(`/api/v1/admin/plans/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  } catch (e) {
    if (e instanceof ApiError) {
      const detail = typeof e.body === 'object' && e.body && 'error' in e.body ? JSON.stringify((e.body as { error: unknown }).error) : '';
      return { error: `API ${e.status}${detail ? `: ${detail.slice(0, 200)}` : ''}` };
    }
    return { error: 'unknown error' };
  }
  revalidatePath('/admin/plans');
  revalidatePath('/settings/plan');
  return { ok: true };
}
