import { redirect } from 'next/navigation';
import Link from 'next/link';
import { serverSupabase } from '@/lib/supabase/server';
import { NewPersonForm } from './form';

export default async function NewPersonPage() {
  const supabase = await serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <nav className="mb-10 text-sm text-ink-500">
        <Link href="/contacts" className="hover:text-ink-900">← Contacts</Link>
      </nav>
      <h1 className="text-3xl font-medium tracking-tight">Add person</h1>
      <p className="mt-2 text-sm text-ink-500">
        Adds a contact to your workspace. Their identity is platform-owned —
        every app sees the same record.
      </p>
      <NewPersonForm />
    </main>
  );
}
