import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { apiFetch } from '@/lib/api';
import { readPrefs } from '@/lib/prefs';
import { Sidebar, MobileNav } from '@/components/shell/sidebar';
import { uiLocale } from '@/lib/locale';
import { LocaleProvider } from '@thefibre/shared/ui/i18n-ui';
import { Topbar } from '@/components/shell/topbar';
import { ThreadAssistant } from '@/components/shell/assistant';
import { assistantEnabled } from '@/lib/assistant-actions';
import type { WorkspaceChoice } from '@/components/shell/user-menu';
import { buildAppList } from '@thefibre/shared/available-apps';
import { loadAppShell, type ShellMe } from '@thefibre/shared/app-shell';
import { APPS, tileArtUrl } from '@thefibre/shared';

// The Thread is the rebuild of thethread-v3, so its user-facing version
// starts at 3.0.0 — independent of the monorepo cadence in package.json,
// same rule as Meet's v2.x. See CLAUDE.md "Version bumps".
const VERSION = '4.0.0';

// A strict subtype of ShellMe: what this layout actually reads. Extend here,
// never loosen the shared shape.
type Me = ShellMe & {
  user: { id: string; email: string; full_name: string | null };
  workspace: { id: string; name: string } | null;
  memberships: { app: { slug: string } | { slug: string }[] | null; role: string }[];
};

export default async function ThreadAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // getClaims verifies the session JWT locally against the project's cached
  // JWKS — no round trip to Supabase Auth on every server render (getUser
  // made one). The API still validates the token on every call it receives.
  const supabase = await serverSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) redirect('/');

  // Who you are, which apps the workspace runs, which workspaces you may
  // switch to — plus this layout's own extras — in ONE Promise.all
  // (packages/shared/src/app-shell.ts explains the measured cost of the old
  // sequential chain).
  const shell = await loadAppShell<Me, { prefs: typeof readPrefs; assistant: typeof assistantEnabled }>({
    apiFetch,
    appSlug: 'the-thread',
    extras: { prefs: () => readPrefs(), assistant: () => assistantEnabled() },
  });
  if (!shell.ok) redirect(shell.reason === 'no-session' ? '/' : '/no-access');
  if (!shell.hasAccess) redirect('/no-access');

  const { me, apps, extras } = shell;
  const prefs = extras.prefs;
  const email = me.user.email;
  const fullName = me.user.full_name ?? email;
  // The workspaces this person belongs to, narrowed to the ones where this app
  // is switched on AND their seat there holds a grant for it — `has_app`,
  // decided by the API from the X-App-ID this request carries.
  //
  // The narrowing is the point. The check above redirects to /no-access
  // without both, so a switcher listing every workspace would be a menu of
  // dead ends. What is left is nothing to choose between for almost everybody,
  // and the menu hides the section in that case. loadAppShell already applied
  // the has_app filter and swallowed a failed list (never fatal: not being
  // able to list them must not stop the app rendering in the one you are in).
  const workspaces: WorkspaceChoice[] = shell.workspaces;

  const switcherApps = buildAppList({
    currentApp: 'the-thread',
    memberships: me.memberships,
    workspaceApps: apps,
    env: process.env,
    host: (await headers()).get('host'),
  });

  const locale = await uiLocale(me.locale);
  // The in-app assistant (docs/assistant-in-app.md) is on only where the API
  // holds a model key; without it there is no button, not a broken one.
  const showAssistant = extras.assistant;

  return (
    <LocaleProvider locale={locale}>
    <div className="h-dvh flex bg-surface">
      {/* Sidebar is desktop chrome; below md the bottom tab bar takes over. */}
      <div className="hidden md:block shrink-0">
        <Sidebar
          mode={prefs.sidebar}
          version={VERSION}
          brandTileSrc={tileArtUrl('the-thread', process.env)}
        />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          todoEnabled={me.todo_enabled !== false && me.todo_available !== false}
          email={email}
          fullName={fullName}
          prefs={prefs}
          current={{ slug: 'the-thread', name: APPS['the-thread'].name }}
          apps={switcherApps}
          workspaces={workspaces}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
        {showAssistant && <ThreadAssistant locale={locale} />}
        <MobileNav version={VERSION} />
      </div>
    </div>
    </LocaleProvider>
  );
}
