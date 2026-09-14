// "Once in a while" for tag cleaning, remembered on this device.
//
// Sjoerd, 2026-09-14: *"present a list for cleaning once in a while"*. Today
// shows a nudge when there is something to tidy and the list has not been
// looked at for NUDGE_DAYS. Per device, like the leaving warning: it is a
// reminder, not a record, and losing it costs one extra nudge.
//
// Every read and write is guarded — storage throws in private windows.

const SEEN = 'connections.tagCleaning.seenAt';
const NOT_SAME = 'connections.tagCleaning.notTheSame';
export const NUDGE_DAYS = 30;

export function markTagCleaningSeen(now = Date.now()): void {
  try {
    localStorage.setItem(SEEN, String(now));
  } catch {
    /* no storage: the nudge simply comes back */
  }
}

/** True when the list has never been opened here, or not for NUDGE_DAYS. */
export function tagCleaningDue(now = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(SEEN));
    return !at || now - at > NUDGE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/** One key per group, independent of order. */
export function notTheSameKey(ids: string[]): string {
  return [...ids].sort().join('|');
}

export const notTheSame = {
  read(): Set<string> {
    try {
      const raw = JSON.parse(localStorage.getItem(NOT_SAME) ?? '[]') as unknown;
      return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
    } catch {
      return new Set();
    }
  },
  add(key: string): void {
    try {
      const all = notTheSame.read();
      all.add(key);
      localStorage.setItem(NOT_SAME, JSON.stringify([...all]));
    } catch {
      /* ignore */
    }
  },
};
