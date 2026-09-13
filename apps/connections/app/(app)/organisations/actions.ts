'use server';

// An organisation, and who belongs to it.
//
// Sjoerd, 2026-09-13: *"It would be great of I could also open an
// organisation, and connect a person too it (in the popup)"*.
//
// Nothing new on the API: `/organisations/:id`, `/organisations/:id/members`
// and the POST that adds one have existed since the platform's early days.
// This module is the thin server-action layer the popup calls, in the same
// shape as people/[id]/load.ts — never throws, returns a tagged result, so a
// popup can render an error instead of hanging.
//
// ── Why a membership and not a tag ─────────────────────────────────────────
//
// Connections treats organisations as tags when it DETECTS them in a note
// (v0.73.10, lib/detect-tags.ts): a word in a sentence is a hint, and a hint
// must not become a fact. This is the other path — somebody deliberately
// saying "this person works here" — and it writes the real thing:
// `org_membership`, the platform's own record, which the map, the landscape
// and every other app read. Handbook §12: attach a person by their
// identifier, never by a name in prose. The picker here hands over a person
// id chosen from a list, never a typed string.

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api';

export type OrgCard = { id: string; name: string };

export type OrgMember = {
  /** The membership row, which is what ending it later needs. */
  id: string;
  title: string | null;
  is_primary: boolean;
  person: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
};

export type LoadOrgResult =
  | { ok: true; organisation: OrgCard; members: OrgMember[] }
  | { ok: false; error: string };

/**
 * The organisation and its current members.
 *
 * Two reads rather than one, because they fail independently: an org whose
 * member list 404s should still open and show its name, since the popup's
 * other job — connecting somebody — does not need the list to work.
 */
export async function loadOrg(id: string): Promise<LoadOrgResult> {
  try {
    const [org, members] = await Promise.all([
      apiFetch<OrgCard>(`/api/v1/organisations/${id}`),
      apiFetch<{ items: OrgMember[] }>(`/api/v1/organisations/${id}/members`)
        .then((r) => r.items ?? [])
        .catch(() => [] as OrgMember[]),
    ]);
    return { ok: true, organisation: { id: org.id, name: org.name }, members };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: `API ${e.status}` };
    return { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
  }
}

export type ConnectResult = { ok: true } | { ok: false; error: string };

/**
 * Record that a person belongs to this organisation.
 *
 * `title` is optional and free text — it is what the person does there, and
 * the platform stores it on the membership rather than on either side, which
 * is why the same person can hold two different titles at two organisations.
 *
 * The map is revalidated because an organisation is drawn as a boxed node
 * joined to its people, and a new membership changes that drawing. So is the
 * person's page, where "where they work" is read.
 */
export async function connectPerson(
  orgId: string,
  personId: string,
  title?: string,
): Promise<ConnectResult> {
  try {
    await apiFetch(`/api/v1/organisations/${orgId}/members`, {
      method: 'POST',
      body: JSON.stringify({
        person_id: personId,
        ...(title && title.trim() ? { title: title.trim() } : {}),
      }),
    });
    revalidatePath('/map');
    revalidatePath(`/people/${personId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 403) return { ok: false, error: 'forbidden' };
      const body = e.body as { error?: unknown } | undefined;
      return { ok: false, error: typeof body?.error === 'string' ? body.error : `API ${e.status}` };
    }
    return { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
  }
}
