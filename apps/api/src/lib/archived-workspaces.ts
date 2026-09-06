// The archived-workspace gate's data half (P4's 13-month Free archive:
// archive is a FLAG, never deletion — this makes the flag mean something;
// until 2026-09-06 nothing enforced it).
//
// Archived workspaces are rare (usually zero), so the middleware must not
// pay a query per request: one service-role read every 60s refreshes a
// Set of archived ids; membership checks are O(1). A just-reactivated
// workspace is unblocked within the TTL (and immediately in practice —
// reactivation goes through an allowlisted route and the sweep clears the
// flag before anything else runs).

import { adminClient } from '../db.js';

let archived = new Set<string>();
let fetchedAt = 0;
let inFlight: Promise<void> | null = null;
const TTL_MS = 60_000;

async function refresh(): Promise<void> {
  try {
    const { data } = await adminClient
      .from('workspace')
      .select('id')
      .not('archived_at', 'is', null);
    archived = new Set((data ?? []).map((w) => w.id));
    fetchedAt = Date.now();
  } catch (e) {
    // Keep the stale set — an errored refresh must never lock everyone out
    // (empty-on-error would UNLOCK archived workspaces instead, also fine,
    // but stale is the least surprising).
    console.error('[archived-workspaces] refresh failed', e);
    fetchedAt = Date.now(); // back off a full TTL rather than hot-looping
  }
}

export async function isWorkspaceArchived(workspaceId: string): Promise<boolean> {
  if (Date.now() - fetchedAt > TTL_MS) {
    inFlight ??= refresh().finally(() => {
      inFlight = null;
    });
    await inFlight;
  }
  return archived.has(workspaceId);
}

/** Test/ops hook: force the next check to re-read. */
export function invalidateArchivedCache(): void {
  fetchedAt = 0;
}
