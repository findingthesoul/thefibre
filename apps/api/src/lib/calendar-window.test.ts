import { describe, expect, it } from 'vitest';
import { planWindow, type WindowSession } from './calendar-window.js';

const S = (id: string, thread = 't1'): WindowSession => ({
  id,
  thread_id: thread,
  workspace_id: 'w',
  title: id,
  starts_at: '2026-11-10T10:00:00Z',
  ends_at: null,
  location: null,
  url: null,
  sequence: 2,
});
const place = (email: string, since = '2026-10-01T00:00:00Z', thread = 't1') => ({ thread_id: thread, email, name: null, since });
const base = { held: new Set<string>(), sentChanges: [] as { engagement_id: string; sent_at: string }[], feedFollowers: new Set<string>() };

describe('the rolling window: who gets which session', () => {
  it('every live participant, every session of their own thread — one invitation each', () => {
    const p = planWindow({ ...base, sessions: [S('s1'), S('s2'), S('x', 't2')], places: [place('ann@x.org'), place('bob@x.org')] });
    expect(p.invites.map((i) => `${i.session.id}:${i.email}`).sort()).toEqual(['s1:ann@x.org', 's1:bob@x.org', 's2:ann@x.org', 's2:bob@x.org']);
  });

  it('nobody twice: a held row skips it, whatever its case', () => {
    const p = planWindow({ ...base, held: new Set(['s1|ann@x.org']), sessions: [S('s1')], places: [place('ANN@x.org')] });
    expect(p.invites).toEqual([]);
  });

  it('existing members: an organiser SEND after their place began counts as held; one before it does not', () => {
    const sentChanges = [{ engagement_id: 's1', sent_at: '2026-10-05T00:00:00Z' }];
    const p = planWindow({
      ...base,
      sentChanges,
      sessions: [S('s1')],
      places: [place('early@x.org', '2026-10-01T00:00:00Z'), place('late@x.org', '2026-10-09T00:00:00Z')],
    });
    expect(p.invites.map((i) => i.email)).toEqual(['late@x.org']);
  });

  it('a calendar-feed follower is skipped, and counted as skipped', () => {
    const p = planWindow({ ...base, feedFollowers: new Set(['ann@x.org']), sessions: [S('s1'), S('s2')], places: [place('ann@x.org'), place('bob@x.org')] });
    expect(p.invites.map((i) => i.email)).toEqual(['bob@x.org', 'bob@x.org']);
    expect([...(p.feedSkipped.get('t1') ?? [])]).toEqual(['ann@x.org']);
  });

  it('the session keeps its sequence, so a later move updates the same event', () => {
    const p = planWindow({ ...base, sessions: [S('s1')], places: [place('ann@x.org')] });
    expect(p.invites[0]!.session.sequence).toBe(2);
  });
});
