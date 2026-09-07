// The archived-workspace cache — the gate's data half. Its two deliberate
// behaviors get locked here so nobody "fixes" them (v0.51.2 design):
// stale-on-error (an errored refresh keeps the old set — never empty,
// which would UNLOCK archived workspaces) and full-TTL backoff after an
// error (never hot-loop the database).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state: { rows: { id: string }[]; fail: boolean; calls: number } = {
  rows: [],
  fail: false,
  calls: 0,
};

vi.mock('../db.js', () => ({
  adminClient: {
    from: () => ({
      select: () => ({
        not: async () => {
          state.calls += 1;
          if (state.fail) throw new Error('db down');
          return { data: state.rows };
        },
      }),
    }),
  },
}));

const { isWorkspaceArchived, invalidateArchivedCache } = await import('./archived-workspaces.js');

beforeEach(() => {
  vi.useFakeTimers();
  state.rows = [];
  state.fail = false;
  state.calls = 0;
  invalidateArchivedCache();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('isWorkspaceArchived', () => {
  it('answers from one refresh: archived true, others false', async () => {
    state.rows = [{ id: 'ws-a' }];
    expect(await isWorkspaceArchived('ws-a')).toBe(true);
    expect(await isWorkspaceArchived('ws-b')).toBe(false);
    expect(state.calls).toBe(1); // second check rode the cache
  });

  it('re-reads only after the TTL', async () => {
    state.rows = [{ id: 'ws-a' }];
    await isWorkspaceArchived('ws-a');
    state.rows = []; // unarchived in the DB…
    expect(await isWorkspaceArchived('ws-a')).toBe(true); // …but cache holds
    vi.advanceTimersByTime(61_000);
    expect(await isWorkspaceArchived('ws-a')).toBe(false); // TTL passed → re-read
    expect(state.calls).toBe(2);
  });

  it('stale-on-error: an errored refresh keeps the old set (never unlocks)', async () => {
    state.rows = [{ id: 'ws-a' }];
    await isWorkspaceArchived('ws-a');
    vi.advanceTimersByTime(61_000);
    state.fail = true;
    expect(await isWorkspaceArchived('ws-a')).toBe(true); // stale answer, not empty
  });

  it('backs off a full TTL after an error (no hot-loop)', async () => {
    state.fail = true;
    await isWorkspaceArchived('ws-a');
    const after = state.calls;
    await isWorkspaceArchived('ws-a');
    await isWorkspaceArchived('ws-b');
    expect(state.calls).toBe(after); // within the backoff window: no new reads
    vi.advanceTimersByTime(61_000);
    state.fail = false;
    state.rows = [{ id: 'ws-b' }];
    expect(await isWorkspaceArchived('ws-b')).toBe(true);
  });
});
