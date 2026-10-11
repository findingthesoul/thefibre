// Who is told that Zoom is still waiting on Zoom — and who is not.
//
// Sjoerd asked for a note by the Connect button for everybody except himself.
// Two people must NOT see it, and they are different kinds of exception:
//
//   * HIM. By role (public."user".is_super_admin), never by email address.
//   * THE ZOOM MARKETPLACE REVIEWER. He is testing the very integration the
//     notice calls unapproved; telling him it is "still under request, use
//     Google instead" would undermine the review Sjoerd is waiting on. His
//     account is named nowhere in this codebase — his WORKSPACE carries a
//     flag, and the flag is what is read.
//
// Both are asserted here, along with the thing that makes the test non-
// vacuous: an ordinary member of an ordinary workspace DOES see it. A test
// that only checked the two exemptions would pass against a flag that is
// never true for anybody.
//
// Routes run in process behind the real appContext middleware with real
// minted sessions, the same harness as the merge tenancy tests. Staging only,
// throwaway workspace, every row cleaned by its own id.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import {
  createFixtureUser,
  createThrowawayWorkspace,
  deleteFixtureUser,
  deleteThrowawayWorkspace,
  service,
  type FixtureUser,
} from './staging.js';

let app: Hono;
let ws: string;
let member: FixtureUser;

async function connections(user: FixtureUser) {
  const r = await app.request('/api/v1/meet/connections', {
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      'X-App-ID': 'fibre-platform',
    },
  });
  expect(r.status, 'the connections route should answer').toBe(200);
  return (await r.json()) as { zoom_pending_notice?: boolean };
}

/** Set or clear the per-workspace opt-out, where it actually lives:
 *  `workspace_app.settings` on the PLATFORM app row (20260514160000). No new
 *  table and no migration for something that is coming out again. */
async function setWorkspaceOptOut(on: boolean) {
  const { data: platform, error: appErr } = await service
    .from('app')
    .select('id')
    .eq('slug', 'fibre-platform')
    .single();
  if (appErr) throw new Error(`app lookup: ${appErr.message}`);

  const { data: row, error: rowErr } = await service
    .from('workspace_app')
    .select('id')
    .eq('workspace_id', ws)
    .eq('app_id', platform!.id)
    .maybeSingle();
  if (rowErr) throw new Error(`workspace_app lookup: ${rowErr.message}`);

  const settings = on ? { zoom_notice: 'off' } : {};
  if (row) {
    const { error } = await service
      .from('workspace_app')
      .update({ settings })
      .eq('id', row.id as string);
    if (error) throw new Error(`workspace_app update: ${error.message}`);
  } else {
    const { error } = await service
      .from('workspace_app')
      .insert({ workspace_id: ws, app_id: platform!.id, settings });
    if (error) throw new Error(`workspace_app insert: ${error.message}`);
  }
}

async function setSuperAdmin(on: boolean) {
  const { error } = await service
    .from('user')
    .update({ is_super_admin: on })
    .eq('id', member.userId);
  if (error) throw new Error(`user update: ${error.message}`);
}

beforeAll(async () => {
  const { appContext } = await import('../middleware/app-context.js');
  const { meetRoutes } = await import('../routes/meet.js');
  app = new Hono();
  const v1 = new Hono();
  v1.use('*', appContext);
  v1.route('/meet', meetRoutes);
  app.route('/api/v1', v1);

  ws = await createThrowawayWorkspace('zoom-notice');
  member = await createFixtureUser(ws, 'zoom-notice-member');
}, 120_000);

afterAll(async () => {
  // Each step independently — a chain that throws halfway leaves rows on
  // staging, which is how fifteen workspaces were left there on 2026-10-09.
  const step = async (what: string, run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (e) {
      console.error(`[fixtures] ${what}: ${(e as Error).message}`);
    }
  };
  await step('meet_host', () => service.from('meet_host').delete().eq('workspace_id', ws));
  await step('workspace_app', () => service.from('workspace_app').delete().eq('workspace_id', ws));
  await step('fixture user', async () => {
    if (member) await deleteFixtureUser(member);
  });
  await step('workspace', async () => {
    if (ws) await deleteThrowawayWorkspace(ws);
  });
}, 120_000);

describe('zoom_pending_notice', () => {
  it('is true for an ordinary member of an ordinary workspace', async () => {
    // The assertion that keeps the other three honest: without this, a flag
    // that is false for everybody would satisfy every exemption test below.
    await setSuperAdmin(false);
    await setWorkspaceOptOut(false);
    expect((await connections(member)).zoom_pending_notice).toBe(true);
  });

  it('is false for a super admin — by role, not by email address', async () => {
    await setSuperAdmin(true);
    await setWorkspaceOptOut(false);
    expect((await connections(member)).zoom_pending_notice).toBe(false);
  });

  it('is false for a workspace that has opted out — the reviewer', async () => {
    await setSuperAdmin(false);
    await setWorkspaceOptOut(true);
    expect((await connections(member)).zoom_pending_notice).toBe(false);
  });

  it('comes back as soon as the opt-out is cleared', async () => {
    // The flag is read per request, not cached: removing the row must take
    // effect immediately, the same reason super-admin is read from the
    // database rather than from a JWT claim.
    await setWorkspaceOptOut(false);
    expect((await connections(member)).zoom_pending_notice).toBe(true);
  });
});
