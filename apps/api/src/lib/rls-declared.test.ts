// Hard rule 3, checked without a database: every table the migrations create
// in public also has `enable row level security` in the migrations.
//
// rls-floor.int.test.ts asks the live staging database, and it passed for
// months while two tables (`app`, `billing_plan`) had no such statement at
// all: the two Supabase projects were created with RLS switched on for new
// public tables, so the live answer was right for a reason the repository
// does not contain. Rebuilt from these files alone — a third stack, a restore
// into a fresh project — both would have been readable with the anon key
// every browser holds. Migration 20261001165521 says it for those two; this
// test is why a third cannot appear.
import { describe, expect, it } from 'vitest';
import { publicTablesFromMigrations, tablesDeclaringRls } from './migration-tables.js';

const tables = publicTablesFromMigrations();
const declared = new Set(tablesDeclaringRls());

describe('row level security is declared in the migrations', () => {
  it('finds the tables at all', () => {
    // 141 on 2026-10-01. Far fewer means the parser broke, not the schema.
    expect(tables.length).toBeGreaterThan(120);
    for (const t of ['person', 'workspace', 'purchase', 'app', 'billing_plan', 'mcp_grant']) {
      expect(tables, t).toContain(t);
    }
  });

  it('every table says `enable row level security`', () => {
    const silent = tables.filter((t) => !declared.has(t));
    expect(silent, `tables with no RLS statement in any migration: ${silent.join(', ')}`).toEqual([]);
  });

  it('nothing declares RLS for a table the migrations never create (a parser check)', () => {
    const known = new Set(tables);
    const strays = [...declared].filter((t) => !known.has(t));
    expect(strays).toEqual([]);
  });
});
