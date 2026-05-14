import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { readPrefs } from '@/lib/prefs';
import { apiFetch } from '@/lib/api';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';

const VERSION = '0.5.1';

type Me = {
  user: { is_super_admin?: boolean };
  memberships: { app: { slug: string } | { slug: string }[] | null; role: string }[];
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

  // Cheap admin check for nav-rendering. Best-effort; non-fatal if it fails.
  let isSuperAdmin = false;
  let isWorkspaceAdmin = false;
  try {
    const me = await apiFetch<Me>('/api/v1/auth/me');
    isSuperAdmin = !!me.user.is_super_admin;
    isWorkspaceAdmin = me.memberships.some((m) => {
      const app = Array.isArray(m.app) ? m.app[0] : m.app;
      return app?.slug === 'fibre-platform' && m.role === 'admin';
    });
  } catch {
    // Stay non-admin if the API call fails — the admin pages still gate themselves.
  }

  return (
    <div className="h-screen flex bg-surface">
      <Sidebar
        mode={prefs.sidebar}
        version={VERSION}
        isSuperAdmin={isSuperAdmin}
        isWorkspaceAdmin={isWorkspaceAdmin}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar email={email} fullName={fullName} prefs={prefs} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
