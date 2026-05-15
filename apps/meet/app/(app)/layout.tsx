import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { apiFetch } from '@/lib/api';
import { SignOutButton } from '@/components/sign-out';

const VERSION = '0.5.2';

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

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  // Confirm: (1) the user has a fibre-meet membership, (2) their workspace
  // has fibre-meet activated. Either failure → /no-access.
  let me: Me;
  let workspaceApps: WorkspaceApp[] = [];
  try {
    me = await apiFetch<Me>('/api/v1/auth/me');
    const apps = await apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps');
    workspaceApps = apps.items;
  } catch {
    redirect('/no-access');
  }

  const hasMeetMembership = me.memberships.some((m) => {
    const app = Array.isArray(m.app) ? m.app[0] : m.app;
    return app?.slug === 'fibre-meet';
  });
  const meetActivated = workspaceApps.some((w) => {
    const app = Array.isArray(w.app) ? w.app[0] : w.app;
    return app?.slug === 'fibre-meet' && !w.deactivated_at;
  });

  if (!hasMeetMembership || !meetActivated) redirect('/no-access');

  const fullName = me.user.full_name ?? me.user.email;
  const fibreUrl = process.env.NEXT_PUBLIC_FIBRE_URL ?? 'https://thefibre.app';

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <header className="border-b border-line bg-surface-raised">
        <div className="mx-auto max-w-5xl px-8 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-8">
            <Link href="/dashboard" className="text-base font-medium">
              Fibre Meet
            </Link>
            <nav className="flex items-baseline gap-5 text-sm">
              <Link href="/dashboard" className="text-ink-subtle hover:text-ink">
                Dashboard
              </Link>
              <Link href="/meeting-types" className="text-ink-subtle hover:text-ink">
                Meeting types
              </Link>
              <Link href="/settings" className="text-ink-subtle hover:text-ink">
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-5 text-sm">
            {me.workspace && (
              <span className="text-xs text-ink-muted">
                {me.workspace.name}
              </span>
            )}
            <Link href={fibreUrl} className="text-ink-subtle hover:text-ink">
              The Fibre ↗
            </Link>
            <span className="text-ink-subtle">{fullName}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line text-[10px] uppercase tracking-wider text-ink-muted px-8 py-3 flex justify-between max-w-5xl mx-auto w-full">
        <span>Fibre Meet · part of The Fibre</span>
        <span>v{VERSION}</span>
      </footer>
    </div>
  );
}
