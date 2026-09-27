import { test, expect } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { HOSTS, stagingService } from './helpers.js';

// The no-access page, with context (v1.79.0). Sjoerd, 2026-09-27, signed in
// with Doab.ai active and opening Thread: the page said "You don't have a
// seat in Thread" — false; the seat was in another workspace. It now names
// the workspace it is talking about and offers the ones where the app is on.
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

  test('names the active workspace, offers the one that runs Thread, and switches', async ({ page }) => {
    test.slow();
    await page.goto(await landUrl(f, '/dashboard'));
    await page.waitForURL(/no-access/, { timeout: 45_000 });

    // The page talks about B by name, not about "a seat in Thread".
    await expect(page.locator('h1')).toContainText(B);
    await expect(page.locator('h1')).toContainText("isn't switched on");
    await expect(page.locator('body')).not.toContainText("You don't have a seat");

    // …and offers A, where Thread is on.
    const cont = page.getByRole('button', { name: `Continue in ${A}` });
    await expect(cont).toBeVisible();
    await cont.click();
    await page.waitForURL(/\/dashboard/, { timeout: 45_000 });
    await expect(page.locator('body')).not.toContainText("isn't switched on");
  });
});
