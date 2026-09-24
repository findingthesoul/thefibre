// The rule that had six hand-written copies, three of which disagreed on the
// same day (2026-09-09). The cases below are exactly the disagreements.

import { describe, expect, it } from 'vitest';
import { publicOwnerSlug } from './public-owner-slug.js';

describe('publicOwnerSlug', () => {
  it('uses the WORKSPACE slug when the thread is workspace-scoped', () => {
    // The one every copy got wrong: team_id is NULL here by design, so
    // `team ?? organiser` falls through to the organiser and emits an
    // address that works but is not the canonical one.
    expect(
      publicOwnerSlug({
        publicScope: 'workspace',
        workspaceSlug: 'ebbf',
        teamSlug: null,
        organiserSlug: 'marja',
      }),
    ).toBe('ebbf');
  });

  it('prefers the team over the organiser for a team thread', () => {
    expect(
      publicOwnerSlug({
        publicScope: 'team',
        workspaceSlug: 'ebbf',
        teamSlug: 'athens',
        organiserSlug: 'marja',
      }),
    ).toBe('athens');
  });

  it('falls back to the organiser for a personal thread', () => {
    expect(
      publicOwnerSlug({
        publicScope: 'organiser',
        workspaceSlug: 'ebbf',
        teamSlug: null,
        organiserSlug: 'marja',
      }),
    ).toBe('marja');
  });

  // A workspace-scoped thread whose workspace slug was never loaded DOES
  // fall through to the organiser, and that is on purpose: brief D2 keeps
  // /{organiser}/{thread} valid as a second address, so a reachable
  // non-canonical URL beats a broken one. Pinned here because it reads like
  // the bug and is not — the bug is failing to LOOK UP the workspace slug.
  it('falls through to the organiser when the workspace slug was not loaded', () => {
    expect(
      publicOwnerSlug({
        publicScope: 'workspace',
        workspaceSlug: undefined,
        teamSlug: null,
        organiserSlug: 'marja',
      }),
    ).toBe('marja');
  });

  it('returns empty when nothing owns it, so callers can skip rather than build /undefined/', () => {
    expect(
      publicOwnerSlug({
        publicScope: null,
        workspaceSlug: null,
        teamSlug: null,
        organiserSlug: null,
      }),
    ).toBe('');
  });
});
