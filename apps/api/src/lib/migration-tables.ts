// What the migrations say exists, read as text.
//
// Two checks need "every table in public" and neither may keep its own list —
// a hand list is how thirteen new tables went unprobed for two weeks
// (2026-09-27). So the list is derived once, here:
//   - integration/rls-floor.int.test.ts asks the LIVE database whether an
//     anonymous client reads anything from each;
//   - lib/rls-declared.test.ts asks the MIGRATIONS whether each table says
//     `enable row level security`, which is what a database rebuilt from this
//     repository would get.

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const MIGRATIONS_DIR = resolve(import.meta.dirname, '../../../../supabase/migrations');

const NAME = '(?:public\\.)?"?([a-z_][a-z0-9_]*)"?';

/** Every migration, in the order Supabase applies them, `--` comments removed
 *  so a table mentioned in prose is not mistaken for a statement. */
function statements(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(resolve(dir, f), 'utf8').replace(/--[^\n]*/g, ''));
}

/** Every table created in public by the migrations, minus those a later
 *  migration dropped. Order of application = filename order. */
export function publicTablesFromMigrations(dir = MIGRATIONS_DIR): string[] {
  const created = new Set<string>();
  const create = new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${NAME}`, 'gi');
  const drop = new RegExp(`drop\\s+table\\s+(?:if\\s+exists\\s+)?${NAME}`, 'gi');
  const rename = new RegExp(`alter\\s+table\\s+${NAME}\\s+rename\\s+to\\s+"?([a-z_][a-z0-9_]*)"?`, 'gi');
  for (const sql of statements(dir)) {
    for (const m of sql.matchAll(create)) created.add(m[1]!.toLowerCase());
    for (const m of sql.matchAll(rename)) {
      created.delete(m[1]!.toLowerCase());
      created.add(m[2]!.toLowerCase());
    }
    for (const m of sql.matchAll(drop)) created.delete(m[1]!.toLowerCase());
  }
  return [...created].sort();
}

/**
 * Every table some migration switches row level security ON for, minus any a
 * later one switches off — under the name the table has today. A rename
 * carries the setting with it, as it does in Postgres.
 */
export function tablesDeclaringRls(dir = MIGRATIONS_DIR): string[] {
  const on = new Set<string>();
  const enable = new RegExp(`alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?${NAME}\\s+enable\\s+row\\s+level\\s+security`, 'gi');
  const disable = new RegExp(`alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?${NAME}\\s+disable\\s+row\\s+level\\s+security`, 'gi');
  const rename = new RegExp(`alter\\s+table\\s+${NAME}\\s+rename\\s+to\\s+"?([a-z_][a-z0-9_]*)"?`, 'gi');
  for (const sql of statements(dir)) {
    for (const m of sql.matchAll(enable)) on.add(m[1]!.toLowerCase());
    for (const m of sql.matchAll(rename)) {
      if (on.delete(m[1]!.toLowerCase())) on.add(m[2]!.toLowerCase());
    }
    for (const m of sql.matchAll(disable)) on.delete(m[1]!.toLowerCase());
  }
  return [...on].sort();
}
