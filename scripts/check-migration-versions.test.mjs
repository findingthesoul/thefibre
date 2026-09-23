// The duplicate-version guard. What it protects against is a SILENT failure:
// Supabase keys its history on the 14 digits, so a second migration on the
// same version is treated as already applied, skipped, and reported as
// success (2026-09-23, two sessions, 20260923140000 twice).

import { describe, expect, it } from 'vitest';
import { clashesIn } from './check-migration-versions.mjs';

const dir = (label, ...files) => ({ label, files });

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
