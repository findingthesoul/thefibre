import { redirect } from 'next/navigation';
import Link from 'next/link';
import { serverSupabase } from '@/lib/supabase/server';
import { SignOutButton } from './sign-out-button';

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
  if (!user) redirect('/');

  // App memberships come from the custom_access_token_hook (see migrations).
  const { data: { session } } = await supabase.auth.getSession();
  const claims = session?.access_token
    ? JSON.parse(Buffer.from(session.access_token.split('.')[1] ?? '', 'base64').toString())
    : {};
  const memberships: string[] = claims.app_memberships ?? [];
  const workspaceId: string | undefined = claims.workspace_id;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-500">{user.email}</p>
        </div>
        <SignOutButton />
      </header>

      <nav className="mt-8 flex gap-4 text-sm">
        <Link href="/contacts" className="underline underline-offset-2 hover:text-ink-700">Contacts</Link>
      </nav>

      <section className="mt-12">
        <h2 className="text-sm uppercase tracking-wider text-ink-500">Your apps</h2>
        {memberships.length === 0 ? (
          <div className="mt-4 rounded-md border border-ink-700/10 bg-paper-100 p-4 text-sm text-ink-500">
            You don't have access to any apps yet.
            {!workspaceId && (
              <> Your account isn't linked to a workspace — ask an admin to invite you.</>
            )}
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-ink-700/10">
            {memberships.map((slug) => (
              <li key={slug} className="py-4 flex items-baseline justify-between">
                <span className="font-medium">{APP_NAMES[slug] ?? slug}</span>
                <Link href={APP_DOMAINS[slug] ?? '#'} className="text-sm underline">
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12 text-xs text-ink-500">
        <p>Workspace: {workspaceId ?? '— not linked —'}</p>
      </section>
    </main>
  );
}
