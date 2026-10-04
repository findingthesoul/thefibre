// The resting state of the Supabase link, per checkout.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkLink, PROD_REF, STAGING_REF } from './check-supabase-link.mjs';

function checkout(ref) {
  const root = mkdtempSync(join(tmpdir(), 'sb-link-'));
  if (ref !== undefined) {
    mkdirSync(join(root, 'supabase/.temp'), { recursive: true });
    writeFileSync(join(root, 'supabase/.temp/project-ref'), ref);
  }
  return root;
}

describe('check-supabase-link', () => {
  it('passes when the link rests on production', () => {
    expect(checkLink(checkout(`${PROD_REF}\n`)).ok).toBe(true);
  });

  it('passes when this checkout has never been linked (a fresh worktree)', () => {
    expect(checkLink(checkout(undefined)).ok).toBe(true);
  });

  it('refuses a link left on staging, naming both projects and the two scripts', () => {
    const r = checkLink(checkout(STAGING_REF));
    expect(r.ok).toBe(false);
    expect(r.message).toContain('STAGING');
    expect(r.message).toContain(STAGING_REF);
    expect(r.message).toContain(PROD_REF);
    expect(r.message).toContain('./scripts/db-push-staging.sh');
    expect(r.message).toContain('./scripts/db-push-prod.sh');
  });

  it('refuses an unknown or empty link too', () => {
    expect(checkLink(checkout('someotherprojectref')).ok).toBe(false);
    expect(checkLink(checkout('')).ok).toBe(false);
  });
});
