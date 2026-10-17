// One activity row, and WHAT it is about (contacts follow the hierarchy,
// slice 2; Sjoerd, 2026-10-17: "I can only see what those contacts have done
// in relation to my organisation, not the whole workspace").
//
// An activity row says who, which app and what happened; `activity_ref`
// (20261017134857) says which thread or booking. The visibility rule that
// reads the ref (can_see_activity) comes in a later migration — once every
// writer here carries one and the old rows have been given theirs by the
// backfill script — so that an organiser's view of a participant's timeline
// never goes blank in between.
//
// Both rows go through tenantDb: the workspace is stamped on insert, and the
// ref's own trigger refuses a ref whose activity row, thread or booking is in
// another workspace. Like the inserts this replaces, a failure is logged and
// never fails the action that caused it — the timeline is a record of what
// happened, not a gate on it.

import { serviceRole, tenantDb } from './tenant-db.js';

export type ActivityRef = { kind: 'thread' | 'meet_booking'; id: string };

export type ActivityRow = {
  personId: string;
  /** The app's catalogue slug: 'the-thread', 'fibre-meet', … */
  appSlug: string;
  /** Type + subject only — hard rule 5. */
  type: string;
  subject: string;
  createdBy?: string | null;
};

const appIds = new Map<string, string>();

async function appIdFor(slug: string): Promise<string | null> {
  const hit = appIds.get(slug);
  if (hit) return hit;
  const { data } = await serviceRole('app catalogue by slug: a global, read-only list of apps, no tenant data')
    .from('app')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  const id = (data?.id as string | undefined) ?? null;
  if (id) appIds.set(slug, id);
  return id;
}

/** Write one activity row and, when given, its ref. Never throws. */
export async function recordActivity(workspaceId: string, row: ActivityRow, ref: ActivityRef | null = null): Promise<void> {
  try {
    const appId = await appIdFor(row.appSlug);
    if (!appId) return;
    const db = tenantDb(workspaceId);
    const { data, error } = await db
      .from('activity')
      .insert({
        person_id: row.personId,
        app_id: appId,
        type: row.type,
        subject: row.subject.slice(0, 200),
        occurred_at: new Date().toISOString(),
        ...(row.createdBy ? { created_by: row.createdBy } : {}),
      })
      .select('id')
      .single();
    if (error || !data) {
      console.error('[activity] not recorded', { type: row.type, error: error?.message });
      return;
    }
    if (!ref) return;
    const { error: refErr } = await db
      .from('activity_ref')
      .insert({ activity_id: data.id as string, ref_kind: ref.kind, ref_id: ref.id });
    if (refErr) console.error('[activity] ref not recorded', { type: row.type, kind: ref.kind, error: refErr.message });
  } catch (e) {
    console.error('[activity] not recorded', { type: row.type, error: (e as Error).message });
  }
}
