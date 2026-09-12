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
 * Every table a route may name by id, and HOW that table soft-deletes.
 *
 * One map, read by one lookup, on purpose. Until 2026-09-13 the soft-delete
 * rule was a hardcoded exception inside the lookup — "every table has
 * deleted_at except flow_run" — and it was wrong in both directions at once:
 *
 *   - flow_run DOES have deleted_at (since 20260520120000_fibre_flow_schema),
 *     and four of its 56 production rows were soft-deleted when this was
 *     checked. So a note could attach to a deleted flow run — the exact
 *     tombstone case this file says must fail.
 *   - team, thread_template and thread_certificate_template have NO
 *     deleted_at. Adding them under the old rule would have made PostgREST
 *     reject the select, the lookup return null, and every legitimate caller
 *     be refused.
 *
 * Both were beliefs about the schema written as code. Stating the column per
 * table makes the belief visible and checkable. Verified against production
 * for every entry; re-verify when you add one.
 *
 * FAILS CLOSED. A wrong entry here shows up as a legitimate admin being
 * refused, never as a hole — a wrong column makes the select error, and an
 * error is null, and null is "not in this workspace". So when that symptom
 * appears, the fix is the entry, not loosening the check around it.
 */
const TABLES = {
  person: { softDelete: 'deleted_at' },
  organisation: { softDelete: 'deleted_at' },
  flow_run: { softDelete: 'deleted_at' },
  team: { softDelete: null },
  thread_template: { softDelete: null },
  thread_certificate_template: { softDelete: null },
} as const satisfies Record<string, { softDelete: 'deleted_at' | null }>;

export type ScopedTable = keyof typeof TABLES;

/**
 * Where a row lives, or null. Soft-deleted rows count as absent: a note about
 * somebody who has been deleted should fail, not quietly attach to a
 * tombstone.
 */
async function workspaceOfRow(table: string, id: string): Promise<string | null> {
  const spec = (TABLES as Record<string, { softDelete: 'deleted_at' | null }>)[table];
  // A table nobody has described is refused rather than guessed at.
  if (!spec) return null;
  let q = adminClient.from(table).select('workspace_id').eq('id', id);
  if (spec.softDelete) q = q.is(spec.softDelete, null);
  const { data } = await q.maybeSingle();
  return (data?.workspace_id as string | undefined) ?? null;
}

export function refsBelongToWorkspace(workspaceId: string, refs: Refs) {
  return checkRefs(workspaceId, refs, workspaceOfRow);
}

// ── Thread's references ────────────────────────────────────────────────────
//
// Added 2026-09-13 after the same class turned up in routes/thread.ts, where
// several service-role writes checked nothing at all: any signed-in user of
// any workspace could grant Thread app access, add themselves as a team lead,
// or wipe another workspace's template grants. See the call sites. They read
// the same TABLES map and the same lookup as the checks above — one truth
// about the schema, not two subsets of it.

/** Does this row exist, and live in this workspace? A row elsewhere and no
 *  row at all are deliberately the same `false`, for the reason given in
 *  checkRefs: telling them apart leaks that an id exists in another tenant. */
export async function rowInWorkspace(
  table: ScopedTable,
  id: string,
  workspaceId: string,
): Promise<boolean> {
  return (await workspaceOfRow(table, id)) === workspaceId;
}

/** Is this user a member of this workspace? Membership lives in
 *  workspace_member, not on user.workspace_id, because one account can belong
 *  to several workspaces — so the question is "a member HERE", not "whose
 *  workspace is this user's home". */
export async function isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
  const { data } = await adminClient
    .from('workspace_member')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

/** Are ALL of these users members of this workspace? One query, so a list
 *  of grantees costs one round trip rather than one per person. An empty
 *  list is trivially true. */
export async function allWorkspaceMembers(
  workspaceId: string,
  userIds: readonly string[],
): Promise<boolean> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return true;
  const { data } = await adminClient
    .from('workspace_member')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .in('user_id', unique);
  return (data ?? []).length === unique.length;
}

/** Do ALL of these teams live in this workspace? Same shape as above. */
export async function allTeamsInWorkspace(
  workspaceId: string,
  teamIds: readonly string[],
): Promise<boolean> {
  const unique = [...new Set(teamIds)];
  if (unique.length === 0) return true;
  const { data } = await adminClient
    .from('team')
    .select('id')
    .eq('workspace_id', workspaceId)
    .in('id', unique);
  return (data ?? []).length === unique.length;
}
