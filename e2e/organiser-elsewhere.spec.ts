import { test, expect } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { HOSTS, removeThrowawayWorkspaces, stagingService } from './helpers.js';

// `thread_organiser.user_id` is UNIQUE GLOBALLY — one organiser page per
// person, ever. Somebody who already has one, opening The Thread in a second
// workspace, used to get a 500 saying "failed to provision organiser"
// (v1.140.0 made it a 403 with a sentence they can act on) and then, because
// four pages called `/api/v1/thread/me` without catching it, an
// "Application error: a server-side exception has occurred" crash page —
// which is what the person actually saw, so the sentence reached nobody.
//
// v1.141.0 moved the check into the Thread LAYOUT and hands the person back
// to The Fibre with a popup.
//
// Two tests, and the SECOND one is the one that matters most. The fix runs in
// the layout of every Thread page, so a false positive would send every
// normal organiser home — a far worse bug than the one being fixed. "The 403
// person now gets a popup" is only half an answer; "and nobody else notices"
// is the other half.
//
// Written after hand-injected auth cookies produced crash pages of their own
// (`Invalid UTF-8 sequence` inside getClaims, visible only in the Vercel
// runtime log) and made both cases unreadable. The sso_handoff landing route
// below is the harness the rest of this suite uses and the one real sessions
// get; the lesson was to stop hand-rolling the session.

type Person = {
  email: string;
  authUserId: string;
  workspaceId: string;
  userRowId: string;
  organiserId: string;
  /** Only for the elsewhere case: the workspace the organiser row sits in. */
  otherWorkspaceId?: string;
  otherUserRowId?: string;
};

const s = () => stagingService();

async function workspace(name: string): Promise<string> {
  const { data, error } = await s()
    .from('workspace')
    .insert({ slug: `e2e-orgelse-${randomUUID().slice(0, 8)}`, name })
    .select('id')
    .single();
  if (error) throw new Error(`workspace: ${error.message}`);
  return data!.id as string;
}

async function threadAppId(): Promise<string> {
  const { data, error } = await s().from('app').select('id').eq('slug', 'the-thread').single();
  if (error) throw new Error(`app: ${error.message}`);
  return data!.id as string;
}

/** A person with Thread switched on and a seat in `workspaceId`. */
async function seatedIn(email: string, workspaceId: string): Promise<string> {
  const { data, error } = await s()
    .from('user')
    .insert({ workspace_id: workspaceId, email, full_name: 'E2E Organiser' })
    .select('id')
    .single();
  if (error) throw new Error(`user row: ${error.message}`);
  const userRowId = data!.id as string;

  const { error: wmErr } = await s()
    .from('workspace_member')
    .upsert({ workspace_id: workspaceId, user_id: userRowId, workspace_role: 'admin' });
  if (wmErr) throw new Error(`workspace_member: ${wmErr.message}`);

  const appId = await threadAppId();
  const { error: waErr } = await s()
    .from('workspace_app')
    .upsert({ workspace_id: workspaceId, app_id: appId }, { onConflict: 'workspace_id,app_id' });
  if (waErr) throw new Error(`workspace_app: ${waErr.message}`);
  const { error: amErr } = await s()
    .from('app_membership')
    .upsert({ user_id: userRowId, app_id: appId, role: 'admin' }, { onConflict: 'user_id,app_id' });
  if (amErr) throw new Error(`app_membership: ${amErr.message}`);
  return userRowId;
}

async function organiserRow(workspaceId: string, userRowId: string, tag: string): Promise<string> {
  const { data, error } = await s()
    .from('thread_organiser')
    .insert({
      workspace_id: workspaceId,
      user_id: userRowId,
      slug: `e2e-orgelse-${tag}`,
      display_name: 'E2E Organiser',
    })
    .select('id')
    .single();
  if (error) throw new Error(`thread_organiser: ${error.message}`);
  return data!.id as string;
}

async function authUser(email: string): Promise<string> {
  const { data, error } = await s().auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error(`auth user: ${error?.message}`);
  return data.user.id;
}

/** Thread access AND the organiser row in the SAME workspace: the healthy
 *  shape, which the layout must leave completely alone. */
async function makeHealthy(): Promise<Person> {
  const tag = randomUUID().slice(0, 8);
  const email = `e2e-orgok-${tag}@example.com`;
  const authUserId = await authUser(email);
  const workspaceId = await workspace(`e2e orgelse OK ${tag}`);
  const userRowId = await seatedIn(email, workspaceId);
  const organiserId = await organiserRow(workspaceId, userRowId, tag);
  return { email, authUserId, workspaceId, userRowId, organiserId };
}

/** Thread access HERE, the one organiser row THERE. */
async function makeElsewhere(): Promise<Person> {
  const tag = randomUUID().slice(0, 8);
  const email = `e2e-orgelse-${tag}@example.com`;
  const authUserId = await authUser(email);
  const here = await workspace(`e2e orgelse HERE ${tag}`);
  const there = await workspace(`e2e orgelse THERE ${tag}`);
  const userHere = await seatedIn(email, here);
  // The organiser row is owned by the person's user row in HERE but carries
  // THERE's workspace_id. That asymmetry is the whole point, and it is worth
  // being explicit about why:
  //
  //   `thread_organiser.user_id` is UNIQUE and references `public.user(id)`,
  //   and `public.user` is PER WORKSPACE — one row per workspace for the same
  //   email. So giving the person a second user row in THERE and hanging the
  //   organiser row off THAT does NOT collide: the two user ids differ, the
  //   handler provisions happily, and nothing is reproduced. (Tried first;
  //   the test passed for the wrong reason, which is how this was found.)
  //
  // The state below — one user row, an organiser row pointing at another
  // workspace — is therefore the only shape that reaches the branch. It is
  // NOT a state the app can create: the handler always provisions with the
  // token's own workspace, which is by construction the workspace of the
  // user row the access-token hook picked. It can only arise from data moved
  // underneath the app (a merge, a workspace move, a migration, a repair by
  // hand). That is worth knowing about the fix this spec covers, and it is
  // recorded here rather than left for the next person to re-derive.
  const organiserId = await organiserRow(there, userHere, tag);
  // HERE is the active workspace — the one the token resolves to.
  const { error } = await s()
    .from('user_active_workspace')
    .upsert(
      { auth_user_id: authUserId, workspace_id: here, updated_at: new Date().toISOString() },
      { onConflict: 'auth_user_id' },
    );
  if (error) throw new Error(`user_active_workspace: ${error.message}`);
  return {
    email,
    authUserId,
    workspaceId: here,
    userRowId: userHere,
    organiserId,
    otherWorkspaceId: there,
  };
}

