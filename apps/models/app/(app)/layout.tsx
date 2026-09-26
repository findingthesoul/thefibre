import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { serverSupabase } from '@/lib/supabase/server';
import { apiFetch } from '@/lib/api';
import { readPrefs } from '@/lib/prefs';
import { Sidebar, MobileNav } from '@/components/shell/sidebar';
import { uiLocale } from '@/lib/locale';
import { LocaleProvider } from '@thefibre/shared/ui/i18n-ui';
import { Topbar } from '@/components/shell/topbar';
import type { WorkspaceChoice } from '@/components/shell/user-menu';
import { buildAppList } from '@thefibre/shared/available-apps';
import { loadAppShell, type ShellMe } from '@thefibre/shared/app-shell';
import { APPS, SURFACES, surfaceUrl, tileArtUrl } from '@thefibre/shared';

// Business Models has its own user-facing version, independent of the
// monorepo cadence (new app, started at 0.1.0 on 2026-09-25).
export const VERSION = '0.5.0';

type Me = ShellMe & {
  user: { id: string; email: string; full_name: string | null };
  workspace: { id: string; name: string } | null;
  memberships: { app: { slug: string } | { slug: string }[] | null; role: string }[];
};

export default async function ModelsAppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await serverSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) redirect('/');

  const host = (await headers()).get('host');
  const shell = await loadAppShell<Me, { prefs: typeof readPrefs }>({
    apiFetch,
    appSlug: 'fibre-models',
    extras: { prefs: () => readPrefs() },
  });
  if (!shell.ok) redirect(surfaceUrl('my-portal', process.env, host));
  if (!shell.hasAccess) redirect('/no-access');
  const { me, apps } = shell;
  const prefs = shell.extras.prefs;
  const email = me.user.email;
  const fullName = me.user.full_name ?? email;
  const workspaces: WorkspaceChoice[] = shell.workspaces;

  const switcherApps = buildAppList({
    currentApp: 'fibre-models',
    memberships: me.memberships,
    workspaceApps: apps,
    env: process.env,
    host,
  });
  const locale = await uiLocale(me.locale);

  return (
    <LocaleProvider locale={locale}>
      <div className="h-dvh flex bg-surface">
        <div className="hidden md:block shrink-0">
          <Sidebar mode={prefs.sidebar} version={VERSION} brandTileSrc={tileArtUrl('fibre-models', process.env)} />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar
            todoEnabled={me.todo_enabled !== false && me.todo_available !== false}
            email={email}
            fullName={fullName}
            prefs={prefs}
            current={{ slug: 'fibre-models', name: APPS['fibre-models'].name }}
            apps={switcherApps}
            portal={{ url: surfaceUrl('my-portal', process.env, host), name: SURFACES['my-portal'].shortLabel }}
            workspaces={workspaces}
          />
          <main className="flex-1 overflow-y-auto bg-surface-sunken">{children}</main>
          <MobileNav version={VERSION} />
        </div>
      </div>
    </LocaleProvider>
  );
}
