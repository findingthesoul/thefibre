// The timeline's ordering rules, which the staging fixture cannot prove: it
// holds ONE upcoming session for ONE organiser, so the past toggle and the
// organiser filter never render there and the mixed-date rule never fires.
// These are the cases a second fixture would show and this file asserts
// instead.

import { describe, expect, it } from 'vitest';
import { buildTimeline, quarterLabel, splitAt, unanswered, type Entry } from './timeline';
import type { AgendaItem, Portal } from './portal-api';

const NOW = new Date('2026-06-15T12:00:00Z').getTime();

function agenda(over: Partial<AgendaItem> & { id: string }): AgendaItem {
  return {
    title: 'Session',
    description: null,
    type: 'session',
    starts_at: null,
    ends_at: null,
    location: null,
    location_url: null,
    meeting_url: null,
    external_url: null,
    rsvp_enabled: false,
    rsvp: null,
    ...over,
  };
}

function portal(groups: Portal['groups']): Portal {
  return {
    person: { first_name: 'A', last_name: 'B', email: 'a@b.test' },
    wallet: { apple: false, google: false },
    groups,
  };
}

function group(over: Partial<Portal['groups'][number]> = {}): Portal['groups'][number] {
  return {
    workspace_id: 'ws1',
    name: 'One',
    slug: 'one',
    logo_url: null,
    tickets: [],
    threads: [],
    meets: [],
    memberships: [],
    ...over,
  };
}

function thread(over: Partial<Portal['groups'][number]['threads'][number]> = {}) {
  return {
    thread_id: 't1',
    title: 'Thread',
    format: 'course',
    status: 'published',
    starts_on: null,
    ends_on: null,
    language: 'en',
    cover_url: null,
    enrolment_status: 'confirmed',
    progress_pct: null,
    url: 'https://example.test/t',
    agenda: [],
    ...over,
  };
}

describe('buildTimeline', () => {
  it('emits a thread’s SESSIONS, not the thread, when it has dated ones', () => {
    const out = buildTimeline(
      portal([
        group({
          threads: [
            thread({
              starts_on: '2026-07-01',
              agenda: [
                agenda({ id: 'a1', title: 'Two', starts_at: '2026-07-05T16:00:00Z' }),
                agenda({ id: 'a2', title: 'One', starts_at: '2026-07-02T09:00:00Z' }),
              ],
            }),
          ],
        }),
      ]),
      NOW,
    );
    expect(out.map((e) => e.title)).toEqual(['One', 'Two']);
    expect(out.every((e) => e.threadId === 't1')).toBe(true);
  });

  it('falls back to the thread itself when nothing is scheduled', () => {
    const out = buildTimeline(
      portal([
        group({
          threads: [
            thread({ starts_on: '2026-07-01', agenda: [agenda({ id: 'a1' })] }),
          ],
        }),
      ]),
      NOW,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.allDay).toBe(true);
    expect(out[0]!.time).toBeNull();
  });

  it('sorts an all-day entry before a timed one on the same day', () => {
    const out = buildTimeline(
      portal([
        group({
          threads: [
            thread({ thread_id: 'day', title: 'All day', starts_on: '2026-07-02' }),
            thread({
              thread_id: 'timed',
              agenda: [agenda({ id: 'a1', title: 'Timed', starts_at: '2026-07-02T09:00:00' })],
            }),
          ],
        }),
      ]),
      NOW,
    );
    expect(out.map((e) => e.title)).toEqual(['All day', 'Timed']);
  });

  it('offers Join only inside the window, never months early', () => {
    const build = (startsAt: string, now: number) =>
      buildTimeline(
        portal([
          group({
            threads: [
              thread({
                agenda: [
                  agenda({
                    id: 'a1',
                    starts_at: startsAt,
                    ends_at: null,
                    meeting_url: 'https://call.test/x',
                  }),
                ],
              }),
            ],
          }),
        ]),
        now,
      )[0]!;

    const start = new Date('2026-06-15T14:00:00Z').getTime();
    expect(build('2026-06-15T14:00:00Z', start - 60 * 60 * 1000).joinUrl).toBeNull();
    expect(build('2026-06-15T14:00:00Z', start - 5 * 60 * 1000).joinUrl).not.toBeNull();
    expect(build('2026-06-15T14:00:00Z', start + 30 * 60 * 1000).joinUrl).not.toBeNull();
    expect(build('2026-06-15T14:00:00Z', start + 3 * 60 * 60 * 1000).joinUrl).toBeNull();
  });

  it('carries the organiser on every entry, which is what the filter reads', () => {
    const out = buildTimeline(
      portal([
        group({ workspace_id: 'w1', name: 'One', threads: [thread({ starts_on: '2026-07-01' })] }),
        group({
          workspace_id: 'w2',
          name: 'Two',
          threads: [thread({ thread_id: 't2', starts_on: '2026-06-20' })],
        }),
      ]),
      NOW,
    );
    expect(out.map((e) => e.organiser)).toEqual(['Two', 'One']);
  });
});

