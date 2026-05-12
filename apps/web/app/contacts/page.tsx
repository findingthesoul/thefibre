import Link from 'next/link';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { serverSupabase } from '@/lib/supabase/server';

type Person = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  country: string | null;
  created_at: string;
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { q } = await searchParams;

  let items: Person[] = [];
  let error: string | null = null;
  try {
    const data = await apiFetch<{ items: Person[] }>(
      `/api/v1/persons?limit=100${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    items = data.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <nav className="mb-10 text-sm text-ink-500">
        <Link href="/dashboard" className="hover:text-ink-900">← Dashboard</Link>
      </nav>

      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-medium tracking-tight">Contacts</h1>
        <Link
          href="/contacts/new"
          className="rounded-md bg-ink-900 px-3 py-1.5 text-sm font-medium text-paper-50 hover:bg-ink-700"
        >
          Add person
        </Link>
      </header>

      <form className="mt-6" action="/contacts">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search name or email…"
          className="w-full rounded-md border border-ink-700/15 bg-white px-3 py-2 text-sm placeholder:text-ink-500/60 focus:border-ink-900/40 focus:outline-none"
        />
      </form>

      {error && (
        <div className="mt-6 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          Couldn't load contacts: {error}
        </div>
      )}

      {!error && items.length === 0 && (
        <div className="mt-10 rounded-md border border-ink-700/10 bg-paper-100 p-6 text-sm text-ink-500">
          No contacts yet. <Link href="/contacts/new" className="underline">Add the first one</Link>.
        </div>
      )}

      {items.length > 0 && (
        <ul className="mt-8 divide-y divide-ink-700/10">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                href={`/contacts/${p.id}`}
                className="flex items-baseline justify-between gap-4 py-4 hover:bg-paper-100/60 -mx-2 px-2 rounded"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {p.first_name} {p.last_name}
                  </div>
                  <div className="text-sm text-ink-500 truncate">{p.email ?? '—'}</div>
                </div>
                <div className="text-xs text-ink-500 shrink-0">{p.country ?? ''}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
