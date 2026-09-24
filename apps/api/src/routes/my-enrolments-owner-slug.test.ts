import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The two halves of GET /public/my-enrolments have to agree about what a
// thread's public address is.
//
// `lib/public-owner-slug.ts` has its own test for the RULE — the five cases
// of which slug wins. What that test cannot see is the WIRING: the rule needs
// `public_scope` and the workspace's slug, and this route has to have asked
// PostgREST for them. Until 2026-09-24 the route both used a two-way rule and
// selected two-way data, so the two halves agreed with each other and were
// wrong together — the participant portal handed people an organiser address
// for a workspace-scoped thread.
//
// Dropping either field from the select is the regression that matters,
// because it is silent: PostgREST returns the rows without complaint, the
// embed comes back `undefined`, the rule falls through to the organiser, and
// the link still works. Nothing throws. Nothing 404s. The address is just
// quietly not the canonical one, on a page nobody re-reads.
//
// So this reads the source rather than calling the function: what is being
// asserted is that a string in this file names the columns another file
// depends on, and no amount of exercising the handler proves that when the
// data it is exercised with happens to be organiser-scoped anyway. Production
// today is exactly that case — of the eleven threads, the two that are
// workspace-scoped have no enrolments, so this route's real traffic cannot
// currently tell a correct rule from a broken one.

const source = readFileSync(fileURLToPath(new URL('./thread.ts', import.meta.url)), 'utf8');

const selectBlock = (() => {
  const at = source.indexOf("threadRoutes.get('/public/my-enrolments'");
  expect(at, 'the my-enrolments route still exists').toBeGreaterThan(-1);
  const from = source.indexOf('.select(', at);
  return source.slice(from, source.indexOf('.in(', from));
})();

describe('GET /public/my-enrolments selects what the owner-slug rule reads', () => {
  it('asks for public_scope — without it, "workspace" is unreachable', () => {
    expect(selectBlock).toContain('public_scope');
  });

  it('asks for the workspace slug — the address a workspace-scoped thread lives at', () => {
    expect(selectBlock).toMatch(/workspace:workspace_id\s*\(\s*slug\s*\)/);
  });

  it('still asks for the team and organiser slugs, which win in the other cases', () => {
    expect(selectBlock).toMatch(/team:team_id\s*\(/);
    expect(selectBlock).toMatch(/organiser:organiser_id\s*\(/);
  });

  it('builds the URL through the shared rule, not a local re-statement', () => {
    expect(source).toContain("from '../lib/public-owner-slug.js'");
    // The old shape, back in this file, would mean somebody re-derived it.
    expect(source).not.toMatch(/return team\?\.slug \?\? organiserSlug \?\? ''/);
  });
});
