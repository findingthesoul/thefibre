// The public root namespace helper. Two behaviours are locked here because
// getting either wrong is silent: a row must not read as a conflict with
// ITSELF (which would make renaming a team impossible the moment it holds
// its own address), and a free slug must come back free rather than
// defaulting to "taken" on a miss.

import { describe, expect, it, vi } from 'vitest';

type Row = { kind: string; team_id: string | null; organiser_id: string | null } | null;
const state: { row: Row; askedFor: string | null } = { row: null, askedFor: null };

vi.mock('../db.js', () => ({
  adminClient: {
    from: () => ({
      select: () => ({
        eq: (_col: string, value: string) => {
          state.askedFor = value;
          return { maybeSingle: async () => ({ data: state.row }) };
        },
      }),
    }),
  },
}));

const { rootSlugHolder, slugTakenBy } = await import('./root-slug.js');

describe('rootSlugHolder', () => {
  it('reports nothing for a free address', async () => {
    state.row = null;
    expect(await rootSlugHolder('brand-new')).toBeNull();
  });

  it('names the kind holding a taken address', async () => {
    state.row = { kind: 'workspace', team_id: null, organiser_id: null };
    expect(await rootSlugHolder('soul')).toBe('workspace');
  });

  it('does not let a team collide with itself on a rename', async () => {
    state.row = { kind: 'team', team_id: 'team-1', organiser_id: null };
    expect(await rootSlugHolder('same', { teamId: 'team-1' })).toBeNull();
    expect(await rootSlugHolder('same', { teamId: 'team-2' })).toBe('team');
  });

  it('does not let an organiser collide with itself either', async () => {
    state.row = { kind: 'organiser', team_id: null, organiser_id: 'org-1' };
    expect(await rootSlugHolder('same', { organiserId: 'org-1' })).toBeNull();
    expect(await rootSlugHolder('same', { organiserId: 'org-2' })).toBe('organiser');
  });

  it('asks for the normalised slug — the registry stores it lowercased', async () => {
    state.row = null;
    await rootSlugHolder('  Vertrouwen-Als-De-Basis  ');
    expect(state.askedFor).toBe('vertrouwen-als-de-basis');
  });
});

describe('slugTakenBy', () => {
  it('says who is holding it, in each case', () => {
    expect(slugTakenBy('workspace')).toContain('a workspace');
    expect(slugTakenBy('team')).toContain('another team');
    expect(slugTakenBy('organiser')).toContain('an organiser');
  });
});
