// The accessor's list of tenant tables, checked against the migrations in
// both directions — a hand list is how thirteen new tables once went
// unprobed for two weeks (2026-09-27).
import { describe, expect, it } from 'vitest';
import { publicTablesFromMigrations, tablesWithColumn } from './migration-tables.js';
import { NOT_TENANCY_KEY, TENANT_TABLES } from './tenant-tables.js';

const withColumn = tablesWithColumn('workspace_id');
const listed = new Set<string>(TENANT_TABLES);

describe('TENANT_TABLES agrees with the migrations', () => {
  it('finds the column at all (a parser check)', () => {
    // 110 on 2026-10-17. Far fewer means the parser broke, not the schema.
    expect(withColumn.length).toBeGreaterThan(90);
    for (const t of ['person', 'thread_thread', 'purchase', 'membership_member']) expect(withColumn).toContain(t);
    for (const t of ['workspace', 'person_tag', 'app']) expect(withColumn).not.toContain(t);
  });

  it('every table with a workspace_id is listed (or reviewed out)', () => {
    const missing = withColumn.filter((t) => !listed.has(t) && !(t in NOT_TENANCY_KEY));
    expect(
      missing,
      `tables with a workspace_id column that apps/api/src/lib/tenant-tables.ts does not list — ` +
        `add each to TENANT_TABLES (one line), or to NOT_TENANCY_KEY with the reason: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('nothing is listed that has no workspace_id, or no table', () => {
    const tables = new Set(publicTablesFromMigrations());
    const wrong = TENANT_TABLES.filter((t) => !withColumn.includes(t) || !tables.has(t));
    expect(wrong, `listed in TENANT_TABLES without a workspace_id column: ${wrong.join(', ')}`).toEqual([]);
    for (const t of Object.keys(NOT_TENANCY_KEY)) expect(withColumn).toContain(t);
  });
});