describe('splitAt', () => {
  const at = (iso: string, allDay = false): Entry =>
    ({
      key: iso,
      at: new Date(iso).getTime(),
      allDay,
      title: iso,
      organiser: 'One',
      workspaceId: 'w1',
      dateIso: iso,
      time: null,
      where: null,
      whereUrl: null,
      joinUrl: null,
      threadId: null,
      engagementId: null,
      rsvpEnabled: false,
      rsvp: null,
      hasTicket: false,
    }) satisfies Entry;

  it('keeps something in progress on the upcoming list', () => {
    const { upcoming, past } = splitAt([at('2026-06-15T11:30:00Z')], NOW);
    expect(upcoming).toHaveLength(1);
    expect(past).toHaveLength(0);
  });

  it('moves it to the past once it has had time to finish', () => {
    const { upcoming, past } = splitAt([at('2026-06-15T09:00:00Z')], NOW);
    expect(upcoming).toHaveLength(0);
    expect(past).toHaveLength(1);
  });

  it('keeps an all-day entry until its whole day is over', () => {
    const today = splitAt([at('2026-06-15T00:00:00Z', true)], NOW);
    expect(today.upcoming).toHaveLength(1);
    const yesterday = splitAt([at('2026-06-13T00:00:00Z', true)], NOW);
    expect(yesterday.past).toHaveLength(1);
  });

  it('runs the past newest first — you look backwards from now', () => {
    const { past } = splitAt(
      [at('2026-06-01T09:00:00Z'), at('2026-06-10T09:00:00Z')],
      NOW,
    );
    expect(past.map((e) => e.title)).toEqual([
      '2026-06-10T09:00:00Z',
      '2026-06-01T09:00:00Z',
    ]);
  });
});

describe('quarterLabel', () => {
  it('names the months rather than saying Q4', () => {
    expect(quarterLabel(new Date('2026-01-15T12:00:00').getTime())).toBe('Jan–Mar 2026');
    expect(quarterLabel(new Date('2026-06-30T12:00:00').getTime())).toBe('Apr–Jun 2026');
    expect(quarterLabel(new Date('2026-09-01T12:00:00').getTime())).toBe('Jul–Sep 2026');
    expect(quarterLabel(new Date('2026-12-31T12:00:00').getTime())).toBe('Oct–Dec 2026');
  });

  it('changes at the boundary, which is what a header keys on', () => {
    const sep = quarterLabel(new Date('2026-09-30T23:00:00').getTime());
    const oct = quarterLabel(new Date('2026-10-01T01:00:00').getTime());
    expect(sep).not.toBe(oct);
  });
});

describe('unanswered', () => {
  const entry = (over: Partial<Entry>): Entry =>
    ({
      key: 'k',
      at: 0,
      allDay: false,
      title: 't',
      organiser: 'One',
      workspaceId: 'w',
      dateIso: '2026-06-15T09:00:00Z',
      time: null,
      where: null,
      whereUrl: null,
      joinUrl: null,
      threadId: null,
      engagementId: 'e',
      rsvpEnabled: false,
      rsvp: null,
      hasTicket: false,
      ...over,
    }) satisfies Entry;

  it('counts only what is actually asking', () => {
    const rows = [
      entry({ key: 'a', rsvpEnabled: true, rsvp: null }),
      entry({ key: 'b', rsvpEnabled: true, rsvp: 'coming' }),
      entry({ key: 'c', rsvpEnabled: true, rsvp: 'not_coming' }),
      entry({ key: 'd', rsvpEnabled: false, rsvp: null }),
    ];
    expect(unanswered(rows).map((e) => e.key)).toEqual(['a']);
  });

  it("treats 'can't' as answered — it is a reply, not a silence", () => {
    expect(unanswered([entry({ rsvpEnabled: true, rsvp: 'not_coming' })])).toHaveLength(0);
  });
});
