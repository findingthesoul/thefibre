// A relative message is timed from a session on its OWN thread — enforced by
// the database (20261017141117), whichever route writes the row.
//
// Found 2026-10-17: trigger_engagement_id took any engagement id, another
// thread's or another workspace's, on four write paths. The trigger refuses
// that at the table, so this attacks the table directly as the service role
// (the strongest caller, which no route-level check would stop): two threads,
// an anchor across them refused on insert and on update; an anchor on the
// same thread, and edits that leave a set anchor alone, still allowed.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanupPublicThreadFixture,
  createPublicThreadFixture,
  service,
  type PublicThreadFixture,
} from './staging.js';

let t1: PublicThreadFixture, t2: PublicThreadFixture;
let session1 = '', session2 = '', message1 = '';

const engagement = async (f: PublicThreadFixture, extra: Record<string, unknown>) =>
  service
    .from('thread_engagement')
    .insert({ workspace_id: f.workspaceId, thread_id: f.threadId, title: 'Int anchor', status: 'draft', ...extra })
    .select('id')
    .single();

beforeAll(async () => {
  t1 = await createPublicThreadFixture('anchor-a');
  t2 = await createPublicThreadFixture('anchor-b');
  const s1 = await engagement(t1, { type: 'event', starts_at: '2030-01-10T10:00:00Z', ends_at: '2030-01-10T11:00:00Z' });
  const s2 = await engagement(t2, { type: 'event', starts_at: '2030-02-10T10:00:00Z', ends_at: '2030-02-10T11:00:00Z' });
  if (s1.error || s2.error) throw new Error(`sessions: ${s1.error?.message ?? s2.error?.message}`);
  session1 = s1.data.id as string;
  session2 = s2.data.id as string;
}, 90_000);

afterAll(async () => {
  for (const f of [t1, t2]) {
    if (!f) continue;
    await service.from('thread_engagement').update({ trigger_engagement_id: null }).eq('thread_id', f.threadId);
    await service.from('thread_engagement').delete().eq('thread_id', f.threadId);
    await cleanupPublicThreadFixture(f);
  }
}, 90_000);

const relative = (anchor: string) => ({
  type: 'message',
  trigger_kind: 'relative',
  trigger_anchor: 'engagement',
  trigger_engagement_id: anchor,
  trigger_offset_days: -1,
  trigger_time: '09:00',
});

describe('thread_engagement anchors stay on their thread', () => {
  it('an anchor on the same thread is accepted', async () => {
    const r = await engagement(t1, relative(session1));
    expect(r.error).toBeNull();
    message1 = r.data!.id as string;
  });

  it("an anchor on another thread is refused on insert", async () => {
    const r = await engagement(t1, relative(session2));
    expect(r.error?.code).toBe('P0001');
    expect(r.error?.message).toMatch(/its own thread/);
  });

  it('re-pointing an anchor at another thread is refused on update', async () => {
    const r = await service.from('thread_engagement').update({ trigger_engagement_id: session2 }).eq('id', message1).select('id');
    expect(r.error?.code).toBe('P0001');
    const { data } = await service.from('thread_engagement').select('trigger_engagement_id').eq('id', message1).single();
    expect(data!.trigger_engagement_id).toBe(session1);
  });

  it('moving a message to another thread with its anchor left behind is refused', async () => {
    const r = await service.from('thread_engagement').update({ thread_id: t2.threadId }).eq('id', message1).select('id');
    expect(r.error?.code).toBe('P0001');
  });

  it('every other edit of an anchored message still works, including re-sending the same anchor', async () => {
    const r = await service
      .from('thread_engagement')
      .update({ title: 'Int anchor, renamed', trigger_engagement_id: session1, trigger_offset_days: -2 })
      .eq('id', message1)
      .select('title, trigger_offset_days');
    expect(r.error).toBeNull();
    expect(r.data).toEqual([{ title: 'Int anchor, renamed', trigger_offset_days: -2 }]);
  });

  it('clearing the anchor is always allowed', async () => {
    const r = await service.from('thread_engagement').update({ trigger_engagement_id: null }).eq('id', message1).select('id');
    expect(r.error).toBeNull();
  });
});
