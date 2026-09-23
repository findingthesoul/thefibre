import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { serverSupabase } from '@/lib/supabase/server';
import { apiFetch } from '@/lib/api';
import { readPrefs } from '@/lib/prefs';
import { Sidebar, MobileNav } from '@/components/shell/sidebar';
import { uiLocale } from '@/lib/locale';
import { LocaleProvider } from '@thefibre/shared/ui/i18n-ui';
import { Topbar } from '@/components/shell/topbar';
import { buildAppList } from '@thefibre/shared/available-apps';
import { loadAppShell, type ShellMe } from '@thefibre/shared/app-shell';
import { APPS, tileArtUrl } from '@thefibre/shared';

// Meet is the rebuild of Suite v1, so its user-facing version starts at 2.0.0.
// This is independent of the monorepo cadence in package.json (which tracks
// cross-package releases like 0.13.x). See CLAUDE.md "Version bumps".
const VERSION = '2.11.0';

type Me = ShellMe;

export default async function MeetAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Local JWT verification against cached JWKS — no round trip to Supabase
  // Auth. The API re-verifies the same token on every call it receives, so
  // this is only the "is anyone here at all" gate before we spend the fetches.
  const supabase = await serverSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) redirect('/');

  // Everything the chrome needs, in one Promise.all: /auth/me,
  // /workspace-apps, /auth/workspaces, plus the cookie prefs and the request
  // host as extras so nothing waits on anything else.
  const shell = await loadAppShell<Me, { prefs: typeof readPrefs; host: () => Promise<string | null> }>({
    apiFetch,
    appSlug: 'fibre-meet',
    extras: {
      prefs: () => readPrefs(),
      host: async () => (await headers()).get('host'),
    },
  });
  if (!shell.ok) redirect(shell.reason === 'no-session' ? '/' : '/no-access');
  // Gate: user must have fibre-meet membership AND the workspace must have meet activated.
  if (!shell.hasAccess) redirect('/no-access');

  const { me, apps, extras } = shell;
  const { prefs, host } = extras;
  const email = me.user.email;
  const fullName = me.user.full_name ?? email;
  // The workspaces this person belongs to, narrowed (by loadAppShell) to the
  // ones where this app is switched on AND their seat there holds a grant for
  // it — `has_app`, decided by the API from the X-App-ID this request carries.
  //
  // The narrowing is the point. The check above redirects to /no-access
  // without both, so a switcher listing every workspace would be a menu of
  // dead ends. What is left is nothing to choose between for almost everybody,
  // and the menu hides the section in that case. A failed list is never
  // fatal: loadAppShell returns [] rather than stopping the app rendering in
  // the workspace you are already in.
  const workspaces = shell.workspaces;

  const switcherApps = buildAppList({
    currentApp: 'fibre-meet',
    memberships: me.memberships,
    workspaceApps: apps,
    env: process.env,
    host,
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
          brandTileSrc={tileArtUrl('fibre-meet', process.env)}
        />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          todoEnabled={me.todo_enabled !== false && me.todo_available !== false}
          email={email}
          fullName={fullName}
          prefs={prefs}
          current={{ slug: 'fibre-meet', name: APPS['fibre-meet'].name }}
          apps={switcherApps}
          workspaces={workspaces}
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
