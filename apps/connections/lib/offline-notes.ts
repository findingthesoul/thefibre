// Notes that could not reach the server, kept on the device until they can.
//
// The phone-app half of build-order step 7: walking out of a meeting into a
// lift, typing the one line that is the point of the app, and not losing it
// because the signal dropped.
//
// ── Why this is small ───────────────────────────────────────────────────────
//
// The hard part already exists. Every note carries a `client_ref`, minted once
// when somebody starts typing, and PUT /notes upserts on it. A note replayed
// twice, or after a newer version landed, updates ONE row.
//
// ── Every queued note remembers its workspace ───────────────────────────────
//
// Added 2026-09-13, after building the first version exposed a cross-tenant
// hole in PUT /notes: the route filed a note under the CALLER's workspace
// pointing at whatever person the body named. A note queued in workspace A and
// replayed after switching to B would have landed in B about A's person. The
// route now refuses that (404), which means a queue without workspace
// awareness would hold such a note forever as "stuck". So each entry is
// stamped with the workspace it was written in, and a flush only sends the
// current workspace's notes — the others wait, untouched, until that workspace
// is active again.
//
// ── Why localStorage and not IndexedDB ──────────────────────────────────────
//
// A queued note is a few hundred bytes and there are rarely more than a
// handful. localStorage is synchronous, so a write completes before the tab
// can be closed out from under it — what matters most when the reason for
// queueing is that something is going wrong.
//
// ── The offline page reads and writes the SAME keys ─────────────────────────
//
// public/offline.html is plain HTML with no framework, because it has to work
// when nothing but the service worker's cache is reachable. It writes queue
// entries in exactly this format. The format
// is therefore a contract between two files that share no code, and
// offline-notes.test.ts checks an entry written the way offline.html writes
// one is read back here.

/** Announced whenever the queue changes, so the composer's "waiting" count
 *  stays true without polling. Lives here rather than in a component: it is a
 *  value read by more than one client module. */
export const QUEUE_CHANGED = 'connections:queue-changed';

const NOTE_PREFIX = 'connections:offline-note:';
const WORKSPACE_KEY = 'connections:workspace';
/**
 * Where v0.73.18 kept a list of people for the offline page. Nothing writes
 * it any more; it is only ever REMOVED, from devices that still carry it.
 *
 * Sjoerd, 2026-09-13, removed the list. connections-overview.md §4 says the
 * offline half must not become a local contact database, and names on a
 * phone that can be lost are exactly that, however short the list.
 */
const LEGACY_PEOPLE_KEY = 'connections:people';

/** The payload saveNote takes. Kept loose so this module does not import a
 *  'use server' file and drag it somewhere it should not be. */
export type QueuedNote = { client_ref: string } & Record<string, unknown>;

type Entry = { payload: QueuedNote; queuedAt: number; workspaceId: string | null };

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

// ── The current workspace ──────────────────────────────────────────────────

/** Recorded by OfflineSync whenever the signed-in app loads. */
export function setCurrentWorkspace(id: string): void {
  try {
    storage()?.setItem(WORKSPACE_KEY, id);
  } catch {
    /* storage unavailable; the queue degrades to workspace-less */
  }
}

export function currentWorkspace(): string | null {
  try {
    return storage()?.getItem(WORKSPACE_KEY) ?? null;
  } catch {
    return null;
  }
}

// ── The note queue ──────────────────────────────────────────────────────────

/**
 * Keep the latest version of a note on the device, stamped with the workspace
 * it was written in.
 *
 * Keyed by client_ref, so a note edited three times offline is stored ONCE, as
 * its newest text. Replaying an older draft after a newer commit is the classic
 * offline bug; keying by the note makes it impossible rather than guarded.
 */
export function queueNote(payload: QueuedNote): boolean {
  const s = storage();
  if (!s) return false;
  try {
    const entry: Entry = { payload, queuedAt: Date.now(), workspaceId: currentWorkspace() };
    s.setItem(NOTE_PREFIX + payload.client_ref, JSON.stringify(entry));
    return true;
  } catch {
    // Quota exceeded or storage revoked. Reported, so the composer keeps the
    // text in the box instead of pretending it is safe.
    return false;
  }
}

export function dequeueNote(clientRef: string): void {
  try {
    storage()?.removeItem(NOTE_PREFIX + clientRef);
  } catch {
    /* a stale entry replays idempotently next time */
  }
}

