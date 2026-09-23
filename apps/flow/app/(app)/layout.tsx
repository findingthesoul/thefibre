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

// Fibre Flow has its own user-facing version, independent of the monorepo
// cadence in package.json. Starts at 0.1.0 because it's a new app (not a
// rebuild of an existing one). See CLAUDE.md "Version bumps".
const VERSION = '1.16.0';

type Me = ShellMe & {
  user: { id: string; email: string; full_name: string | null };
  workspace: { id: string; name: string } | null;
  memberships: { app: { slug: string } | { slug: string }[] | null; role: string }[];
};

export default async function FlowAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await serverSupabase();
  // Local JWT verification against cached JWKS — no round trip to Supabase
  // Auth. The API re-verifies the same token on every call, so this is only
  // the "is anyone here" gate before the fetches are spent (2026-09-17).
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) redirect('/');

  // Everything the chrome needs in ONE Promise.all — /auth/me,
  // /workspace-apps, /auth/workspaces and the cookie prefs. These ran one
  // after the other until 2026-09-17, ~1 s per server render.
  const shell = await loadAppShell<Me, { prefs: typeof readPrefs }>({
    apiFetch,
    appSlug: 'fibre-flow',
    extras: { prefs: () => readPrefs() },
  });
  if (!shell.ok) redirect(shell.reason === 'no-session' ? '/' : '/no-access');
  if (!shell.hasAccess) redirect('/no-access');
  const { me, apps } = shell;
  const prefs = shell.extras.prefs;
  const email = me.user.email;
  const fullName = me.user.full_name ?? email;
  const workspaces: WorkspaceChoice[] = shell.workspaces;

  const switcherApps = buildAppList({
    currentApp: 'fibre-flow',
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
          brandTileSrc={tileArtUrl('fibre-flow', process.env)}
        />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          todoEnabled={me.todo_enabled !== false}
          email={email}
          fullName={fullName}
          prefs={prefs}
          current={{ slug: 'fibre-flow', name: APPS['fibre-flow'].name }}
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
