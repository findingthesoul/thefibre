import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';

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
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-medium tracking-tight">Contacts</h1>
        <Link
          href="/contacts/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-ink text-ink-inverse px-3 py-1.5 text-sm font-medium hover:opacity-90"
        >
          <Plus size={14} strokeWidth={2.25} />
          Add person
        </Link>
      </header>

      <form className="mt-6 relative" action="/contacts">
        <Search size={15} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search name or email…"
          className="w-full rounded-md border border-line bg-surface-raised pl-9 pr-3 py-2 text-sm placeholder:text-ink-muted focus:border-line-strong focus:outline-none"
        />
      </form>

      {error && (
        <div className="mt-6 rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
          Couldn't load contacts: {error}
        </div>
      )}

      {!error && items.length === 0 && (
        <div className="mt-10 rounded-lg border border-line bg-surface-sunken p-6 text-sm text-ink-subtle">
          No contacts yet.{' '}
          <Link href="/contacts/new" className="underline">Add the first one</Link>.
        </div>
      )}

      {items.length > 0 && (
        <ul className="mt-6 divide-y divide-line border border-line rounded-lg bg-surface-raised overflow-hidden">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                href={`/contacts/${p.id}`}
                className="flex items-baseline justify-between gap-4 px-5 py-4 hover:bg-surface-sunken"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {p.first_name} {p.last_name}
                  </div>
                  <div className="text-sm text-ink-subtle truncate">{p.email ?? '—'}</div>
                </div>
                <div className="text-xs text-ink-muted shrink-0">{p.country ?? ''}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
