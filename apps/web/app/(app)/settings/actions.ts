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

export async function updateMe(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const full_name = strOrNull(formData.get('full_name'));
  const avatar_url = strOrNull(formData.get('avatar_url'));
  if (!full_name) return { error: 'Name is required.' };

  try {
    await apiFetch('/api/v1/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ full_name, avatar_url }),
    });
  } catch (e) {
    return unwrap(e);
  }

  revalidatePath('/settings');
  revalidatePath('/dashboard');
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
  apps?: string[] | undefined;
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
  apps: string[];
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

export async function updateProfile(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const patch = {
    display_name: strOrNull(formData.get('display_name')),
    bio: strOrNull(formData.get('bio')),
    photo_url: strOrNull(formData.get('photo_url')),
    timezone: strOrNull(formData.get('timezone')),
  };

  try {
    await apiFetch('/api/v1/profile', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  } catch (e) {
    return unwrap(e);
  }

  revalidatePath('/settings');
  return { ok: true };
}
