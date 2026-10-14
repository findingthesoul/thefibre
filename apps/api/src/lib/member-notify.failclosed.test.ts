// The new-thread pass FAILS CLOSED. Its failure mode is a mass email: every
// member told about every thread that has been on the calendar all along. So
// each read it depends on is broken here on purpose, one at a time, and the
// count of notifications written must stay at zero. (Coordinator review of
// v1.194.0, 2026-10-14.)
//
// The database is a fake that answers per table, so an error can be put
// exactly where a pooler blip would land. One CONTROL test proves the fake
// is wired well enough for a pass to tell somebody — otherwise every "zero"
// below would pass for the wrong reason.

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Resp = { data: unknown; error: { message: string; code?: string } | null };
type Op = { table: string; calls: [string, unknown[]][] };

const state = {
  respond: (_op: Op): Resp => ({ data: [], error: null }),
  writes: [] as Op[],
  baseline: '2026-01-01T00:00:00Z' as string | null,
  setSetting: vi.fn(async () => undefined),
};

function builder(table: string) {
  const op: Op = { table, calls: [] };
  const b: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'then') {
          const isWrite = op.calls.some(([m]) => ['insert', 'upsert', 'update', 'delete'].includes(m));
          if (isWrite) state.writes.push(op);
          const r = state.respond(op);
          return (res: (v: Resp) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(r).then(res, rej);
        }
        return (...args: unknown[]) => {
          op.calls.push([prop, args]);
          return b;
        };
      },
    },
  );
  return b;
}

vi.mock('../db.js', () => ({ adminClient: { from: (t: string) => builder(t) } }));
vi.mock('./platform-settings.js', () => ({
  getSetting: vi.fn(async () => state.baseline),
  setSetting: (...a: unknown[]) => state.setSetting(...(a as [])),
}));
vi.mock('./could-join.js', async (orig) => ({
  ...(await orig<typeof import('./could-join.js')>()),
  // Every member follows team T.
  entitlementsByMember: vi.fn(async (members: { id: string }[]) => new Map(members.map((m) => [m.id, [{ teamId: 'T', pct: 100 }]]))),
}));

const { runNewThreadPass, HOLD_ABOVE } = await import('./member-notify.js');

const W = 'ws-1';
const threads = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    workspace_id: W,
    team_id: 'T',
    public_enrolment_open: true,
    team: { is_published: true, is_active: true },
    program: { title: `Thread ${i}`, status: 'active', starts_on: '2027-01-01', ends_on: null },
  }));

/** A healthy database with `n` newly visible threads; `broken` overrides. */
function db(n: number, broken: Partial<Record<string, Resp>> = {}) {
  return (op: Op): Resp => {
    const write = op.calls.find(([m]) => ['insert', 'upsert', 'update'].includes(m))?.[0];
    const key = write ? `${op.table}.${write}` : `${op.table}.select`;
    if (broken[key]) return broken[key]!;
    switch (key) {
      case 'thread_thread.select':
        return { data: threads(n), error: null };
      case 'thread_calendar_seen.select':
        return { data: [], error: null };
      case 'membership_settings.select':
        return { data: { notify_members: true }, error: null };
      case 'membership_member.select':
        return { data: [{ id: 'm1', person_id: 'p1', workspace_id: W }], error: null };
      case 'thread_enrolment.select':
        return { data: [], error: null };
      default:
        return { data: null, error: null };
    }
  };
}

const told = () =>
  state.writes
    .filter((w) => w.table === 'member_notification')
    .flatMap((w) => {
      const rows = w.calls.find(([m]) => m === 'insert')?.[1][0];
      return Array.isArray(rows) ? rows : rows ? [rows] : [];
    }).length;

const BOOM = { message: 'pooler went away', code: '08006' };

beforeEach(() => {
  state.writes = [];
  state.baseline = '2026-01-01T00:00:00Z';
  state.setSetting.mockClear();
});

describe('the harness can tell somebody (control)', () => {
  it('two new threads, one follower: two notifications', async () => {
    state.respond = db(2);
    const r = await runNewThreadPass(new Date('2026-10-14T12:00:00Z'));
    expect(r).toMatchObject({ announced: 2, told: 2, held: 0 });
    expect(told()).toBe(2);
  });
});

