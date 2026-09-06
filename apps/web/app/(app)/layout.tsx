import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { readPrefs } from '@/lib/prefs';
import { apiFetch } from '@/lib/api';
import { Sidebar, MobileNav } from '@/components/shell/sidebar';
import { uiLocale } from '@/lib/locale';
import { LocaleProvider } from '@thefibre/shared/ui/i18n-ui';
import { Topbar } from '@/components/shell/topbar';
import { ArchivedGate } from '@/components/archived-gate';
import { buildAppList } from '@/lib/available-apps';
import { APPS } from '@thefibre/shared';
import { VERSION } from '@/lib/version';

type Me = {
  user: { is_super_admin?: boolean };
  workspace_archived?: boolean;
  memberships: { app: { slug: string } | { slug: string }[] | null; role: string }[];
};

type WorkspaceChoiceRow = { id: string; name: string | null; is_active: boolean };

type WorkspaceApp = {
  deactivated_at: string | null;
  app: { slug: string } | { slug: string }[] | null;
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const prefs = await readPrefs();
  const email = user.email ?? '';
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    email;

  // Cheap admin check for nav-rendering + app-switcher data. Best-effort.
  let isSuperAdmin = false;
  let isWorkspaceAdmin = false;
  let workspaceArchived = false;
  let memberships: Me['memberships'] = [];
  let workspaceApps: WorkspaceApp[] = [];
  try {
    const me = await apiFetch<Me>('/api/v1/auth/me');
    memberships = me.memberships;
    isSuperAdmin = !!me.user.is_super_admin;
    workspaceArchived = !!me.workspace_archived;
    const explicitWorkspaceAdmin = me.memberships.some((m) => {
      const app = Array.isArray(m.app) ? m.app[0] : m.app;
      return app?.slug === 'fibre-platform' && m.role === 'admin';
    });
    isWorkspaceAdmin = explicitWorkspaceAdmin || isSuperAdmin;
  } catch {
    // ignore — admin pages still gate themselves
  }
  try {
    const r = await apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps');
    workspaceApps = r.items;
  } catch {
    // ignore — empty list means only The Fibre shows in the switcher
  }

  // The workspaces this person belongs to. Almost everybody has one, and the
  // menu hides the section when there is nothing to choose between — so this
  // costs a request and changes nothing until somebody has two.
  let workspaces: WorkspaceChoiceRow[] = [];
  try {
    const r = await apiFetch<{ workspaces: WorkspaceChoiceRow[] }>('/api/v1/auth/workspaces');
    workspaces = r.workspaces;
  } catch {
    // Never fatal: not being able to list them must not stop the app rendering
    // in the one you are already in.
  }

  const apps = buildAppList({ currentApp: 'fibre-platform', memberships, workspaceApps });

  const locale = await uiLocale();

  return (
    <LocaleProvider locale={locale}>
    <div className="h-dvh flex bg-surface">
      {/* Sidebar is desktop chrome; below md the bottom tab bar takes over. */}
      <div className="hidden md:block shrink-0">
        <Sidebar
          mode={prefs.sidebar}
          version={VERSION}
          isSuperAdmin={isSuperAdmin}
          isWorkspaceAdmin={isWorkspaceAdmin}
        />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          email={email}
          fullName={fullName}
          prefs={prefs}
          current={{ slug: 'fibre-platform', name: APPS['fibre-platform'].name }}
          apps={apps}
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
