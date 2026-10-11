// Is this person's organiser identity usable in the workspace they are in?
//
// `thread_organiser.user_id` is UNIQUE GLOBALLY — one organiser page per
// person, ever. Somebody who already has one, opening The Thread in a second
// workspace, gets a 403 from `/api/v1/thread/me` with the code
// `organiser_elsewhere`, and nothing inside The Thread can resolve it: a human
// has to move the identity or switch workspace.
//
// Four pages called `/thread/me` without catching that (settings/profile,
// settings/categories, settings/embeds, threads/new) and rendered
// "Application error: a server-side exception has occurred" — so the sentence
// the API had just been taught to say reached nobody, and from the person's
// side it was indistinguishable from the 500 it replaced. Observed on staging
// on 2026-10-11 against a fixture, which is why this exists.
//
// So the check moved into the layout, where no page can forget it, and rides
// the shell's existing Promise.all — parallel with three calls already being
// made, so it costs no wall-clock time.
//
// This function is INCAPABLE of throwing, deliberately: it runs in the layout
// of every Thread page, so an unexpected shape here would take the whole app
// down. Anything it does not recognise returns null, which means "carry on" —
// exactly what happened before it existed.
import { apiFetch, ApiError } from '@/lib/api';

export async function organiserBlock(): Promise<'elsewhere' | null> {
  try {
    await apiFetch('/api/v1/thread/me');
    return null;
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) {
      const code = (e.body as { code?: unknown } | undefined)?.code;
      if (code === 'organiser_elsewhere') return 'elsewhere';
    }
    // Every other failure is somebody else's to report. A 401 is already
    // handled by the shell; `no_thread_access` means the seat is missing,
    // which the shell's own hasAccess check catches first.
    return null;
  }
}
