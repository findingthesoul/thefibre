import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { serverSupabase } from '@/lib/supabase/server';
import { readPrefs } from '@/lib/prefs';
import { apiFetch } from '@/lib/api';
import { Sidebar, MobileNav } from '@/components/shell/sidebar';
import { uiLocale } from '@/lib/locale';
import { LocaleProvider } from '@thefibre/shared/ui/i18n-ui';
import { Topbar } from '@/components/shell/topbar';
import { ArchivedGate } from '@/components/archived-gate';
import { buildAppList } from '@thefibre/shared/available-apps';
import { loadAppShell, type ShellMe } from '@thefibre/shared/app-shell';
import { APPS, SURFACES, surfaceUrl, tileArtUrl } from '@thefibre/shared';
import { VERSION } from '@/lib/version';

// /auth/me as the shell reads it. ShellMe already carries everything this
// layout looks at (locale, is_super_admin, workspace_archived, memberships
// with role); the alias is the place to add platform-only additive fields.
type Me = ShellMe;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // getClaims verifies the JWT locally against the cached JWKS — no round
  // trip to Supabase Auth on every server render (getUser made one).
  const supabase = await serverSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) redirect('/');

  // Who you are, which apps run here, which workspaces you may switch to,
  // plus this layout's own per-request reads — all started at once.
  const host = (await headers()).get('host');
  // The host is read above rather than as a shell extra: the gate below needs
  // it to send a participant to their portal, before `extras` is read.
  // `headers()` is request-local and already resolved — nothing to overlap.
  const shell = await loadAppShell<Me, { prefs: typeof readPrefs }>({
    apiFetch,
    appSlug: 'fibre-platform',
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

  const { me, workspaces } = shell;
  const prefs = shell.extras.prefs;

  const email = claims.claims.email ?? '';
  const fullName =
    (claims.claims.user_metadata?.full_name as string | undefined) ??
    (claims.claims.user_metadata?.name as string | undefined) ??
    email;

  // Admin flags for nav-rendering. Admin pages still gate themselves.
  const isSuperAdmin = !!me.user.is_super_admin;
  const workspaceArchived = !!me.workspace_archived;
  const explicitWorkspaceAdmin = me.memberships.some((m) => {
    const app = Array.isArray(m.app) ? m.app[0] : m.app;
    return app?.slug === 'fibre-platform' && m.role === 'admin';
  });
  const isWorkspaceAdmin = explicitWorkspaceAdmin || isSuperAdmin;

  const apps = buildAppList({
    currentApp: 'fibre-platform',
    memberships: me.memberships,
    workspaceApps: shell.apps,
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
          brandTileSrc={tileArtUrl('fibre-platform', process.env)}
          mode={prefs.sidebar}
          version={VERSION}
          isSuperAdmin={isSuperAdmin}
          isWorkspaceAdmin={isWorkspaceAdmin}
        />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          todoEnabled={me.todo_enabled !== false && me.todo_available !== false}
          email={email}
          fullName={fullName}
          prefs={prefs}
          current={{ slug: 'fibre-platform', name: APPS['fibre-platform'].name }}
          apps={apps}
          portal={{ url: surfaceUrl('my-portal', process.env, host), name: SURFACES['my-portal'].shortLabel }}
          workspaces={workspaces}
        />
        <ArchivedGate archived={workspaceArchived} />
        <main className="flex-1 overflow-y-auto">{children}</main>
        <MobileNav
          version={VERSION}
          isSuperAdmin={isSuperAdmin}
          isWorkspaceAdmin={isWorkspaceAdmin}
        />
      </div>
    </div>
    </LocaleProvider>
  );
}
