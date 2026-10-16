// WHEN A THREAD'S DOCUMENT IS RELEASED to a person — one reader for every
// participant surface: the community page, Files, and the my.thread
// schedule/calendar (Sjoerd, 2026-10-16: the schedule waits too).
//
// The thread's own triggers deliver a document step and log the delivery per
// person in thread_message_send. That log IS the release — a document
// scheduled for week 3 has no row in week 1 — so it is read, not restated.
// Organisers' own views do not ask this; they see their thread whole.

import { adminClient } from '../db.js';

/** For these document steps and these people: engagement id → the earliest
 *  time it was sent to any of them. A step absent from the map is not
 *  released to them. Scoped by person id — the portal has no RLS identity. */
export async function releasedAt(engagementIds: string[], personIds: string[]): Promise<Map<string, string>> {
  const sent = new Map<string, string>();
  if (!engagementIds.length || !personIds.length) return sent;
  const { data, error } = await adminClient
    .from('thread_message_send')
    .select('engagement_id, sent_at')
    .in('engagement_id', engagementIds)
    .in('person_id', personIds);
  if (error) throw new Error(`document releases: ${error.message}`);
  for (const s of data ?? []) {
    const prev = sent.get(s.engagement_id as string);
    if (!prev || (s.sent_at as string) < prev) sent.set(s.engagement_id as string, s.sent_at as string);
  }
  return sent;
}
