// What every signed-in app layout needs before it can draw its chrome — who
// you are, which apps this workspace runs, which workspaces you may switch to
// — fetched ONCE, in parallel, in one place.
//
// Until 2026-09-17 each of the seven (app)/layout.tsx files ran the same
// three API calls one after the other, after a network round trip to
// Supabase Auth, on every server render. Measured on staging: /auth/me
// ~500 ms, /auth/workspaces ~380 ms, /workspace-apps ~50 ms, sequential, so
// close to a second of pure waiting before a page's own data was even asked
// for. Here they run together, so the shell costs as much as its slowest
// call, and a layout passes its own extras (prefs, the assistant switch) in
// to ride the same Promise.all.
//
// Shared decides WHAT (the calls, the access rule); the caller decides HOW
// (its apiFetch binding, its redirects). No framework import here.

import type { ApiFetch } from './api-fetch.js';
import { ApiError } from './api-fetch.js';
import type { AppMembershipRow, WorkspaceAppRow } from './available-apps.js';
import type { AppId } from './index.js';

export type ShellMe = {
  user: { id: string; email: string; full_name: string | null; is_super_admin?: boolean | null };
  workspace: { id: string; name: string; slug?: string | null } | null;
  memberships: (AppMembershipRow & { role?: string })[];
  /** The signed-in interface language (identity_profile.locale). */
  locale?: string | null;
  /** Whether this person wants the To do panel (identity_profile.todo_enabled).
   *  Absent means yes: an older API that does not send it must not take the
   *  panel away. */
  todo_enabled?: boolean;
  workspace_archived?: boolean;
};

export type ShellWorkspaceApp = WorkspaceAppRow & { id?: string };

export type ShellWorkspace = {
  id: string;
  name: string | null;
  slug: string | null;
  is_active: boolean;
  has_app: boolean;
};

type Thunks = Record<string, () => Promise<unknown>>;
type Resolved<T extends Thunks> = { [K in keyof T]: Awaited<ReturnType<T[K]>> };

export type AppShell<Me extends ShellMe, X extends Thunks> =
  | {
      ok: true;
      me: Me;
      /** Apps activated for the workspace (active and deactivated rows alike). */
      apps: ShellWorkspaceApp[];
      /** Workspaces the signed-in user may switch to — only those where this app is usable. */
      workspaces: ShellWorkspace[];
      /** Membership held AND app activated for this workspace (platform: always). */
      hasAccess: boolean;
      extras: Resolved<X>;
    }
  | { ok: false; reason: 'no-session' | 'no-access' };

const slugOf = (o: AppMembershipRow['app']): string | null =>
  !o ? null : Array.isArray(o) ? (o[0]?.slug ?? null) : o.slug;

export async function loadAppShell<Me extends ShellMe = ShellMe, X extends Thunks = Record<never, never>>({
  apiFetch,
  appSlug,
  extras,
}: {
  apiFetch: ApiFetch;
  /** The app whose layout is loading; its membership + activation gate the shell. */
  appSlug: AppId;
  /** Anything else the layout needs, started at the same moment as the API calls. */
  extras?: X;
}): Promise<AppShell<Me, X>> {
  const fns = (extras ?? {}) as Record<string, () => Promise<unknown>>;
  const extraKeys = Object.keys(fns);
  let me: Me;
  let apps: ShellWorkspaceApp[];
  let workspaces: ShellWorkspace[];
  let extraValues: unknown[];
  try {
    [me, apps, workspaces, ...extraValues] = await Promise.all([
      apiFetch<Me>('/api/v1/auth/me'),
      apiFetch<{ items: ShellWorkspaceApp[] }>('/api/v1/workspace-apps').then((r) => r.items ?? []),
      apiFetch<{ workspaces: ShellWorkspace[] }>('/api/v1/auth/workspaces')
        .then((r) => (r.workspaces ?? []).filter((w) => w.has_app))
        // The switcher is decoration; a failed list must not take the page down.
        .catch(() => [] as ShellWorkspace[]),
      ...extraKeys.map((k) => fns[k]!()),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return { ok: false, reason: 'no-session' };
    return { ok: false, reason: 'no-access' };
  }

  const resolved = Object.fromEntries(extraKeys.map((k, i) => [k, extraValues[i]])) as Resolved<X>;
  const hasMembership =
    appSlug === 'fibre-platform' || me.memberships.some((m) => slugOf(m.app) === appSlug);
  const activated =
    appSlug === 'fibre-platform' || apps.some((w) => slugOf(w.app) === appSlug && !w.deactivated_at);
  return { ok: true, me, apps, workspaces, hasAccess: hasMembership && activated, extras: resolved };
}
