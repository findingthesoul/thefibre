import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { apiFetch } from '@/lib/api';
import { readPrefs } from '@/lib/prefs';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';
import { buildAppList } from '@/lib/available-apps';
import { APPS } from '@thefibre/shared';

// The Thread is the rebuild of thethread-v3, so its user-facing version
// starts at 3.0.0 — independent of the monorepo cadence in package.json,
// same rule as Meet's v2.x. See CLAUDE.md "Version bumps".
const VERSION = '3.6.0';

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

export default async function ThreadAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await serverSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

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
    return a?.slug === 'the-thread';
  });
  const activated = apps.some((w) => {
    const a = Array.isArray(w.app) ? w.app[0] : w.app;
    return a?.slug === 'the-thread' && !w.deactivated_at;
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
          current={{ slug: 'the-thread', name: APPS['the-thread'].name }}
          apps={switcherApps}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
