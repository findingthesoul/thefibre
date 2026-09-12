'use server';

// Loading one person for the popup.
//
// The person PAGE loads the same two things in a server component. The popup
// cannot — it opens from a click, on whatever page you are already on — so it
// asks through this action instead. Same two API calls, same shapes, so the
// popup and the page cannot disagree about who somebody is or what was said.
//
// Everything in a 'use server' module must be an async function, so the types
// are declared here and only they cross to the client (types are erased).

import { apiFetch, ApiError } from '@/lib/api';
import type { Note } from './notes';

export type PersonCard = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type LoadPersonResult =
  | { ok: true; person: PersonCard; notes: Note[]; notesError: string | null }
  | { ok: false; error: string };

export async function loadPerson(id: string): Promise<LoadPersonResult> {
  // Never throws, and that is load-bearing. A server action that throws
  // rejects the promise on the client, and the popup awaiting it would never
  // reach the line that clears its loading state — it would sit on "Loading"
  // forever with nothing in the console a person would see. allSettled covers
  // a failed API call; this covers everything before it (no session, a
  // missing env value, the client failing to build).
  try {
    return await loadPersonUnsafe(id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
  }
}

async function loadPersonUnsafe(id: string): Promise<LoadPersonResult> {
  const [p, n] = await Promise.allSettled([
    apiFetch<PersonCard>(`/api/v1/persons/${id}`),
    apiFetch<{ items: Note[] }>(`/api/v1/notes?person_id=${id}&limit=100`),
  ]);

  if (p.status !== 'fulfilled') {
    return {
      ok: false,
      error: p.reason instanceof ApiError ? `API ${p.reason.status}` : 'unknown error',
    };
  }

  // Notes failing is not the popup failing: the person and the composer are
  // still worth showing, and the composer is the reason it was opened.
  return {
    ok: true,
    person: p.value,
    notes: n.status === 'fulfilled' ? n.value.items : [],
    notesError:
      n.status === 'fulfilled'
        ? null
        : n.reason instanceof ApiError
          ? `API ${n.reason.status}`
          : 'unknown error',
  };
}
