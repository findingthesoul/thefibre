import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { apiFetch } from '@/lib/api';
import { readPrefs } from '@/lib/prefs';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { buildAppList } from '@/lib/available-apps';
import { APPS } from '@thefibre/shared';

// Fibre Pulse has its own user-facing version, independent of the monorepo
// cadence in package.json. Starts at 0.1.0 because it's a new app (not a
// rebuild of an existing one). See CLAUDE.md "Version bumps".
const VERSION = '0.21.0';

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

export default async function PulseAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await serverSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  // Gate: user must have fibre-pulse membership AND the workspace must have flow activated.
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
    return a?.slug === 'fibre-pulse';
  });
  const activated = apps.some((w) => {
    const a = Array.isArray(w.app) ? w.app[0] : w.app;
    return a?.slug === 'fibre-pulse' && !w.deactivated_at;
  });
  if (!hasMembership || !activated) redirect('/no-access');

  const prefs = await readPrefs();
  const email = me.user.email;
  const fullName = me.user.full_name ?? email;
  const switcherApps = buildAppList({
    memberships: me.memberships,
    workspaceApps: apps,
  });

  return (
    <div className="h-screen flex bg-surface">
      <Sidebar mode={prefs.sidebar} version={VERSION} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          email={email}
          fullName={fullName}
          prefs={prefs}
          current={{ slug: 'fibre-pulse', name: APPS['fibre-pulse'].name }}
          apps={switcherApps}
        />
        {/* Soft-cream content surface so the white cards inside
         (Scope, Details, lists, dialogs) lift cleanly off the page. */}
        <main className="flex-1 overflow-y-auto bg-surface-sunken">
          {children}
        </main>
      </div>
    </div>
  );
}
