'use server';

// Server actions for thread templates (the /templates/threads lane).
// Same ActionResult idiom as (app)/threads/actions.ts — kept separate on
// purpose: this folder owns the template UI end-to-end.

import { revalidatePath } from 'next/cache';
import { apiFetch, errorMessage } from '@/lib/api';
import type { EngagementType } from '@/lib/thread-types';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export type TemplateScope = 'personal' | 'team' | 'workspace';

// One engagement inside structure.engagements — relative timing, no ids.
// The API captures more fields than we edit (triggers, location, content…);
// the editor spreads each original block so untouched fields survive a save.
export type TemplateEngagement = {
  type: EngagementType;
  title: string;
  description: string | null;
  position: number;
  day_offset: number | null;
  time_of_day: string | null;
  duration_minutes: number | null;
} & Record<string, unknown>;

export type ThreadTemplateStructure = {
  version?: number;
  format?: 'event' | 'journey';
  intention?: string | null;
  duration_days?: number | null;
  engagements?: TemplateEngagement[];
} & Record<string, unknown>;

export type ThreadTemplate = {
  id: string;
  title: string;
  scope: TemplateScope;
  owner_team_id: string | null;
  structure: ThreadTemplateStructure;
  created_at: string;
  updated_at: string;
};

export async function saveThreadAsTemplate(
  threadId: string,
  title: string,
): Promise<ActionResult> {
  try {
    const created = await apiFetch<{ id: string }>(
      `/api/v1/thread/threads/${threadId}/save-as-template`,
      { method: 'POST', body: JSON.stringify({ title, scope: 'personal' }) },
    );
    revalidatePath('/templates/threads');
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function updateThreadTemplate(
  id: string,
  patch: {
    title: string;
    scope: TemplateScope;
    owner_team_id: string | null;
    structure: ThreadTemplateStructure;
  },
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/thread-templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    revalidatePath('/templates/threads');
    revalidatePath(`/templates/threads/${id}`);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteThreadTemplate(id: string): Promise<ActionResult> {
  try {
    await apiFetch(`/api/v1/thread/thread-templates/${id}`, { method: 'DELETE' });
    revalidatePath('/templates/threads');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function instantiateTemplate(
  id: string,
  input: { title: string; slug: string; starts_on: string | null },
): Promise<ActionResult> {
  try {
    const created = await apiFetch<{ id: string }>(
      `/api/v1/thread/thread-templates/${id}/instantiate`,
      { method: 'POST', body: JSON.stringify(input) },
    );
    revalidatePath('/threads');
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
