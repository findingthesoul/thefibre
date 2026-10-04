// The staging sweep's rules: opt-in, and the fixtures are untouchable.
import { describe, expect, it } from 'vitest';
import { classify, HARNESS, isOrphanTestAccount, PERMANENT_ACCOUNTS, PERMANENT_WORKSPACES } from '../apps/api/scripts/lib/sweep-rules.mjs';

const ws = (slug, name, id = slug) => ({ id, slug, name, created_at: '2026-10-01T00:00:00Z' });
const permanent = PERMANENT_WORKSPACES.map((s) => ws(s, 'Permanent test fixtures'));

describe('what the sweep may touch', () => {
  it('takes a workspace only when slug AND name are the harness’s', () => {
    const r = classify([
      ...permanent,
      ws('int-test-merge-f4bde6c8', 'Integration test merge'),
      ws('int-test-rlsA-8fa5b8d7', 'Integration test rlsA'),
      ws('e2e-noaccess-bfb8a73a', 'e2e no-access B a1d17d'),
      ws('first-admin-1790874960208', 'First admin fixture'),
      ws('int-test-merge-aaaaaaaa', 'Somebody renamed me'),
      ws('default', 'The Thread', 'ca0569d5-0000'),
      ws('solido-ucm6', 'Solido'),
      ws('retired-int-test-enrol-d3294025', 'retired'),
    ]);
    expect(r.candidates.map((c) => c.slug).sort()).toEqual([
      'e2e-noaccess-bfb8a73a',
      'first-admin-1790874960208',
      'int-test-merge-f4bde6c8',
      'int-test-rlsA-8fa5b8d7',
    ]);
    expect(r.nameMismatch.map((c) => c.slug)).toEqual(['int-test-merge-aaaaaaaa']);
    expect(r.missing).toEqual([]);
    expect(r.illegal).toEqual([]);
  });

  it('never takes a real workspace, whatever it is called', () => {
    const r = classify([...permanent, ws('client-tester', 'Integration test of a client'), ws('cold-mty8fsfp2895', 'First admin fixture')]);
    expect(r.candidates).toEqual([]);
  });
});

describe('the permanent fixtures', () => {
  it('include the browser pack’s workspace and both fixture accounts', () => {
    expect(PERMANENT_WORKSPACES).toContain('e2e-fixtures');
    expect(PERMANENT_WORKSPACES).toContain('int-public-fixtures');
    expect(PERMANENT_ACCOUNTS).toContain('e2e-fixture@example.com');
    expect(PERMANENT_ACCOUNTS).toContain('fixture-organiser@example.com');
  });

  it('no allow-list pattern can match one, by slug', () => {
    for (const slug of PERMANENT_WORKSPACES) {
      for (const h of HARNESS) expect(h.slug.test(slug), `${h.label} matches ${slug}`).toBe(false);
    }
  });

  it('a missing fixture is reported, so the script refuses to run', () => {
    const r = classify(permanent.filter((w) => w.slug !== 'e2e-fixtures'));
    expect(r.missing).toEqual(['e2e-fixtures']);
  });

  it('the rehearsal workspace is never a candidate even if its slug looked like a test', () => {
    const r = classify([...permanent, ws('int-test-oops-deadbeef', 'Integration test oops', 'ca0569d5-1234')]);
    expect(r.candidates).toEqual([]);
    expect(r.illegal.map((w) => w.slug)).toEqual(['int-test-oops-deadbeef']);
  });

  it('the fixture accounts are never counted as orphans', () => {
    const seats = new Set();
    expect(isOrphanTestAccount('e2e-fixture@example.com', seats)).toBe(false);
    expect(isOrphanTestAccount('fixture-organiser@example.com', seats)).toBe(false);
    expect(isOrphanTestAccount('int-merge-12345678@example.com', seats)).toBe(true);
    expect(isOrphanTestAccount('int-merge-12345678@example.com', new Set(['int-merge-12345678@example.com']))).toBe(false);
    expect(isOrphanTestAccount('a-real-person@soul.com', seats)).toBe(false);
  });
});
