import { describe, expect, it, vi } from 'vitest';

// The pure half only: planPushes and payloadFor take everything as arguments,
// including the clock (pinned — a wall-clock test passes in UTC CI and fails
// here). The database half is exercised against staging.
vi.mock('../db.js', () => ({ adminClient: {} }));

import { CAP_PER_DAY, isQuietHour, localHour, payloadFor, planPushes, type PendingRow } from './push-pass.js';
import { isAllowedEndpoint, outcomeFor, deviceLabel } from './web-push.js';

const A = 'anna@example.org';
// 14:00 in Amsterdam (CEST, UTC+2) on 2026-10-16.
const AFTERNOON = new Date('2026-10-16T12:00:00Z');
// 23:30 in Amsterdam.
const NIGHT = new Date('2026-10-16T21:30:00Z');

let n = 0;
function row(over: Partial<PendingRow> = {}): PendingRow {
  n += 1;
  return {
    id: `r${n}`,
    email: A,
    workspace_id: 'W',
    kind: 'session_moved',
    thread_id: 'T1',
    subject: 'Choir rehearsal',
    starts_at: '2026-10-20T18:00:00Z',
    created_at: new Date(AFTERNOON.getTime() - 60_000).toISOString(),
    ...over,
  };
}

function ctx(now: Date, over: { devices?: number; sent?: number; tz?: string } = {}) {
  return {
    now,
    devicesByEmail: new Map([[A, over.devices ?? 1]]),
    sentLast24h: new Map([[A, over.sent ?? 0]]),
    tzByThread: new Map([['T1', over.tz ?? 'Europe/Amsterdam']]),
  };
}

describe('grouping', () => {
  it('sends one push for several changes of one kind to one thread', () => {
    const plan = planPushes([row(), row(), row()], ctx(AFTERNOON));
    expect(plan.send).toHaveLength(1);
    expect(plan.send[0]!.rows).toHaveLength(3);
  });

  it('keeps different threads and kinds apart', () => {
    const plan = planPushes(
      [row(), row({ thread_id: 'T2' }), row({ kind: 'session_cancelled' })],
      ctx(AFTERNOON),
    );
    expect(plan.send).toHaveLength(3);
  });

  it('groups new threads per community, after 15 quiet minutes', () => {
    const old = new Date(AFTERNOON.getTime() - 20 * 60_000).toISOString();
    const plan = planPushes(
      [row({ kind: 'new_thread', created_at: old, thread_id: 'a' }), row({ kind: 'new_thread', created_at: old, thread_id: 'b' })],
      ctx(AFTERNOON),
    );
    expect(plan.send).toHaveLength(1);
    expect(plan.send[0]!.rows).toHaveLength(2);
  });

  it('holds a new-thread burst that is still arriving', () => {
    const recent = new Date(AFTERNOON.getTime() - 5 * 60_000).toISOString();
    const plan = planPushes([row({ kind: 'new_thread', created_at: recent })], ctx(AFTERNOON));
    expect(plan.send).toHaveLength(0);
    expect(plan.hold).toHaveLength(1);
  });
});

describe('quiet hours, 22:00–08:00 in the thread’s timezone', () => {
  it('reads the hour in the thread’s own zone', () => {
    expect(localHour(NIGHT, 'Europe/Amsterdam')).toBe(23);
    expect(localHour(NIGHT, 'America/New_York')).toBe(17);
    expect(isQuietHour(22)).toBe(true);
    expect(isQuietHour(7)).toBe(true);
    expect(isQuietHour(8)).toBe(false);
    expect(isQuietHour(21)).toBe(false);
  });

  it('holds a change at night', () => {
    const plan = planPushes([row({ created_at: new Date(NIGHT.getTime() - 60_000).toISOString() })], ctx(NIGHT));
    expect(plan.send).toHaveLength(0);
    expect(plan.hold).toHaveLength(1);
  });

  it('sends at night when the session starts within 12 hours', () => {
    const soon = new Date(NIGHT.getTime() + 9 * 60 * 60_000).toISOString(); // 08:30 tomorrow
    const plan = planPushes(
      [row({ kind: 'session_cancelled', starts_at: soon, created_at: new Date(NIGHT.getTime() - 60_000).toISOString() })],
      ctx(NIGHT),
    );
    expect(plan.send).toHaveLength(1);
  });

  it('is not quiet at the same moment for a thread in another zone', () => {
    const plan = planPushes(
      [row({ created_at: new Date(NIGHT.getTime() - 60_000).toISOString() })],
      ctx(NIGHT, { tz: 'America/New_York' }),
    );
    expect(plan.send).toHaveLength(1);
  });
});