/** Sign-in the way the rest of this suite does it: a handoff code minted
 *  straight into staging, redeemed by the real landing route. */
async function landUrl(p: Person, next: string): Promise<string> {
  const code = `e2e-${randomBytes(24).toString('base64url')}`;
  const { error } = await s().from('sso_handoff').insert({
    code,
    user_id: p.authUserId,
    email: p.email,
    target_app: 'the-thread',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  });
  if (error) throw new Error(`handoff: ${error.message}`);
  return `${HOSTS.thread}/sso/land?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`;
}

// The pin list and the reporting live in e2e/helpers.ts, because every
// browser spec that makes a throwaway workspace needs exactly this and the
// pins are not guessable (sso_match_log, the trigger-made organisation, the
// user⇄person pair). The first version of this was local, discarded its
// results, and left fifteen workspaces standing.
async function cleanup(p: Person | undefined) {
  if (!p) return;
  // thread_organiser references user(id), so it goes before the helper
  // removes the user rows. It is this spec's own table, not a general pin.
  const { error } = await s().from('thread_organiser').delete().eq('id', p.organiserId);
  if (error) throw new Error(`thread_organiser was not removed: ${error.message}`);
  const aw = await s().from('user_active_workspace').delete().eq('auth_user_id', p.authUserId);
  if (aw.error) throw new Error(`user_active_workspace was not removed: ${aw.error.message}`);
  await removeThrowawayWorkspaces({
    workspaceIds: [p.workspaceId, p.otherWorkspaceId].filter(Boolean) as string[],
    userIds: [p.userRowId, p.otherUserRowId].filter(Boolean) as string[],
    authUserIds: [p.authUserId],
  });
}

test.describe('The Thread — the organiser identity is in another workspace', () => {
  let elsewhere: Person;
  let healthy: Person;

  test.beforeAll(async () => {
    elsewhere = await makeElsewhere();
    healthy = await makeHealthy();
  });
  // BOTH, then report. The first version awaited them in sequence, so when
  // the elsewhere cleanup threw — which is its job — the healthy one never
  // ran and leaked its own workspace. A cleanup that reports failure has to
  // be sequenced so that reporting does not prevent the rest of the cleanup.
  test.afterAll(async () => {
    const failures: string[] = [];
    for (const p of [elsewhere, healthy]) {
      try {
        await cleanup(p);
      } catch (e) {
        failures.push(e instanceof Error ? e.message : String(e));
      }
    }
    if (failures.length) throw new Error(failures.join('\n'));
  });

  // THE REGRESSION TEST, and the more important of the two. The probe runs in
  // the layout of every Thread page; if it ever answers "elsewhere" for an
  // ordinary organiser, every organiser is bounced out of the app. A crash
  // page counts as failing this too, which is why the body text is asserted
  // and not just the URL.
  test('leaves an ordinary organiser completely alone', async ({ page }) => {
    test.slow();
    for (const next of ['/threads', '/settings/profile', '/threads/new']) {
      await page.goto(await landUrl(healthy, next));
      await page.waitForURL(new RegExp(`thread\\.thefibre\\.tech${next.replace('/', '\\/')}`), {
        timeout: 45_000,
      });
      // Not sent home…
      expect(page.url(), `${next} must not hand an ordinary organiser back`).not.toContain(
        'sent_home',
      );
      // …and not crashed. This is the string the four uncaught 403s produced,
      // and the string a hand-injected cookie produced while this was being
      // written, so it is worth asserting by name.
      await expect(page.locator('body'), `${next} rendered a crash page`).not.toContainText(
        'Application error',
      );
    }
  });

  test('hands the person back to The Fibre and says what is wrong', async ({ page }) => {
    test.slow();
    await page.goto(await landUrl(elsewhere, '/settings/profile'));

    await page.waitForURL(/thefibre\.tech\/dashboard\?.*sent_home=organiser-elsewhere/, {
      timeout: 45_000,
    });

    // Scoped by its text, not by role alone: The Fibre's LauncherOverlay is
    // also role="dialog" and pops once per browser session, so a bare role
    // matches two elements and the spec dies on strict mode rather than on
    // anything being wrong. (Learned by no-access.spec.ts; same trap here.)
    const popup = page.getByRole('dialog').filter({ hasText: 'Back in The Fibre' });
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('The Thread');
    // The words that make it actionable: one page per person, and what to do.
    await expect(popup).toContainText('one organiser page');
    await expect(popup).toContainText("workspace hasn't changed");

    // The other workspace is none of this one's business. Naming it would be
    // friendlier and would tell this workspace where somebody else belongs —
    // the API's own 403 withholds it and an integration test asserts that, so
    // the popup must not undo it.
    const body = await page.locator('body').innerText();
    expect(body).not.toContain(`e2e orgelse THERE`);
    expect(body).not.toContain(elsewhere.otherWorkspaceId!);
  });
});
