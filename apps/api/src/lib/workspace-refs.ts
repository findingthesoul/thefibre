// Does every id a request names belong to the caller's workspace?
//
// Routes that write through the service-role client get no help from RLS: the
// client bypasses it by design. So a route that takes a person_id from a
// request body and writes a row pointing at it must check, itself, that the
// person is in the caller's workspace — or it writes across the wall between
// customers.
//
// Found 2026-09-13 in PUT /notes, which did not check, and proved on staging:
// the database accepted a note in one workspace about a person in another.
// See the comment at the call site in routes/notes.ts.
//
// The decision is a pure function over a lookup, so it is tested without a
// database (workspace-refs.test.ts); `refsBelongToWorkspace` binds it to the
// real tables.

import { adminClient } from '../db.js';

export type Refs = {
  person_id: string | null;
  organisation_id: string | null;
  flow_run_id: string | null;
};

type Field = keyof Refs;

/** Which table each field points at. */
const TABLE: Record<Field, string> = {
  person_id: 'person',
  organisation_id: 'organisation',
  flow_run_id: 'flow_run',
};

/** Returns the workspace a row belongs to, or null when there is no such row. */
export type WorkspaceOf = (table: string, id: string) => Promise<string | null>;

export async function checkRefs(
  workspaceId: string,
  refs: Refs,
  workspaceOf: WorkspaceOf,
): Promise<{ ok: true } | { ok: false; field: Field }> {
  for (const field of Object.keys(TABLE) as Field[]) {
    const id = refs[field];
    if (!id) continue;
    const owner = await workspaceOf(TABLE[field], id);
    // A missing row and a row in another workspace are the SAME answer on
    // purpose. Distinguishing them would tell a caller that an id exists
    // somewhere else, which is itself a leak across tenants.
    if (owner !== workspaceId) return { ok: false, field };
  }
  return { ok: true };
}

/**
 * Where a row lives. Soft-deleted rows count as absent: a note about somebody
 * who has been deleted should fail, not quietly attach to a tombstone.
 * flow_run has no soft delete, so it is read without that filter.
 */
async function workspaceOfRow(table: string, id: string): Promise<string | null> {
  let q = adminClient.from(table).select('workspace_id').eq('id', id);
  if (table !== 'flow_run') q = q.is('deleted_at', null);
  const { data } = await q.maybeSingle();
  return (data?.workspace_id as string | undefined) ?? null;
}

export function refsBelongToWorkspace(workspaceId: string, refs: Refs) {
  return checkRefs(workspaceId, refs, workspaceOfRow);
}
