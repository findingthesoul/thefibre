// Re-inviting somebody must not quietly change what they are.
//
// `POST /members` upserted `workspace_role` and `relationship_type` straight
// from the invite form, so inviting an existing colleague again — the normal
// way to add them to a team, with the role select sitting at its `organiser`
// default — SILENTLY DEMOTED AN ADMIN. No warning, no record, nothing on the
// screen. The same went for a stated internal relationship being overwritten
// with the form's external.
//
// Found on 2026-10-14 while working out how Sjoerd came to be an organiser in
// a workspace he founded. It is not proof that this is what happened to him
// (nothing logs role changes, so there is no trail either way) — it is a path
// that does it.
//
// Runs against the DEPLOYED staging API, because the rule lives in the route
// on the service role where RLS cannot see it. It needs TWO fixture users: an
// admin to do the inviting, because the route refuses anyone else, and a
// victim to re-invite.
//
// THE ASSERTIONS THAT MATTER are the ones about what did NOT change. A test
// that only checked the invite returned 200 would pass with the bug fully
// present.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  service,
  type FixtureUser,
} from './staging.js';

const API = 'https://thefibre-api-staging.fly.dev';

let ws = '';
let admin: FixtureUser;
let target: FixtureUser;
let team = '';

/** The invite route, as the admin. */
async function invite(body: Record<string, unknown>) {
  const res = await fetch(`${API}/api/v1/members`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${admin.accessToken}`,
      'X-App-ID': 'fibre-platform',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

async function membershipOf(userId: string) {
  const { data, error } = await service
    .from('workspace_member')
    .select('workspace_role, relationship_type')
    .eq('workspace_id', ws)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`membership read: ${error.message}`);
  return data;
}

async function setRole(userId: string, workspace_role: string, relationship_type: string) {
  const { error } = await service
    .from('workspace_member')
    .upsert(
      { workspace_id: ws, user_id: userId, workspace_role, relationship_type },
      { onConflict: 'user_id,workspace_id' },
    );
  if (error) throw new Error(`set role: ${error.message}`);
}

beforeAll(async () => {
  ws = await createThrowawayWorkspace('inviteRole');
  admin = await createFixtureUser(ws, 'inv-admin');
  target = await createFixtureUser(ws, 'inv-target');
  // The inviter must be an admin; the route refuses an organiser outright.
  await setRole(admin.userId, 'super_admin', 'internal');

  // A team to tick on the invite form. Not one of the automatic ones —
  // Everyone and Admins are refused by the route on purpose, since they
  // follow from being a member and from the workspace role.
  const { data, error } = await service
    .from('team')
    .insert({ workspace_id: ws, name: 'ZZ invite team', slug: `zz-invite-${Date.now()}` })
    .select('id')
    .single();
  if (error) throw new Error(`team: ${error.message}`);
  team = data.id as string;
}, 120_000);

afterAll(async () => {
  if (team) {
    await service.from('team_member').delete().eq('team_id', team);
    await service.from('team').delete().eq('id', team);
  }
  if (admin) await deleteFixtureUser(admin);
  if (target) await deleteFixtureUser(target);
  if (ws) await deleteThrowawayWorkspace(ws);
}, 120_000);

describe('re-inviting an existing member', () => {
  it('does NOT lower an admin to the invite form default', async () => {
    await setRole(target.userId, 'admin', 'internal');
    // Exactly the shape the UI sends when somebody is added to a team and
    // the role select was never touched: `organiser` is its default.
    const r = await invite({ email: target.email, workspace_role: 'organiser' });
    expect([200, 201]).toContain(r.status);

    const after = await membershipOf(target.userId);
    expect(after?.workspace_role, 'an invite must never demote an existing member').toBe('admin');
  });

  it('does NOT overwrite a stated internal relationship with external', async () => {
    await setRole(target.userId, 'admin', 'internal');
    const r = await invite({
      email: target.email,
      workspace_role: 'organiser',
      relationship_type: 'external',
    });
    expect([200, 201]).toContain(r.status);

    const after = await membershipOf(target.userId);
    expect(after?.relationship_type, 'a relationship is a statement, not a form default').toBe(
      'internal',
    );
    expect(after?.workspace_role).toBe('admin');
  });

  // The other direction, stated rather than assumed: an invite is not the
  // place to promote either. "Never changes an existing row" is a rule
  // somebody can hold in their head; "changes it upwards only" is not, and
  // PATCH /members/:userId is where role changes belong — it has the
  // sole-admin guard that this route does not.
  it('does NOT raise an organiser either', async () => {
    await setRole(target.userId, 'organiser', 'external');
    const r = await invite({ email: target.email, workspace_role: 'super_admin' });
    expect([200, 201]).toContain(r.status);

    const after = await membershipOf(target.userId);
    expect(after?.workspace_role, 'changing a role is PATCH, not a second invite').toBe(
      'organiser',
    );
  });

  it('still sets the form values for somebody genuinely NEW', async () => {
    // The positive case, so none of the above can be satisfied by an invite
    // route that simply stopped writing memberships.
    const fresh = await createFixtureUser(ws, 'inv-fresh');
    try {
      // createFixtureUser makes the user row but no membership; remove any
      // that exists so this is really the new-row path.
      await service.from('workspace_member').delete().eq('workspace_id', ws).eq('user_id', fresh.userId);
      const r = await invite({
        email: fresh.email,
        workspace_role: 'admin',
        relationship_type: 'external',
      });
      expect([200, 201]).toContain(r.status);
      const after = await membershipOf(fresh.userId);
      expect(after?.workspace_role, 'a new member takes the role the inviter chose').toBe('admin');
      expect(after?.relationship_type).toBe('external');
    } finally {
      await deleteFixtureUser(fresh);
    }
  });
});

// ---------------------------------------------------------------------------
// TEAMS AND APPS, the same class of bug one level down.
//
// `team_member` was upserted with `role: 'member'` and `app_membership` with
// the invite form's role, so the ordinary act of adding a colleague to one
// more team re-ranked them in every team and app they already belonged to.
// ---------------------------------------------------------------------------
describe('re-inviting somebody who is already in the team', () => {
  async function teamRow() {
    const { data, error } = await service
      .from('team_member')
      .select('role, status')
      .eq('team_id', team)
      .eq('user_id', target.userId)
      .maybeSingle();
    if (error) throw new Error(`team_member read: ${error.message}`);
    return data;
  }

  it('does NOT demote a team LEAD to member', async () => {
    const { error } = await service
      .from('team_member')
      .upsert(
        { team_id: team, user_id: target.userId, role: 'lead', status: 'active' },
        { onConflict: 'team_id,user_id' },
      );
    if (error) throw new Error(`seed team admin: ${error.message}`);

    const r = await invite({ email: target.email, teams: [team] });
    expect([200, 201]).toContain(r.status);
    expect((await teamRow())?.role, 'adding somebody to a team is not a statement about their role').toBe(
      'lead',
    );
  });

  it('DOES activate a pending invite, without touching the role', async () => {
    // The team roles are ('lead','member'); a lead can edit the team, so it
    // is the one a re-invite must not quietly take away.
    // `status` is check (status in ('active','invited')): 'invited' is a team
    // lead's two-step invite awaiting the person's own Accept. An admin
    // ticking the box has the authority to put them in directly, so the row
    // must come out active — otherwise the screen says they are in the team
    // and they are not. Both halves asserted, because the first fix skipped
    // every existing row and lost this.
    const { error } = await service
      .from('team_member')
      .upsert(
        { team_id: team, user_id: target.userId, role: 'lead', status: 'invited' },
        { onConflict: 'team_id,user_id' },
      );
    if (error) throw new Error(`seed pending: ${error.message}`);

    const r = await invite({ email: target.email, teams: [team] });
    expect([200, 201]).toContain(r.status);
    const row = await teamRow();
    expect(row?.status, 'a pending row is activated').toBe('active');
    expect(row?.role, 'and the role is still untouched').toBe('lead');
  });

  it('adds somebody who is not in the team at all', async () => {
    // The positive anchor: without it, a route that stopped writing team
    // memberships entirely would satisfy both cases above.
    await service.from('team_member').delete().eq('team_id', team).eq('user_id', target.userId);
    const r = await invite({ email: target.email, teams: [team] });
    expect([200, 201]).toContain(r.status);
    const row = await teamRow();
    expect(row?.role).toBe('member');
    expect(row?.status).toBe('active');
  });
});
