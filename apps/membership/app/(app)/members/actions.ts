'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';
import type { Member, MemberAccess, MemberPerson, MemberStatus } from './types';

export type ActionResult<T = unknown> = { ok?: boolean; error?: string; data?: T };

function formatApiError(e: unknown): string {
  if (!(e instanceof ApiError)) return 'unknown error';
  const body = e.body as { error?: unknown; details?: unknown; code?: string } | undefined;
  const raw = body?.error ?? body?.details ?? body?.code;
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

export async function createMember(input: {
  person_id: string;
  tier_id: string;
  renews_at: string | null; // full ISO datetime or null
}): Promise<ActionResult<{ id: string }>> {
  try {
    const r = await apiFetch<{ id: string }>('/api/v1/membership/members', {
      method: 'POST',
      body: JSON.stringify({
        person_id: input.person_id,
        tier_id: input.tier_id,
        ...(input.renews_at ? { renews_at: input.renews_at } : {}),
      }),
    });
    revalidatePath('/members');
    return { ok: true, data: { id: r.id } };
  } catch (e) {
    // 409 = already a member — the API's message is already user-facing.
    if (e instanceof ApiError && e.status === 409) {
      const body = e.body as { error?: string } | undefined;
      return { error: body?.error ?? 'This person already has a membership.' };
    }
    return { error: formatApiError(e) };
  }
}

export async function patchMember(
  id: string,
  patch: {
    tier_id?: string;
    status?: MemberStatus;
    renews_at?: string | null; // full ISO datetime or null
    notes?: string | null;
  },
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/membership/members/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    revalidatePath('/members');
    return { ok: true };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// The access journal loads lazily when a member dialog opens.
export async function getMemberAccess(id: string): Promise<ActionResult<{ access: MemberAccess[] }>> {
  try {
    const r = await apiFetch<Member & { access: MemberAccess[] }>(`/api/v1/membership/members/${id}`);
    return { ok: true, data: { access: r.access ?? [] } };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// Person picker search — runs server-side because apiFetch needs the session.
export async function searchPersons(q: string): Promise<ActionResult<{ items: MemberPerson[] }>> {
  try {
    const r = await apiFetch<{ items: MemberPerson[] }>(
      `/api/v1/persons?q=${encodeURIComponent(q)}&limit=8`,
    );
    return { ok: true, data: { items: r.items ?? [] } };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}

// Manual add needs a door for people who aren't contacts yet (the
// "Peter Test member" case — typing a new name dead-ended on "pick a
// person first"). POST /persons is the platform's contact-creation door.
export async function createPerson(input: {
  first_name: string;
  last_name: string;
  email: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const r = await apiFetch<{ id: string }>('/api/v1/persons', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return { ok: true, data: { id: r.id } };
  } catch (e) {
    return { error: formatApiError(e) };
  }
}
