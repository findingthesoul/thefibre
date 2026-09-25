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
import { APPS, SURFACES, surfaceUrl, tileArtUrl } from '@thefibre/shared';

// Meet is the rebuild of Suite v1, so its user-facing version starts at 2.0.0.
// This is independent of the monorepo cadence in package.json (which tracks
// cross-package releases like 0.13.x). See CLAUDE.md "Version bumps".
const VERSION = '2.15.0';

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
  // /workspace-apps, /auth/workspaces, plus the cookie prefs as an extra so
  // nothing waits on anything else.
  //
  // The host is read HERE rather than as a shell extra: the gate below needs
  // it to send a participant to their portal, and that runs before `extras`
  // is destructured. `headers()` is request-local and already resolved, so
  // there is nothing to parallelise anyway.
  const host = (await headers()).get('host');
  const shell = await loadAppShell<Me, { prefs: typeof readPrefs }>({
    apiFetch,
    appSlug: 'fibre-meet',
    extras: {
      prefs: () => readPrefs(),
    },
  });
  // No standing at all (a 401 from /auth/me) means a PARTICIPANT: a Fibre
  // account from enrolling or joining, and a seat in no app. Their place is
  // the portal, so they are taken there rather than shown a wall with a
  // button on it — Sjoerd, 2026-09-24: *"I rather have that someone is
  // automatically pushed to their my.thethread..."*
  //
  // `hasAccess` is the OTHER case and keeps the wall: that person does hold a
  // seat, and the honest answer is that this workspace has not switched the
  // app on — which the portal cannot tell them.
  if (!shell.ok) redirect(surfaceUrl('my-portal', process.env, host));
  // Gate: user must have fibre-meet membership AND the workspace must have meet activated.
  if (!shell.hasAccess) redirect('/no-access');

  const { me, apps, extras } = shell;
  const prefs = extras.prefs;
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
          portal={{ url: surfaceUrl('my-portal', process.env, host), name: SURFACES['my-portal'].shortLabel }}
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
