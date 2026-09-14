'use server';

// The one write path the composer has.
//
// It is deliberately thin: the client owns the autosave key (`client_ref`,
// minted once per note) and the draft flag, and the API upserts on that key,
// so a retry, a double-submit and the next keystroke all land on the same
// row. Nothing here retries or reorders — the composer knows which write is
// the latest, this does not.
//
// Everything in a 'use server' module must be an async function, so the kind
// vocabulary lives in the composer next to its chips; only the types cross
// (types are erased).

import { apiFetch, ApiError } from '@/lib/api';

/**
 * What kind of contact this was. Mirrors the API's KINDS.
 *
 * `encounter` — you ran into them — added 2026-09-13 on Sjoerd's ask. The
 * column has no CHECK by design, so a new kind is a deploy and not a
 * migration; the two lists still have to be changed together.
 */
export type NoteKind = 'note' | 'call' | 'meeting' | 'encounter' | 'message' | 'email';

export type SaveNoteInput = {
  /** Minted once per note by the client. Same value on every write. */
  client_ref: string;
  person_id: string;
  /** The team this is filed under, or null for none. Organising only. */
  team_id?: string | null;
  body: string;
  kind: NoteKind;
  /** ISO 8601 with offset. Omitted means "now", decided by the API. */
  happened_at?: string;
  /** IANA zone of wherever this was typed. */
  happened_tz?: string;
  /** null is a real answer — "nothing planned" — and is never a blocker. */
  follow_up_at?: string | null;
  /** Title of the task the follow-up becomes ("Call", "Get in touch"). */
  follow_up_title?: string;
  /** True while the composer is open; false commits it. */
  is_draft: boolean;
  /**
   * Tags the composer is showing, minus any the person removed. Sent rather
   * than re-detected server-side: detection runs once, in the box, and what
   * was on screen is what gets written.
   */
  tags?: { name: string; organisation_id?: string }[];
  /** People named with @ inside the note. Ids, resolved in the composer. */
  mentions?: string[];
};

export type SaveNoteResult =
  | { ok: true; id: string; committed: boolean }
  | { ok: false; error: string };

export async function saveNote(input: SaveNoteInput): Promise<SaveNoteResult> {
  try {
    const r = await apiFetch<{ id: string; committed: boolean }>('/api/v1/notes', {
      method: 'PUT',
      body: JSON.stringify({ ...input, origin: 'manual' }),
    });
    return { ok: true, id: r.id, committed: r.committed };
  } catch (e) {
    if (e instanceof ApiError) {
      const body = e.body as { error?: unknown } | undefined;
      const detail = typeof body?.error === 'string' ? body.error : `API ${e.status}`;
      return { ok: false, error: detail };
    }
    return { ok: false, error: 'could not save' };
  }
}

export type EditNoteInput = {
  /** The key the note was written under. PUT upserts on it. */
  client_ref: string;
  person_id: string;
  /**
   * Sent back unchanged. PUT overwrites the whole row, so an edit that left
   * this out would quietly take the note out of its team — and out of that
   * team's update meeting — just for fixing a typo.
   */
  team_id: string | null;
  body: string;
  kind: NoteKind;
  /** Kept as it was — an edit fixes the words, not when it happened. */
  happened_at: string;
  happened_tz?: string | null;
  follow_up_at?: string | null;
};

/**
 * Change what a note says.
 *
 * Sjoerd, 2026-09-13, looking at a note in the popup: *"How can I see the note
 * from before? Clicking on it? Can I edit it?"*
 *
 * Through the same PUT every write goes through, with `is_draft: false` so the
 * note stays committed. What that means, stated because it is a real
 * limitation and not an oversight:
 *
 *   The derived effects — the follow-up task, the tags, the activity row —
 *   fire ONCE, on the transition from draft to committed. An edit is not that
 *   transition, so none of them run again. Tags already attached to the person
 *   STAY attached, and words newly typed do NOT become tags.
 *
 * That is the right way round. A tag on a person is a recorded fact; silently
 * removing it because somebody fixed a typo in the sentence it came from would
 * be a write nobody asked for. The cost is that an edit cannot add a tag
 * either, and the interface says so rather than letting somebody type
 * `#retreat` into an old note and wonder why nothing happened.
 *
 * `happened_at` is sent back unchanged. PUT overwrites the whole row, so
 * omitting it would silently move the conversation to now.
 */