function entries(): Entry[] {
  const s = storage();
  if (!s) return [];
  const out: Entry[] = [];
  try {
    for (let i = 0; i < s.length; i += 1) {
      const key = s.key(i);
      if (!key?.startsWith(NOTE_PREFIX)) continue;
      try {
        const parsed = JSON.parse(s.getItem(key) ?? 'null');
        if (parsed?.payload?.client_ref) {
          out.push({
            payload: parsed.payload,
            queuedAt: Number(parsed.queuedAt) || 0,
            workspaceId: parsed.workspaceId ?? null,
          });
        }
      } catch {
        // A corrupt entry is skipped rather than blocking every other note.
      }
    }
  } catch {
    return [];
  }
  return out.sort((a, b) => a.queuedAt - b.queuedAt);
}

/**
 * Notes waiting for a workspace, oldest first.
 *
 * With no workspace given, every note on the device. An entry written before
 * workspaces were recorded (workspaceId null) is offered to whichever
 * workspace flushes first — the server's own check then decides, and refuses
 * it if the person is not there.
 */
export function queuedNotes(workspaceId?: string | null): QueuedNote[] {
  return entries()
    .filter((e) => workspaceId === undefined || e.workspaceId === null || e.workspaceId === workspaceId)
    .map((e) => e.payload);
}

/**
 * Send the current workspace's waiting notes. Returns how many are still stuck.
 *
 * Sequential, not parallel: a handful of notes, and replaying them in the
 * order they were written keeps derived effects (the activity row, the
 * follow-up task) in the order they happened.
 */
export async function flushQueuedNotes(
  save: (p: QueuedNote) => Promise<{ ok: boolean }>,
  workspaceId: string | null = currentWorkspace(),
): Promise<number> {
  let stuck = 0;
  for (const note of queuedNotes(workspaceId)) {
    // A note written offline with only a typed name waits for somebody to say
    // who it is about (see fileNote). Sending it would either fail or, worse,
    // tempt the server into matching a name — which system-handbook §12
    // forbids: a person is attached by an exact identifier, never by prose.
    if (!isFiled(note)) {
      stuck += 1;
      continue;
    }
    try {
      const r = await save(note);
      if (r.ok) dequeueNote(note.client_ref);
      else stuck += 1;
    } catch {
      // Still offline, or the request failed. Left in place for next time.
      stuck += 1;
    }
  }
  return stuck;
}

// ── Notes that still need a person ─────────────────────────────────────────

function isFiled(note: QueuedNote): boolean {
  return typeof note.person_id === 'string' && note.person_id.length > 0;
}

/** A queued note written offline, where only a name was typed. */
export type UnfiledNote = { client_ref: string; person_name: string; body: string };

/** Waiting notes with no person yet, oldest first. */
export function unfiledNotes(workspaceId?: string | null): UnfiledNote[] {
  return queuedNotes(workspaceId)
    .filter((n) => !isFiled(n))
    .map((n) => ({
      client_ref: n.client_ref,
      person_name: typeof n.person_name === 'string' ? n.person_name : '',
      body: typeof n.body === 'string' ? n.body : '',
    }));
}

/**
 * Say who an offline note is about, chosen by a person from real records.
 *
 * The typed name is dropped from the payload once a person is chosen: it was
 * a reminder for the reader, not data for the server, and the save schema
 * has no field for it. Returns false if the note is gone or cannot be written.
 */
export function fileNote(clientRef: string, personId: string): boolean {
  const s = storage();
  if (!s) return false;
  try {
    const raw = s.getItem(NOTE_PREFIX + clientRef);
    if (!raw) return false;
    const entry = JSON.parse(raw) as Entry;
    const { person_name: _typed, ...rest } = entry.payload;
    entry.payload = { ...rest, client_ref: clientRef, person_id: personId };
    s.setItem(NOTE_PREFIX + clientRef, JSON.stringify(entry));
    return true;
  } catch {
    return false;
  }
}

/** Remove the people list older versions kept on the device. */
export function forgetLegacyPeople(): void {
  try {
    storage()?.removeItem(LEGACY_PEOPLE_KEY);
  } catch {
    /* storage unavailable: nothing to remove either */
  }
}

// ── Leaving the device ──────────────────────────────────────────────────────

/**
 * Remove everything Connections keeps on this device.
 *
 * Called on sign-out. Includes notes that have not been sent, and that is a
 * deliberate trade rather than an oversight: somebody signing out is saying
 * "remove me from this device", which on a shared or borrowed phone is the
 * whole point, and conversation notes are the most sensitive text in the
 * system. The caller tries to send them first.
 */
export function clearOfflineData(): void {
  const s = storage();
  if (!s) return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < s.length; i += 1) {
      const key = s.key(i);
      if (key && (key.startsWith(NOTE_PREFIX) || key === WORKSPACE_KEY || key === LEGACY_PEOPLE_KEY)) {
        doomed.push(key);
      }
    }
    // Collected first, removed second: removing while iterating shifts the
    // indices and skips every other entry.
    for (const key of doomed) s.removeItem(key);
  } catch {
    /* nothing further possible */
  }
}
