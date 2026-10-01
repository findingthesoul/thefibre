import { test, expect } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { HOSTS, stagingService } from './helpers.js';

// Opening an app the workspace does not run (v1.83.x). Two rounds of history
// here, and the second replaced the first:
//
//   v1.79.0 — Sjoerd, signed in with Doab.ai active and opening Thread, was
//   told "You don't have a seat in Thread". False: the seat was in another
//   workspace. So the page learned to name the workspace and offer the ones
//   where the app is on, with a switch button.
//
//   2026-09-28 — that switch was still a workspace change he had not asked
//   for, and the wall left him standing in an app that cannot serve him:
//   *"In any other case of an error or mistake, go back to the fibre, but
//   never switch workspace automatically"*, *"a comment in a popup"*. The app
//   now hands him back to The Fibre, which explains in a popup, and his
//   workspace is untouched.
//
// Fixture: ONE account (one auth user, one public.user row per workspace —
// the one-account-many-workspaces model) in two throwaway workspaces. A runs
// Thread and the account holds a seat there; B does not run Thread and is the
// ACTIVE one. Every row is ours and is removed after.

const A = `e2e no-access A ${randomUUID().slice(0, 6)}`;
const B = `e2e no-access B ${randomUUID().slice(0, 6)}`;

type Fixture = {
  email: string;
  authUserId: string;
  wsA: string;
  wsB: string;
  userA: string;
  userB: string;
};

async function makeFixture(): Promise<Fixture> {
  const s = stagingService();
  const email = `e2e-noaccess-${randomUUID().slice(0, 8)}@example.com`;
  const { data: created, error: cErr } = await s.auth.admin.createUser({ email, email_confirm: true });
  if (cErr || !created.user) throw new Error(`auth user: ${cErr?.message}`);

  const ws = async (name: string) => {
    const { data, error } = await s
      .from('workspace')
      .insert({ slug: `e2e-noaccess-${randomUUID().slice(0, 8)}`, name })
      .select('id')
      .single();
    if (error) throw new Error(`workspace: ${error.message}`);
    return data!.id as string;
  };
  const wsA = await ws(A);
  const wsB = await ws(B);

  const user = async (workspaceId: string) => {
    const { data, error } = await s.from('user').insert({ workspace_id: workspaceId, email }).select('id').single();
    if (error) throw new Error(`user row: ${error.message}`);
    return data!.id as string;
  };
  const userA = await user(wsA);
  const userB = await user(wsB);
  for (const [w, u] of [[wsA, userA], [wsB, userB]] as const) {
    const { error } = await s.from('workspace_member').upsert({ workspace_id: w, user_id: u, workspace_role: 'admin' });
    if (error) throw new Error(`workspace_member: ${error.message}`);
  }

  const { data: app, error: aErr } = await s.from('app').select('id').eq('slug', 'the-thread').single();
  if (aErr) throw new Error(`app: ${aErr.message}`);
  const { error: waErr } = await s.from('workspace_app').insert({ workspace_id: wsA, app_id: app!.id });
  if (waErr) throw new Error(`workspace_app: ${waErr.message}`);
  const { error: amErr } = await s
    .from('app_membership')
    .upsert({ user_id: userA, app_id: app!.id, role: 'admin' }, { onConflict: 'user_id,app_id' });
  if (amErr) throw new Error(`app_membership: ${amErr.message}`);

  // B is the active one — the wrong one for Thread.
  const { error: awErr } = await s
    .from('user_active_workspace')
    .upsert({ auth_user_id: created.user.id, workspace_id: wsB, updated_at: new Date().toISOString() }, { onConflict: 'auth_user_id' });
  if (awErr) throw new Error(`user_active_workspace: ${awErr.message}`);

  return { email, authUserId: created.user.id, wsA, wsB, userA, userB };
}

async function landUrl(f: Fixture, next: string): Promise<string> {
  const s = stagingService();
  const code = `e2e-${randomBytes(24).toString('base64url')}`;
  const { error } = await s.from('sso_handoff').insert({
    code,
    user_id: f.authUserId,
    email: f.email,
    target_app: 'the-thread',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  });
  if (error) throw new Error(`handoff: ${error.message}`);
  return `${HOSTS.thread}/sso/land?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`;
}

async function cleanup(f: Fixture) {
  const s = stagingService();
  await s.from('user_active_workspace').delete().eq('auth_user_id', f.authUserId);
  await s.from('app_membership').delete().in('user_id', [f.userA, f.userB]);
  await s.from('workspace_member').delete().in('user_id', [f.userA, f.userB]);
  await s.from('user').delete().in('id', [f.userA, f.userB]);
  await s.auth.admin.deleteUser(f.authUserId).catch(() => undefined);
  await s.from('workspace').delete().in('id', [f.wsA, f.wsB]);
}

test.describe('Thread — no access in THIS workspace', () => {
  let f: Fixture;
  test.beforeAll(async () => {
    f = await makeFixture();
  });
  test.afterAll(async () => {
    if (f) await cleanup(f);
  });

  test('hands you back to The Fibre, says why, and leaves your workspace alone', async ({ page }) => {
    test.slow();
    await page.goto(await landUrl(f, '/dashboard'));

    // Sjoerd, 2026-09-28: *"In any other case of an error or mistake, go back
    // to the fibre, but never switch workspace automatically"* — and *"a
    // comment in a popup"*. This replaces the wall-with-a-switch this spec
    // asserted in v1.79.0: the wall left you standing in an app that cannot
    // serve you, and its switch moved your workspace for you.
    await page.waitForURL(/thefibre\.tech\/dashboard\?.*sent_home=no-access/, { timeout: 45_000 });

    // The popup names the app that could not serve, and the workspace you are
    // in — the two facts that make the jump comprehensible.
    //
    // Scoped by its text, NOT `getByRole('dialog')` alone. The Fibre's
    // LauncherOverlay is also role="dialog" aria-modal="true" and pops once
    // per browser session, which is every fresh Playwright context — so the
    // bare role matched two elements and the spec died on strict mode ("two
    // dialogs where one is expected") rather than on anything being wrong
    // with the page. `getByRole('dialog', { name })` is not the fix either:
    // the shared Dialog renders its title in a header without
    // aria-labelledby, so it has no accessible name to match on.
    const popup = page.getByRole('dialog').filter({ hasText: 'Back in The Fibre' });
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('The Thread');
    await expect(popup).toContainText(B);

    // The load-bearing assertion: B is STILL the workspace. Being sent home
    // is not a switch. If this ever goes green while the chrome says A, the
    // rule has been broken somewhere upstream.
    await expect(popup).toContainText("workspace hasn't changed");
    await popup.getByRole('button', { name: 'Got it' }).click();
    await expect(popup).toBeHidden();
    await expect(page.locator('body')).toContainText(B);

    // And the explanation does not replay on the next visit. Scoped the same
    // way: the launcher may legitimately be on screen here, and asserting no
    // dialog at all would fail for the wrong reason.
    await page.reload();
    await expect(page.getByRole('dialog').filter({ hasText: 'Back in The Fibre' })).toHaveCount(0);
  });
});