export async function editNote(input: EditNoteInput): Promise<SaveNoteResult> {
  try {
    const r = await apiFetch<{ id: string; committed: boolean }>('/api/v1/notes', {
      method: 'PUT',
      body: JSON.stringify({
        ...input,
        happened_tz: input.happened_tz ?? null,
        follow_up_at: input.follow_up_at ?? null,
        origin: 'manual',
        is_draft: false,
      }),
    });
    return { ok: true, id: r.id, committed: r.committed };
  } catch (e) {
    if (e instanceof ApiError) {
      const body = e.body as { error?: unknown } | undefined;
      const detail = typeof body?.error === 'string' ? body.error : `API ${e.status}`;
      return { ok: false, error: detail };
    }
    return { ok: false, error: 'could not save' };
  }
}

export type DeleteNoteResult = { ok: true } | { ok: false; error: string };

/**
 * Remove a note. Soft, like everything holding personal data (hard rule 4).
 *
 * The follow-up task it created is deliberately left alone: it is a commitment
 * somebody made, it may already be half done, and deleting a sentence is not
 * the same as saying the next action is off.
 */
export async function deleteNote(id: string): Promise<DeleteNoteResult> {
  try {
    await apiFetch(`/api/v1/notes/${id}`, { method: 'DELETE' });
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError) {
      const body = e.body as { error?: unknown } | undefined;
      const detail = typeof body?.error === 'string' ? body.error : `API ${e.status}`;
      return { ok: false, error: detail };
    }
    return { ok: false, error: 'could not delete' };
  }
}

/**
 * The words this workspace already uses: its tags, plus the names of the
 * organisations it holds. Read once per composer.
 *
 * Safe to hold in the browser because of WHO receives it, not because of
 * what it contains: a signed-in workspace member who can already read all of
 * these rows. "Organisation names are not personal data" would be the easy
 * sentence and it is false — a sole trader's business name identifies a
 * natural person, and nothing in the row says which is which.
 *
 * Person names are deliberately absent for a different reason: matching bare
 * names is where false positives live, and one wrong tag lands a claim on a
 * real person's record.
 */
export async function fetchVocabulary(): Promise<{
  words: { id?: string; name: string; organisationId?: string }[];
  people: { id: string; name: string }[];
}> {
  try {
    const r = await apiFetch<{
      words: { id?: string; name: string; organisation_id?: string }[];
      people: { id: string; name: string }[];
    }>('/api/v1/connections/vocabulary');
    return {
      words: (r.words ?? []).map((w) => ({
        ...(w.id ? { id: w.id } : {}),
        name: w.name,
        ...(w.organisation_id ? { organisationId: w.organisation_id } : {}),
      })),
      // Kept apart from `words` all the way through, because the automatic
      // matcher must never be able to reach them. See detect-tags.ts.
      people: r.people ?? [],
    };
  } catch {
    // Nothing detected is a working composer; a thrown error is not.
    return { words: [], people: [] };
  }
}

export type MyTeam = { id: string; name: string; is_default: boolean };

/**
 * The teams I can file a note under, in this workspace.
 *
 * Empty for most people and most workspaces, and that is not an error: the
 * composer shows no team picker at all when there is nothing to pick.
 */
export async function loadMyTeams(): Promise<MyTeam[]> {
  try {
    const r = await apiFetch<{ teams: MyTeam[] }>('/api/v1/connections/my-teams');
    return r.teams ?? [];
  } catch {
    return [];
  }
}

/** Make a team my default, or clear the default with null. */
export async function setDefaultTeam(teamId: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await apiFetch('/api/v1/connections/my-teams/default', {
      method: 'PUT',
      body: JSON.stringify({ team_id: teamId }),
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: `API ${e.status}` };
    return { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
  }
}

export type TeamUpdate = {
  id: string;
  body: string;
  kind: string;
  happened_at: string;
  follow_up_at: string | null;
  person: { id: string; name: string } | null;
};

export type TeamUpdates =
  | {
      ok: true;
      team: { id: string; name: string };
      sinceDays: number;
      members: { user_id: string; role: string; name: string; updates: TeamUpdate[] }[];
    }
  | { ok: false; error: string };

/** Everybody in a team, and what each filed under it over the period. */
export async function loadTeamUpdates(teamId: string, sinceDays: number): Promise<TeamUpdates> {
  try {
    const r = await apiFetch<{
      team: { id: string; name: string };
      since_days: number;
      members: { user_id: string; role: string; name: string; updates: TeamUpdate[] }[];
    }>(`/api/v1/connections/team-updates?team_id=${encodeURIComponent(teamId)}&since_days=${sinceDays}`);
    return { ok: true, team: r.team, sinceDays: r.since_days, members: r.members ?? [] };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: `API ${e.status}` };
    return { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
  }
}
