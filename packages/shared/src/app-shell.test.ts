import { describe, expect, it } from 'vitest';
import { ApiError, type ApiFetch } from './api-fetch.js';
import { loadAppShell } from './app-shell.js';

const me = {
  user: { id: 'u1', email: 'a@b.c', full_name: 'A' },
  workspace: { id: 'w1', name: 'W' },
  memberships: [{ app: { slug: 'the-thread' }, role: 'admin' }],
  locale: 'nl',
};

/** An apiFetch that records the ORDER calls were started in and answers after a tick. */
function fakeApi(answers: Record<string, unknown>, started: string[] = []): ApiFetch {
  return (async <T,>(path: string) => {
    started.push(path);
    await new Promise((r) => setTimeout(r, 5));
    const a = answers[path];
    if (a instanceof Error) throw a;
    return a as T;
  }) as ApiFetch;
}

const ANSWERS = {
  '/api/v1/auth/me': me,
  '/api/v1/workspace-apps': { items: [{ deactivated_at: null, app: { slug: 'the-thread' } }] },
  '/api/v1/auth/workspaces': {
    workspaces: [
      { id: 'w1', name: 'W', slug: 'w', is_active: true, has_app: true },
      { id: 'w2', name: 'X', slug: 'x', is_active: false, has_app: false },
    ],
  },
};

describe('loadAppShell', () => {
  it('starts every call before any of them answers (the point of it)', async () => {
    const started: string[] = [];
    let extraStartedAt = -1;
    const shell = await loadAppShell({
      apiFetch: fakeApi(ANSWERS, started),
      appSlug: 'the-thread',
      extras: {
        prefs: async () => {
          extraStartedAt = started.length;
          return { theme: 'dark' };
        },
      },
    });
    expect(shell.ok).toBe(true);
    // All three API calls were on the wire before the extra ran, and the
    // extra ran before anything had answered (they answer after 5 ms).
    expect(started).toHaveLength(3);
    expect(extraStartedAt).toBe(3);
    if (shell.ok) expect(shell.extras.prefs).toEqual({ theme: 'dark' });
  });

  it('gates on membership AND activation, and filters workspaces to has_app', async () => {
    const shell = await loadAppShell({ apiFetch: fakeApi(ANSWERS), appSlug: 'the-thread' });
    expect(shell.ok && shell.hasAccess).toBe(true);
    if (shell.ok) expect(shell.workspaces.map((w) => w.id)).toEqual(['w1']);

    const noActivation = await loadAppShell({
      apiFetch: fakeApi({ ...ANSWERS, '/api/v1/workspace-apps': { items: [] } }),
      appSlug: 'the-thread',
    });
    expect(noActivation.ok && noActivation.hasAccess).toBe(false);

    const otherApp = await loadAppShell({ apiFetch: fakeApi(ANSWERS), appSlug: 'fibre-meet' });
    expect(otherApp.ok && otherApp.hasAccess).toBe(false);
  });

  it('the platform always has access', async () => {
    const shell = await loadAppShell({
      apiFetch: fakeApi({ ...ANSWERS, '/api/v1/workspace-apps': { items: [] } }),
      appSlug: 'fibre-platform',
    });
    expect(shell.ok && shell.hasAccess).toBe(true);
  });

  it('a 401 is no-session; any other failure of /auth/me is no-access', async () => {
    const out = await loadAppShell({
      apiFetch: fakeApi({ ...ANSWERS, '/api/v1/auth/me': new ApiError(401, 'no session') }),
      appSlug: 'the-thread',
    });
    expect(out).toEqual({ ok: false, reason: 'no-session' });
    const down = await loadAppShell({
      apiFetch: fakeApi({ ...ANSWERS, '/api/v1/auth/me': new ApiError(500, 'boom') }),
      appSlug: 'the-thread',
    });
    expect(down).toEqual({ ok: false, reason: 'no-access' });
  });

  it('a failing workspace list does not take the page down', async () => {
    const shell = await loadAppShell({
      apiFetch: fakeApi({ ...ANSWERS, '/api/v1/auth/workspaces': new ApiError(500, 'x') }),
      appSlug: 'the-thread',
    });
    expect(shell.ok).toBe(true);
    if (shell.ok) expect(shell.workspaces).toEqual([]);
  });

  // staleWorkspace — the token's workspace against the one last chosen.
  //
  // It is gated on has_app, and that gate is the point. A true here makes the
  // app refresh its session (ui/workspace-sync.tsx), and the access-token hook
  // stamps the CHOSEN workspace whatever app is asking — so saying true for a
  // workspace this app cannot serve would throw the person out of the app they
  // just opened, to fix a cosmetic disagreement. These four cases are the
  // whole truth table that matters.
  const withChoice = (chosen: string | null, w2HasApp: boolean) => ({
    ...ANSWERS,
    '/api/v1/auth/workspaces': {
      active_workspace_id: 'w1',
      chosen_workspace_id: chosen,
      workspaces: [
        { id: 'w1', name: 'W', slug: 'w', is_active: true, has_app: true },
        { id: 'w2', name: 'X', slug: 'x', is_active: false, has_app: w2HasApp },
      ],
    },
  });

  it('is not stale when the token is already in the chosen workspace', async () => {
    const shell = await loadAppShell({ apiFetch: fakeApi(withChoice('w1', true)), appSlug: 'the-thread' });
    expect(shell.ok && shell.staleWorkspace).toBe(false);
    if (shell.ok) expect(shell.staleWorkspaceKey).toBeNull();
  });

  it('is not stale when nothing was ever chosen', async () => {
    const shell = await loadAppShell({ apiFetch: fakeApi(withChoice(null, true)), appSlug: 'the-thread' });
    expect(shell.ok && shell.staleWorkspace).toBe(false);
  });

  it('is stale when the choice is elsewhere AND this app can serve it there', async () => {
    const shell = await loadAppShell({ apiFetch: fakeApi(withChoice('w2', true)), appSlug: 'the-thread' });
    expect(shell.ok && shell.staleWorkspace).toBe(true);
    // The key names THIS disagreement, so the reader can attempt it once and
    // not reload forever if it does not resolve.
    if (shell.ok) expect(shell.staleWorkspaceKey).toBe('w1->w2');
  });

  // The one that protects somebody rather than tidying something: refreshing
  // here would move this app into w2, where they hold no seat for it, and the
  // shell's own access check would then hand them back to The Fibre.
  it('is NOT stale when this app cannot serve the chosen workspace', async () => {
    const shell = await loadAppShell({ apiFetch: fakeApi(withChoice('w2', false)), appSlug: 'the-thread' });
    expect(
      shell.ok && shell.staleWorkspace,
      'a refresh here would bounce the person out of the app they just opened',
    ).toBe(false);
  });

});
