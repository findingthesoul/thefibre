// Notes that could not reach the server, kept on the device until they can.
//
// The phone-app half of build-order step 7. The installable app landed first;
// this is the part that matters on an actual phone: walking out of a meeting
// into a lift, typing the one line that is the whole point of the app, and
// not losing it because the signal dropped.
//
// ── Why this is small ───────────────────────────────────────────────────────
//
// Because the hard part already exists. Every note carries a `client_ref`,
// minted once when somebody starts typing, and PUT /notes upserts on it. So a
// note replayed twice, or replayed after a newer version already landed, is
// the SAME row updated — never a duplicate. An offline queue is otherwise the
// part people get wrong; here idempotency was designed in on day one for
// autosave, and this just leans on it.
//
// ── What it is not ──────────────────────────────────────────────────────────
//
// Not a service worker, and not an app that launches without a connection.
// If the page was never loaded, nothing here runs. This protects a note typed
// into a page that WAS loaded and then lost its network — which is the case
// that actually happens, and the one where losing text is unforgivable.
//
// ── Why localStorage and not IndexedDB ──────────────────────────────────────
//
// A queued note is a few hundred bytes of JSON and there are rarely more than
// a handful. localStorage is synchronous, which means a write completes before
// the tab can be closed out from under it — the property that matters most
// when the reason for queueing is that something is going wrong. IndexedDB is
// the right tool for megabytes, and wrong for "this must be on disk NOW".

const PREFIX = 'connections:offline-note:';

/** The payload saveNote takes. Kept loose here so this module does not import
 *  a 'use server' file and drag it into places it should not be. */
export type QueuedNote = { client_ref: string } & Record<string, unknown>;

function storage(): Storage | null {
  try {
    // Accessing localStorage can throw outright: private mode on some
    // browsers, storage disabled, a sandboxed frame. A queue that cannot be
    // written must degrade to "no queue", never take the composer down.
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Keep the latest version of a note on the device.
 *
 * Keyed by client_ref, so a note edited three times while offline is stored
 * ONCE, as its newest text. Replaying an older draft after a newer commit
 * would be the classic offline bug; keying by the note makes it impossible
 * rather than something to guard against.
 */
export function queueNote(payload: QueuedNote): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(PREFIX + payload.client_ref, JSON.stringify({ payload, queuedAt: Date.now() }));
    return true;
  } catch {
    // Quota exceeded or storage revoked. Reported, so the composer can keep
    // the text in the box instead of pretending it is safe.
    return false;
  }
}

export function dequeueNote(clientRef: string): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(PREFIX + clientRef);
  } catch {
    // Nothing useful to do; a stale entry replays idempotently next time.
  }
}

/** Every note waiting on this device, oldest first. */
export function queuedNotes(): QueuedNote[] {
  const s = storage();
  if (!s) return [];
  const out: { payload: QueuedNote; queuedAt: number }[] = [];
  try {
    for (let i = 0; i < s.length; i += 1) {
      const key = s.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      try {
        const parsed = JSON.parse(s.getItem(key) ?? 'null');
        if (parsed?.payload?.client_ref) out.push(parsed);
      } catch {
        // A corrupt entry is skipped rather than blocking every other note.
      }
    }
  } catch {
    return [];
  }
  return out.sort((a, b) => a.queuedAt - b.queuedAt).map((e) => e.payload);
}

/**
 * Send everything waiting. Returns how many are still stuck.
 *
 * Sequential, not parallel: a handful of notes, and replaying them in the
 * order they were written keeps derived effects (the activity row, the
 * follow-up task) in the order they happened.
 */
export async function flushQueuedNotes(
  save: (p: QueuedNote) => Promise<{ ok: boolean }>,
): Promise<number> {
  let stuck = 0;
  for (const note of queuedNotes()) {
    try {
      const r = await save(note);
      if (r.ok) dequeueNote(note.client_ref);
      else stuck += 1;
    } catch {
      // Still offline, or the server refused. Left in place for next time.
      stuck += 1;
    }
  }
  return stuck;
}
