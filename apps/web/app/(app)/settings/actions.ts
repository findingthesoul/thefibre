'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type ActionResult = {
  ok?: boolean;
  error?: string | undefined;
  fieldErrors?: Record<string, string[]> | undefined;
};

function unwrap(e: unknown): ActionResult {
  if (e instanceof ApiError) {
    const apiBody = e.body as { error?: { fieldErrors?: Record<string, string[]> } } | undefined;
    return { error: `API ${e.status}`, fieldErrors: apiBody?.error?.fieldErrors };
  }
  return { error: 'Unknown error' };
}

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}


/**
 * One profile, saved in one call from the caller's point of view.
 *
 * Two writes underneath, and the second is the point: `user_profile` is the
 * face every app inherits, while `user.full_name` and `user.avatar_url` are
 * what the sidebar, the member list and the invite emails read. Left apart
 * they drift, and you get the thing Sjoerd noticed — two profile screens
 * disagreeing about who you are.
 *
 * The profile is authoritative; the user row is kept in step with it.
 */
export async function saveProfile(patch: {
  display_name: string | null;
  bio: string | null;
  photo_url: string | null;
  timezone: string | null;
}): Promise<ActionResult> {
  try {
    await apiFetch('/api/v1/profile', { method: 'PATCH', body: JSON.stringify(patch) });
    if (patch.display_name) {
      await apiFetch('/api/v1/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ full_name: patch.display_name, avatar_url: patch.photo_url }),
      });
    }
  } catch (e) {
    return unwrap(e);
  }
  revalidatePath('/settings/profile');
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { ok: true };
}

/** The workspace itself — name, logo, invoices, the sender of its email. */
export async function saveWorkspace(patch: Record<string, unknown>): Promise<ActionResult> {
  try {
    await apiFetch('/api/v1/workspace', { method: 'PATCH', body: JSON.stringify(patch) });
  } catch (e) {
    if (e instanceof ApiError) {
      const body = e.body as { error?: string } | undefined;
      return { error: typeof body?.error === 'string' ? body.error : `API ${e.status}` };
    }
    return unwrap(e);
  }
  revalidatePath('/settings/workspace');
  revalidatePath('/settings');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Members — the platform is the single point of truth for workspace
// membership + per-app grants. Meet/Thread link here; they don't edit it.
// ---------------------------------------------------------------------------

export type MemberPatch = {
  workspace_role?: 'super_admin' | 'admin' | 'organiser' | undefined;
  relationship_type?: 'internal' | 'external' | undefined;
  /** REPLACES the member's app-grant set. */
  apps?: { slug: string; role: 'member' | 'admin' }[] | string[] | undefined;
};

export async function updateMember(
  userId: string,
  patch: MemberPatch,
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/members/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  } catch (e) {
    return unwrap(e);
  }
  revalidatePath('/settings/members');
  return { ok: true };
}

export type InviteInput = {
  email: string;
  name?: string | undefined;
  workspace_role?: 'super_admin' | 'admin' | 'organiser' | undefined;
  relationship_type?: 'internal' | 'external' | undefined;
  apps: ({ slug: string; role: 'member' | 'admin' } | string)[];
};

export type InviteResult = ActionResult & { invited?: boolean | undefined };

export async function inviteMember(input: InviteInput): Promise<InviteResult> {
  const email = input.email.trim();
  if (!email) return { error: 'Email is required.' };

  try {
    const res = await apiFetch<{ ok: boolean; user_id: string; invited: boolean }>(
      '/api/v1/members',
      {
        method: 'POST',
        body: JSON.stringify({ ...input, email }),
      },
    );
    revalidatePath('/settings/members');
    return { ok: true, invited: res.invited };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      return { error: 'This email already belongs to another workspace.' };
    }
    return unwrap(e);
  }
}

// ---------------------------------------------------------------------------
// Public profile — display name / bio / photo / timezone, shared across the
// Fibre apps (Meet and Thread inherit these).
// ---------------------------------------------------------------------------

