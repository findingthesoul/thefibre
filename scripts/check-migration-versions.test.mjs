// The duplicate-version guard. What it protects against is a SILENT failure:
// Supabase keys its history on the 14 digits, so a second migration on the
// same version is treated as already applied, skipped, and reported as
// success (2026-09-23, two sessions, 20260923140000 twice).

import { describe, expect, it } from 'vitest';
import { clashesIn, outOfOrder } from './check-migration-versions.mjs';

const dir = (label, ...files) => ({ label, files });

// The ordering guard. `supabase db push` refuses a migration that sorts
// before an already-applied one, so a commit carrying an OLDER version than
// the newest on staging passed every gate and failed only at the push, after
// it was on staging (membership 2026-10-04, Meet 2026-10-06).
describe('outOfOrder', () => {
  const staging = ['20261004070803_a.sql', '20261005210243_b.sql', '20261006090000_c.sql'];

  it('refuses a new file older than the newest on staging, naming both versions', () => {
    const r = outOfOrder([...staging, '20261005230000_late.sql'], staging);
    expect(r.newest).toBe('20261006090000');
    expect(r.late).toEqual([{ file: '20261005230000_late.sql', version: '20261005230000' }]);
  });

  it('passes a new file newer than everything on staging', () => {
    const r = outOfOrder([...staging, '20261006120000_fresh.sql'], staging);
    expect(r.late).toEqual([]);
  });

  it('never flags a file that is already on staging, however old', () => {
    // A checkout that is BEHIND staging holds older files too; they are
    // applied history, not a late arrival.
    expect(outOfOrder(staging, staging).late).toEqual([]);
    expect(outOfOrder(staging.slice(0, 2), staging).late).toEqual([]);
  });

  it('has nothing to compare against when staging holds no migrations', () => {
    const r = outOfOrder(['20260101000000_first.sql'], ['README.md']);
    expect(r.newest).toBeNull();
    expect(r.late).toEqual([]);
  });
});

describe('clashesIn', () => {
  it('passes when every version is used once', () => {
    const r = clashesIn([
      dir('this checkout', '20260923140000_a.sql', '20260923150000_b.sql'),
      dir('worktree x', '20260101090000_c.sql'),
    ]);
    expect(r.clashes).toEqual([]);
    expect(r.versions).toBe(3);
  });

  it('catches two different files on one version, across checkouts', () => {
    const r = clashesIn([
      dir('this checkout', '20260923140000_meet_host_busy_includes_free.sql'),
      dir('worktree thread-todos', '20260923140000_thread_task.sql'),
    ]);
    expect(r.clashes).toHaveLength(1);
    const [version, list] = r.clashes[0];
    expect(version).toBe('20260923140000');
    expect(list.map((e) => e.label)).toEqual(['this checkout', 'worktree thread-todos']);
  });

  it('does not flag the same file present in two checkouts', () => {
    const r = clashesIn([
      dir('this checkout', '20260923140000_same.sql'),
      dir('worktree x', '20260923140000_same.sql'),
    ]);
    expect(r.clashes).toEqual([]);
    expect(r.versions).toBe(1);
  });

  it('ignores files that are not migrations', () => {
    const r = clashesIn([dir('this checkout', 'README.md', '2026_short.sql', '.DS_Store')]);
    expect(r.versions).toBe(0);
    expect(r.clashes).toEqual([]);
  });
});
