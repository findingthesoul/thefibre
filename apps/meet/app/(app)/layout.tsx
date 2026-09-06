import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { apiFetch } from '@/lib/api';
import { readPrefs } from '@/lib/prefs';
import { Sidebar, MobileNav } from '@/components/shell/sidebar';
import { uiLocale } from '@/lib/locale';
import { LocaleProvider } from '@thefibre/shared/ui/i18n-ui';
import { Topbar } from '@/components/shell/topbar';
import type { WorkspaceChoice } from '@/components/shell/user-menu';
import { buildAppList } from '@/lib/available-apps';
import { APPS } from '@thefibre/shared';

// Meet is the rebuild of Suite v1, so its user-facing version starts at 2.0.0.
// This is independent of the monorepo cadence in package.json (which tracks
// cross-package releases like 0.13.x). See CLAUDE.md "Version bumps".
const VERSION = '2.7.0';

type Me = {
  user: { id: string; email: string; full_name: string | null };
  workspace: { id: string; name: string } | null;
  memberships: { app: { slug: string } | { slug: string }[] | null; role: string }[];
};

type WorkspaceApp = {
  id: string;
  deactivated_at: string | null;
  app: { slug: string } | { slug: string }[] | null;
};

export default async function MeetAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await serverSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  // Gate: user must have fibre-meet membership AND the workspace must have meet activated.
  let me: Me;
  let apps: WorkspaceApp[] = [];
  try {
    me = await apiFetch<Me>('/api/v1/auth/me');
    const r = await apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps');
    apps = r.items;
  } catch {
    redirect('/no-access');
  }

  const hasMembership = me.memberships.some((m) => {
    const a = Array.isArray(m.app) ? m.app[0] : m.app;
    return a?.slug === 'fibre-meet';
  });
  const activated = apps.some((w) => {
    const a = Array.isArray(w.app) ? w.app[0] : w.app;
    return a?.slug === 'fibre-meet' && !w.deactivated_at;
  });
  if (!hasMembership || !activated) redirect('/no-access');

  const prefs = await readPrefs();
  const email = me.user.email;
  const fullName = me.user.full_name ?? email;
  // The workspaces this person belongs to, narrowed to the ones where this app
  // is switched on AND their seat there holds a grant for it — `has_app`,
  // decided by the API from the X-App-ID this request carries.
  //
  // The narrowing is the point. The check above redirects to /no-access
  // without both, so a switcher listing every workspace would be a menu of
  // dead ends. What is left is nothing to choose between for almost everybody,
  // and the menu hides the section in that case.
  let workspaces: WorkspaceChoice[] = [];
  try {
    const r = await apiFetch<{ workspaces: (WorkspaceChoice & { has_app: boolean })[] }>(
      '/api/v1/auth/workspaces',
    );
    workspaces = r.workspaces.filter((w) => w.has_app);
  } catch {
    // Never fatal: not being able to list them must not stop the app rendering
    // in the one you are already in.
  }

  const switcherApps = buildAppList({
    currentApp: 'fibre-meet',
    memberships: me.memberships,
    workspaceApps: apps,
  });

  const locale = await uiLocale();

  return (
    <LocaleProvider locale={locale}>
    <div className="h-dvh flex bg-surface">
      {/* Sidebar is desktop chrome; below md the bottom tab bar takes over. */}
      <div className="hidden md:block shrink-0">
        <Sidebar mode={prefs.sidebar} version={VERSION} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
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
