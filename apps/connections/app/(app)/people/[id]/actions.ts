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

export type NoteKind = 'note' | 'call' | 'meeting' | 'message' | 'email';

export type SaveNoteInput = {
  /** Minted once per note by the client. Same value on every write. */
  client_ref: string;
  person_id: string;
  body: string;
  kind: NoteKind;
  /** ISO 8601 with offset. Omitted means "now", decided by the API. */
  happened_at?: string;
  /** IANA zone of wherever this was typed. */
  happened_tz?: string;
  /** null is a real answer — "nothing planned" — and is never a blocker. */
  follow_up_at?: string | null;
  /** True while the composer is open; false commits it. */
  is_draft: boolean;
  /**
   * Tags the composer is showing, minus any the person removed. Sent rather
   * than re-detected server-side: detection runs once, in the box, and what
   * was on screen is what gets written.
   */
  tags?: { name: string; organisation_id?: string }[];
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

/**
 * The words this workspace already uses: its tags, plus the names of the
 * organisations it holds. Read once per composer.
 *
 * Not personal data — tag names are a team's vocabulary and organisation
 * names are companies. Person names are deliberately absent: matching bare
 * names is where false positives live, and one wrong tag lands a claim on a
 * real person's record.
 */
export async function fetchVocabulary(): Promise<
  { id?: string; name: string; organisationId?: string }[]
> {
  try {
    const r = await apiFetch<{
      words: { id?: string; name: string; organisation_id?: string }[];
    }>('/api/v1/connections/vocabulary');
    return (r.words ?? []).map((w) => ({
      ...(w.id ? { id: w.id } : {}),
      name: w.name,
      ...(w.organisation_id ? { organisationId: w.organisation_id } : {}),
    }));
  } catch {
    // Nothing detected is a working composer; a thrown error is not.
    return [];
  }
}
