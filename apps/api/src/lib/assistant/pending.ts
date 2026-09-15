// A write the model proposed and a human has not yet approved.
//
// The loop stops the moment the model calls a write tool. The proposal is
// parked here, keyed by the tool_use id, and the client is shown what would
// happen. Only an approve carrying that id — from the same user — executes
// it, and the ARGUMENTS come from this record, never from the client's copy
// of the conversation, so a tampered history cannot turn "rename the thread"
// into "archive it" between proposal and approval.
//
// In-memory on purpose for v1: the API runs as one machine per environment
// and a proposal is worth nothing after a few minutes. If that changes, this
// becomes a table with the same three columns.

export interface PendingWrite {
  id: string;
  userId: string;
  workspaceId: string;
  tool: string;
  input: Record<string, unknown>;
  createdAt: number;
}

const TTL_MS = 15 * 60_000;
const store = new Map<string, PendingWrite>();

function sweep(now: number): void {
  for (const [k, v] of store) if (now - v.createdAt > TTL_MS) store.delete(k);
}

export function parkWrite(p: Omit<PendingWrite, 'createdAt'>): PendingWrite {
  const now = Date.now();
  sweep(now);
  const rec = { ...p, createdAt: now };
  store.set(p.id, rec);
  return rec;
}

/** Take a parked write for this user, or null. One-shot: taking removes it. */
export function takeWrite(id: string, userId: string): PendingWrite | null {
  sweep(Date.now());
  const rec = store.get(id);
  if (!rec || rec.userId !== userId) return null;
  store.delete(id);
  return rec;
}

/** Test seam. */
export function resetPendingForTests(): void {
  store.clear();
}