describe('the cap, and what is never pushed', () => {
  it(`stops at ${CAP_PER_DAY} pushes a day and leaves the rest to the bell`, () => {
    const plan = planPushes([row(), row({ thread_id: 'T2' })], ctx(AFTERNOON, { sent: CAP_PER_DAY - 1 }));
    expect(plan.send).toHaveLength(1);
    expect(plan.skip).toHaveLength(1);
  });

  it('skips a person with no device left', () => {
    const plan = planPushes([row()], ctx(AFTERNOON, { devices: 0 }));
    expect(plan.send).toHaveLength(0);
    expect(plan.skip).toHaveLength(1);
  });

  it('skips a row pending for more than 48 hours rather than deliver it late', () => {
    const plan = planPushes([row({ created_at: '2026-10-14T00:00:00Z' })], ctx(AFTERNOON));
    expect(plan.skip).toHaveLength(1);
  });
});

describe('the lock screen', () => {
  it('says the kind and the subject, in the reader’s language', () => {
    const [g] = planPushes([row()], ctx(AFTERNOON)).send;
    expect(payloadFor(g!, 'en', null)).toEqual({ title: 'Moved: Choir rehearsal', url: '/notifications', tag: 'thread:T1' });
    expect(payloadFor(g!, 'nl', null).title).toBe('Verplaatst: Choir rehearsal');
  });

  it('counts the rest when one push stands for several', () => {
    const [g] = planPushes([row(), row()], ctx(AFTERNOON)).send;
    expect(payloadFor(g!, 'en', null).title).toBe('Moved: Choir rehearsal (+1 more)');
  });

  it('names the community for several new threads', () => {
    const old = new Date(AFTERNOON.getTime() - 20 * 60_000).toISOString();
    const [g] = planPushes(
      [row({ kind: 'new_thread', created_at: old }), row({ kind: 'new_thread', created_at: old })],
      ctx(AFTERNOON),
    ).send;
    expect(payloadFor(g!, 'en', 'Soul.com')).toMatchObject({ title: '2 new on the calendar · Soul.com', tag: 'calendar:W' });
  });
});

describe('where a push may be sent', () => {
  it('allows the four push services, over https only', () => {
    expect(isAllowedEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isAllowedEndpoint('https://web.push.apple.com/QM_abc')).toBe(true);
    expect(isAllowedEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
    expect(isAllowedEndpoint('https://db5p.notify.windows.com/w/?token=abc')).toBe(true);
  });

  it('refuses anything else, including the classic SSRF targets and lookalikes', () => {
    for (const bad of [
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://169.254.169.254/latest/meta-data',
      'https://localhost/x',
      'https://fcm.googleapis.com.evil.example/x',
      'https://evilfcm.googleapis.com/x',
      'https://push.apple.com/x',
      'https://user:pw@fcm.googleapis.com/x',
      'https://fcm.googleapis.com:8443/x',
      'not a url',
      42,
    ]) {
      expect(isAllowedEndpoint(bad), String(bad)).toBe(false);
    }
  });

  it('reads 404 and 410 as gone, any other failure as a failure', () => {
    expect(outcomeFor(201)).toBe('sent');
    expect(outcomeFor(404)).toBe('gone');
    expect(outcomeFor(410)).toBe('gone');
    expect(outcomeFor(429)).toBe('failed');
    expect(outcomeFor(500)).toBe('failed');
    expect(outcomeFor(null)).toBe('failed');
  });

  it('labels a device without keeping the user agent', () => {
    expect(
      deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'),
    ).toBe('iPhone · Safari');
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36')).toBe(
      'Android · Chrome',
    );
    expect(deviceLabel(null)).toBeNull();
  });
});
