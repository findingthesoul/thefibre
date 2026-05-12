import Link from 'next/link';
import { serverSupabase } from '@/lib/supabase/server';

const APP_DOMAINS: Record<string, string> = {
  'fibre-suite': 'https://suite.thefibre.app',
  'the-thread': 'https://thread.thefibre.app',
  'fibre-sales': 'https://sales.thefibre.app',
  'fibre-learn': 'https://learn.thefibre.app',
};
const APP_NAMES: Record<string, string> = {
  'fibre-suite': 'Fibre Suite',
  'the-thread': 'The Thread',
  'fibre-sales': 'Fibre Sales',
  'fibre-learn': 'Fibre Learn',
};

export default async function Dashboard() {
  const supabase = await serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  // Auth is enforced by the (app) layout.

  const { data: { session } } = await supabase.auth.getSession();
  const claims = session?.access_token
    ? JSON.parse(Buffer.from(session.access_token.split('.')[1] ?? '', 'base64').toString())
    : {};
  const memberships: string[] = claims.app_memberships ?? [];
  const workspaceId: string | undefined = claims.workspace_id;

  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email ??
    '';
  const firstName = fullName.split(/\s+/)[0] ?? '';

  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      <h1 className="text-3xl font-medium tracking-tight">Welcome, {firstName}</h1>
      <p className="mt-1 text-sm text-ink-subtle">{today}</p>

      <section className="mt-12">
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">Your apps</div>
        {memberships.length === 0 ? (
          <div className="mt-3 rounded-lg border border-line bg-surface-sunken p-5 text-sm text-ink-subtle">
            You don't have access to any apps yet.
            {!workspaceId && <> Your account isn't linked to a workspace.</>}
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line border border-line rounded-lg bg-surface-raised overflow-hidden">
            {memberships.map((slug) => (
              <li key={slug}>
                <Link
                  href={APP_DOMAINS[slug] ?? '#'}
                  className="flex items-baseline justify-between px-5 py-4 hover:bg-surface-sunken"
                >
                  <span className="font-medium">{APP_NAMES[slug] ?? slug}</span>
                  <span className="text-sm text-ink-subtle">Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12 text-xs text-ink-muted">
        Workspace: {workspaceId ?? '— not linked —'}
      </section>
    </div>
  );
}
