'use server';

// Profile settings — writes the PLATFORM profile SPoT (one face per user,
// inherited by every Fibre app): user_profile via /api/v1/profile. Ported
// from The Thread's settings actions; Thread patches its organiser overlay
// (/api/v1/thread/me) on top — Pulse has no app overlay, so this page edits
// the platform values directly.

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

type Result = { ok: true } | { ok: false; error: string };

function formatApiError(e: unknown): string {
  if (!(e instanceof ApiError)) return 'unknown error';
  const body = e.body as { error?: unknown } | undefined;
  const raw = body?.error;
  let detail: string | undefined;
  if (typeof raw === 'string') detail = raw;
  else if (raw && typeof raw === 'object') {
    try {
      detail = JSON.stringify(raw);
    } catch {
      /* ignore */
    }
  }
  return detail ? `API ${e.status}: ${detail}` : `API ${e.status}`;
}

export async function updateMyProfile(patch: {
  display_name: string | null;
  bio: string | null;
  timezone: string;
}): Promise<Result> {
  try {
    await apiFetch('/api/v1/profile', { method: 'PATCH', body: JSON.stringify(patch) });
    revalidatePath('/settings/profile');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: formatApiError(e) };
  }
}
