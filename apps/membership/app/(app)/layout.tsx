import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { apiFetch } from '@/lib/api';
import { readPrefs } from '@/lib/prefs';
import { Sidebar, MobileNav } from '@/components/shell/sidebar';
import { uiLocale } from '@/lib/locale';
import { LocaleProvider } from '@thefibre/shared/ui/i18n-ui';
import { Topbar } from '@/components/shell/topbar';
import type { WorkspaceChoice } from '@/components/shell/user-menu';
import { headers } from 'next/headers';
import { buildAppList } from '@thefibre/shared/available-apps';
import { loadAppShell, type ShellMe } from '@thefibre/shared/app-shell';
import { APPS, tileArtUrl } from '@thefibre/shared';
import { crossAppHref } from '@thefibre/shared/sso-hop';

// Membership has its own user-facing version, independent of the monorepo
// cadence in package.json. Starts at 0.1.0 because it's a new app (not a
// rebuild of an existing one). See CLAUDE.md "Version bumps".
const VERSION = '1.0.0';

// A strict subtype of ShellMe: what this layout actually reads. Extend here,
// never loosen the shared shape.
type Me = ShellMe & {
  user: { id: string; email: string; full_name: string | null };
  workspace: { id: string; name: string } | null;
  memberships: { app: { slug: string } | { slug: string }[] | null; role: string }[];
};

export default async function MembershipAppLayout({
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

  // Gate: the user holds an app_membership for Membership AND the workspace
  // has it activated. Who you are, which apps the workspace runs, which
  // workspaces you may switch to — plus the prefs cookie — in ONE Promise.all
  // (packages/shared/src/app-shell.ts explains the measured cost of the old
  // sequential chain).
  const shell = await loadAppShell<Me, { prefs: typeof readPrefs }>({
    apiFetch,
    appSlug: 'membership',
    extras: { prefs: () => readPrefs() },
  });
  // Only reachable WITH a valid session: the `!claims` case above already
  // bounced a signed-out visitor to `/`. So a failure here means the API
  // refused this session standing in THIS app — which is not the same as
  // having no session, and must not be sent back to `/`.
  //
  // Sending it there was an infinite redirect: `/` sees the claims, forwards
  // to /dashboard, the layout asks the API, gets 401, returns to `/`.
  // ERR_TOO_MANY_REDIRECTS, and it hit a real member on production
  // (2026-09-24) moments after they paid — a participant has a Fibre account
  // but no seat in Thread, which is exactly the case that 401s.
  if (!shell.ok) redirect('/no-access');
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
    currentApp: 'membership',
    memberships: me.memberships,
    workspaceApps: apps,
    env: process.env,
    host: (await headers()).get('host'),
  });

  const locale = await uiLocale(me.locale);

  return (
    <LocaleProvider locale={locale}>
    <div className="h-dvh flex bg-surface">
      {/* Sidebar is desktop chrome; below md the bottom tab bar takes over. */}
      <div className="hidden md:block shrink-0">
        <Sidebar
          mode={prefs.sidebar}
          version={VERSION}
          brandTileSrc={tileArtUrl('membership', process.env)}
        />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          todoEnabled={me.todo_enabled !== false && me.todo_available !== false}
          email={email}
          fullName={fullName}
          prefs={prefs}
          current={{ slug: 'membership', name: APPS['membership'].name }}
          apps={switcherApps}
          workspaces={workspaces}
          profileHref={crossAppHref('membership', 'fibre-platform', process.env, '/settings/profile')}
        />
        {/* Soft-cream content surface so the white cards inside
         (Scope, Details, lists, dialogs) lift cleanly off the page. */}
        <main className="flex-1 overflow-y-auto bg-surface-sunken">
          {children}
        </main>
        <MobileNav version={VERSION} />
      </div>
    </div>
    </LocaleProvider>
  );
}