describe('a failed read tells NOBODY', () => {
  it('the seen-threads read fails → the pass throws, nothing written', async () => {
    state.respond = db(2, { 'thread_calendar_seen.select': { data: null, error: BOOM } });
    await expect(runNewThreadPass()).rejects.toThrow(/seen threads/);
    expect(told()).toBe(0);
  });

  it('the community switch read fails → that community is skipped, nothing written', async () => {
    state.respond = db(2, { 'membership_settings.select': { data: null, error: BOOM } });
    const r = await runNewThreadPass();
    expect(r.told).toBe(0);
    expect(told()).toBe(0);
    // Not even marked seen: next tick judges them again, with a working read.
    expect(state.writes.some((w) => w.table === 'thread_calendar_seen')).toBe(false);
  });

  it('marking threads seen fails → nobody is told about them', async () => {
    state.respond = db(2, { 'thread_calendar_seen.upsert': { data: null, error: BOOM } });
    const r = await runNewThreadPass();
    expect(r.told).toBe(0);
    expect(told()).toBe(0);
  });

  it('the places read fails → the pass throws rather than tell place-holders "new"', async () => {
    state.respond = db(2, { 'thread_enrolment.select': { data: null, error: BOOM } });
    await expect(runNewThreadPass()).rejects.toThrow(/places/);
    expect(told()).toBe(0);
  });
});

describe('the baseline is recorded only with its rows', () => {
  it('the baseline upsert fails → throws, and the baseline key is NOT written', async () => {
    state.baseline = null;
    state.respond = db(3, { 'thread_calendar_seen.upsert': { data: null, error: BOOM } });
    await expect(runNewThreadPass()).rejects.toThrow(/baseline/);
    expect(state.setSetting).not.toHaveBeenCalled();
    expect(told()).toBe(0);
  });

  it('a healthy first pass records the baseline and tells nobody', async () => {
    state.baseline = null;
    state.respond = db(3);
    const r = await runNewThreadPass();
    expect(r).toMatchObject({ baseline: 3, told: 0 });
    expect(state.setSetting).toHaveBeenCalledTimes(1);
    expect(told()).toBe(0);
  });
});

describe('the circuit breaker', () => {
  it(`more than ${HOLD_ABOVE} new threads in one community: held — seen, not announced, logged`, async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    state.respond = db(HOLD_ABOVE + 1);
    const r = await runNewThreadPass();
    expect(r).toMatchObject({ told: 0, held: HOLD_ABOVE + 1 });
    expect(told()).toBe(0);
    expect(warn).toHaveBeenCalledWith(`[member-notify] held ${HOLD_ABOVE + 1} threads for ${W}`);
    const seenWrite = state.writes.find((w) => w.table === 'thread_calendar_seen');
    const rows = seenWrite?.calls.find(([m]) => m === 'upsert')?.[1][0] as { announced: boolean }[];
    expect(rows).toHaveLength(HOLD_ABOVE + 1);
    expect(rows.every((r) => r.announced === false)).toBe(true);
    // Marked as HELD, so an admin is offered the decision.
    expect(rows.every((r) => typeof (r as { held_at?: unknown }).held_at === 'string')).toBe(true);
    warn.mockRestore();
  });

  it('a thread published while the community switch is OFF is not marked held — that was a decision already', async () => {
    state.respond = db(HOLD_ABOVE + 1, { 'membership_settings.select': { data: { notify_members: false }, error: null } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await runNewThreadPass();
    const rows = state.writes
      .find((w) => w.table === 'thread_calendar_seen')
      ?.calls.find(([m]) => m === 'upsert')?.[1][0] as { held_at: string | null }[];
    expect(rows.every((r) => r.held_at === null)).toBe(true);
    warn.mockRestore();
  });

  it(`exactly ${HOLD_ABOVE} is still announced`, async () => {
    state.respond = db(HOLD_ABOVE);
    const r = await runNewThreadPass();
    expect(r).toMatchObject({ told: HOLD_ABOVE, held: 0 });
  });
});
