// A grant may only point at its own workspace's team.
//
// The schema can say `team_id` is a uuid. Only a query can say it is one of
// THIS workspace's teams, so the check is at the write and this is the test
// that it bites — against the real tables, in two throwaway workspaces,
// because a tenancy rule tested within one workspace tests nothing.
//
// Why it matters even though nothing pays out today: `memberDiscountFor`
// resolves the member inside the THREAD's workspace, so a foreign team_id can
// never produce a discount. That is the READER being careful. A row that can
// only ever be wrong should not exist, and the day somebody writes a second
// reader — the /my list of what a member could join is the next slice — the
// reader's care is the only thing standing between a foreign grant and a
// price.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';
import { teamIsInWorkspace } from '../lib/grant-config.js';

let mine = '';
let theirs = '';
let myTeam = '';
let theirTeam = '';
let myInactiveTeam = '';

beforeAll(async () => {
  mine = await createThrowawayWorkspace('granttenancy-a');
  theirs = await createThrowawayWorkspace('granttenancy-b');
  const team = async (ws: string, slug: string, active = true) => {
    const { data, error } = await service
      .from('team')
      .insert({ workspace_id: ws, name: slug, slug, is_active: active })
      .select('id')
      .single();
    if (error) throw new Error(`fixture team: ${error.message}`);
    return data!.id as string;
  };
  myTeam = await team(mine, 'tenancy-mine');
  theirTeam = await team(theirs, 'tenancy-theirs');
  myInactiveTeam = await team(mine, 'tenancy-mine-off', false);
}, 120_000);

afterAll(async () => {
  for (const ws of [mine, theirs].filter(Boolean)) await deleteThrowawayWorkspace(ws);
});

describe('teamIsInWorkspace', () => {
  it('accepts a team of this workspace', async () => {
    expect(await teamIsInWorkspace(myTeam, mine)).toEqual({ ok: true });
  });

  it('REFUSES another workspace’s team, by its real id', async () => {
    // The whole point: this id exists, it is a valid team, and it is not
    // theirs to grant.
    const r = await teamIsInWorkspace(theirTeam, mine);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toBe('no such team in this workspace');
  });

  it('says the same thing about a team that does not exist', async () => {
    // One message for "not yours" and "no such thing" — a writer who may not
    // have this team has no business learning whether it exists.
    const absent = await teamIsInWorkspace('00000000-0000-4000-8000-000000000000', mine);
    const foreign = await teamIsInWorkspace(theirTeam, mine);
    expect(absent.ok).toBe(false);
    expect(!absent.ok && absent.message).toBe(!foreign.ok ? foreign.message : '');
  });

  it('refuses a team of this workspace that has been switched off', async () => {
    // `team` has no deleted_at (asked of the database, not assumed): a team is
    // retired with is_active, and an inactive calendar grants nothing.
    const r = await teamIsInWorkspace(myInactiveTeam, mine);
    expect(r.ok).toBe(false);
  });

  it('and the check is symmetric — their team is fine in THEIR workspace', async () => {
    // Otherwise a passing test above could mean "refuses everything".
    expect(await teamIsInWorkspace(theirTeam, theirs)).toEqual({ ok: true });
  });
});
