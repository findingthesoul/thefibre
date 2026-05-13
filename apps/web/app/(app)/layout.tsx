import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { readPrefs } from '@/lib/prefs';
import { Sidebar } from '@/components/shell/sidebar';
import { Topbar } from '@/components/shell/topbar';

const VERSION = '0.3.10';

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

  return (
    <div className="h-screen flex bg-surface">
      <Sidebar mode={prefs.sidebar} version={VERSION} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar email={email} fullName={fullName} prefs={prefs} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
