import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { readPrefs } from '@/lib/prefs';
import { apiFetch } from '@/lib/api';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { buildAppList } from '@/lib/available-apps';
import { APPS } from '@thefibre/shared';

const VERSION = '0.13.104';

type Me = {
  user: { is_super_admin?: boolean };
  memberships: { app: { slug: string } | { slug: string }[] | null; role: string }[];
};

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
  let memberships: Me['memberships'] = [];
  let workspaceApps: WorkspaceApp[] = [];
  try {
    const me = await apiFetch<Me>('/api/v1/auth/me');
    memberships = me.memberships;
    isSuperAdmin = !!me.user.is_super_admin;
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

  const apps = buildAppList({ memberships, workspaceApps });

  return (
    <div className="h-screen flex bg-surface">
      <Sidebar
        mode={prefs.sidebar}
        version={VERSION}
        isSuperAdmin={isSuperAdmin}
        isWorkspaceAdmin={isWorkspaceAdmin}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          email={email}
          fullName={fullName}
          prefs={prefs}
          current={{ slug: 'fibre-platform', name: APPS['fibre-platform'].name }}
          apps={apps}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
