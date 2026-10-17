// The ratchet on the service-role boundary (handbook §2).
//
// Every query through `adminClient` is invisible to row level security, so
// the route is the only thing keeping one workspace from another. Two holes
// of exactly that shape reached production in September 2026. This test makes
// the safe path the default for NEW code: a raw use of the client that is not
// on the baseline fails the release, and the message names the file, line and
// table and what to write instead (lib/tenant-db.ts).
//
// The baseline is every raw use the tree held when the ratchet landed
// (2026-10-17), counted per file and per table+verb. It only shrinks:
// `node apps/api/scripts/service-role-report.mjs --write-baseline` lowers it
// after a module is converted and refuses to raise it. What this cannot see:
// a raw use REPLACED by another of the same table and verb in the same file
// keeps the count level — the diff review is the check for that, as it was
// for everything before this test.
import { afterAll, describe, expect, it } from 'vitest';
// @ts-expect-error — a plain .mjs module shared with the report script
import { howToComply, overBaseline, readBaseline, scan, scanFile } from '../../scripts/lib/service-role-scan.mjs';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { uses, exceptions } = scan();

describe('the service-role boundary', () => {
  it('finds the uses at all (a scanner check)', () => {
    // 1,801 on 2026-10-17. Far fewer without a matching baseline cut means
    // the scanner broke, not that the code improved.
    const baseline = readBaseline();
    const allowed = Object.values(baseline as Record<string, Record<string, number>>)
      .flatMap((k) => Object.values(k))
      .reduce((a, b) => a + b, 0);
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.length).toBeGreaterThan(allowed * 0.5);
    expect(uses.some((u: { key: string }) => u.key === 'person.select')).toBe(true);
  });

  it('no raw service-role use beyond the baseline', () => {
    const over = overBaseline(uses, readBaseline());
    expect(over.length, howToComply(over)).toBe(0);
  });

  it("every serviceRole() names a reason a reviewer can check", () => {
    const bad = exceptions.filter((e: { ok: boolean }) => !e.ok);
    expect(
      bad.map((e: { file: string; line: number }) => `apps/api/src/${e.file}:${e.line}`),
      "serviceRole('<reason>') needs a string literal of 12+ characters: what the query is keyed on instead of the workspace, and why that is safe",
    ).toEqual([]);
  });
});

describe('the scanner itself', () => {
  // Planted files, so a scanner that silently stopped seeing uses fails here
  // and not by passing everything.
  const dir = mkdtempSync(join(tmpdir(), 'service-role-scan-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const plant = (name: string, body: string) => {
    const p = join(dir, name);
    writeFileSync(p, body);
    return scanFile(p);
  };

  it('sees a query, its table and verb, and whether it filters the workspace', () => {
    const r = plant(
      'a.ts',
      `import { adminClient } from '../db.js';
       export const a = () => adminClient.from('person').select('id').eq('id', 'x');
       export const b = () => adminClient.from('person').update({}).eq('workspace_id', 'w');
       export const c = () => adminClient.rpc('member_add', {});`,
    );
    expect(r.uses.map((u: { key: string }) => u.key)).toEqual(['person.select', 'person.update', 'rpc:member_add']);
    expect(r.uses.map((u: { workspaceFiltered: boolean }) => u.workspaceFiltered)).toEqual([false, true, false]);
  });

  it('follows a renamed import and a local alias', () => {
    const r = plant(
      'b.ts',
      `import { adminClient as db } from '../db.js';
       const sb = db;
       export const a = () => sb.from('purchase').delete().eq('id', 'x');
       export const f = (c: unknown) => c;
       f(db);`,
    );
    expect(r.uses.map((u: { key: string }) => u.key)).toEqual(['purchase.delete', 'reference']);
  });

  it('counts serviceRole() as an exception, with or without a good reason', () => {
    const r = plant(
      'c.ts',
      `import { serviceRole } from './tenant-db.js';
       serviceRole('stripe webhook: keyed on the subscription id').from('purchase').select('id');
       serviceRole('short');
       const why = 'computed';
       serviceRole(why);`,
    );
    expect(r.uses).toEqual([]);
    expect(r.exceptions.map((e: { ok: boolean }) => e.ok)).toEqual([true, false, false]);
  });

  it('flags a planted new use against a baseline, with the fix in the message', () => {
    const r = plant('d.ts', `import { adminClient } from '../db.js'; adminClient.from('meet_booking').select('*');`);
    const over = overBaseline(r.uses, {});
    expect(over).toHaveLength(1);
    const msg = howToComply(over);
    expect(msg).toContain('meet_booking.select');
    expect(msg).toContain("tenantDb(ctx).from('<table>')");
    expect(msg).toContain('serviceRole(');
    expect(overBaseline(r.uses, { [r.file]: { 'meet_booking.select': 1 } })).toEqual([]);
  });
});
